import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addMinutes, checkCapacity } from "@/lib/capacity";

/**
 * Verifies that the booking belongs to the customer with the given LINE user ID.
 * Returns the booking record on success, or a NextResponse error to short-circuit.
 */
async function authorize(bookingId: string, lineUserId: string | null) {
  if (!lineUserId) {
    return { error: NextResponse.json({ error: "Missing lineUserId" }, { status: 401 }) };
  }
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { lineUserId: true } } },
  });
  if (!booking) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (booking.customer.lineUserId !== lineUserId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { booking };
}

/**
 * PATCH /api/customer/bookings/[id]
 * Body: { lineUserId, branchId?, date?, startTime? }
 * Allows the customer to reschedule (date / time / branch). Recomputes endTime from
 * the BranchService duration and returns 409 if the new slot has no capacity.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { lineUserId, branchId, date, startTime } = body;

    const auth = await authorize(id, lineUserId ?? null);
    if ("error" in auth) return auth.error;
    const { booking } = auth;

    if (booking.status === "COMPLETED" || booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      return NextResponse.json({ error: "Booking cannot be modified in its current state" }, { status: 400 });
    }

    const newBranchId = branchId ?? booking.branchId;
    const newStartTime = startTime ?? booking.startTime;
    const newDate = date ?? booking.date.toISOString().slice(0, 10);

    // Look up BranchService to get duration + price for the (possibly new) branch
    const bs = await prisma.branchService.findUnique({
      where: { branchId_serviceId: { branchId: newBranchId, serviceId: booking.serviceId } },
    });
    if (!bs || !bs.isActive) {
      return NextResponse.json({ error: "This service is not offered at the selected branch" }, { status: 400 });
    }

    const newEndTime = addMinutes(newStartTime, bs.duration);

    const result = await checkCapacity({
      branchId: newBranchId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      excludeBookingId: id,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "Time slot not available", scheduledCount: result.scheduledCount, occupiedCount: result.occupiedCount },
        { status: 409 },
      );
    }

    // Recompute total: new service price + existing addon prices (snapshots)
    const addons = await prisma.bookingAddon.findMany({
      where: { bookingId: id },
      select: { price: true },
    });
    const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
    const newTotal = bs.price + addonsTotal;

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        branchId:   newBranchId,
        date:       new Date(newDate + "T12:00:00"),
        startTime:  newStartTime,
        endTime:    newEndTime,
        totalPrice: newTotal,
        // Clear specific staff assignment when branch changes — admin will re-assign
        ...(branchId && branchId !== booking.branchId ? { staffId: null } : {}),
      },
      include: { branch: true, service: true, staff: true, customer: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Reschedule error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}

/**
 * DELETE /api/customer/bookings/[id]?lineUserId=xxx
 * Cancels the booking (sets status=CANCELLED). Verifies ownership.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    const auth = await authorize(id, lineUserId);
    if ("error" in auth) return auth.error;

    if (auth.booking.status === "CANCELLED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    if (auth.booking.status === "COMPLETED" || auth.booking.status === "NO_SHOW") {
      return NextResponse.json({ error: "Booking cannot be cancelled in its current state" }, { status: 400 });
    }

    await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
