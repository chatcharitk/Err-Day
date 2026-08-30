import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addMinutes, checkCapacity, SALE_ONLY_SKUS } from "@/lib/capacity";
import { sendBookingCancelled, sendGroupBookingNotice } from "@/lib/notifications";
import { findActivePackages } from "@/lib/packages";
import { getPromotionServicePrice } from "@/lib/promotions";

const CANCELLATION_CUTOFF_MS = 30 * 60 * 1000;

function bookingStartsAt(date: Date, startTime: string) {
  const localDate = date.toISOString().slice(0, 10);
  const localTime = startTime.length === 5 ? `${startTime}:00` : startTime;
  return Date.parse(`${localDate}T${localTime}+07:00`);
}

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
    include: {
      customer: {
        select: {
          lineUserId: true,
          membership: {
            select: { expiresAt: true, usagesUsed: true, usagesAllowed: true, pendingActivation: true },
          },
        },
      },
    },
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
 * Body: { lineUserId, branchId?, serviceId?, date?, startTime?, addonIds?, notes? }
 * Allows the customer to update booking details. Recomputes duration, availability,
 * add-on snapshots and entitlement-aware pricing authoritatively on the server.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { lineUserId, branchId, serviceId, date, startTime, addonIds, notes } = body;

    const auth = await authorize(id, lineUserId ?? null);
    if ("error" in auth) return auth.error;
    const { booking } = auth;

    if (booking.status === "COMPLETED" || booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      return NextResponse.json({ error: "Booking cannot be modified in its current state" }, { status: 400 });
    }

    const newBranchId = branchId ?? booking.branchId;
    const newServiceId = serviceId ?? booking.serviceId;
    const newStartTime = startTime ?? booking.startTime;
    const newDate = date ?? booking.date.toISOString().slice(0, 10);

    if (SALE_ONLY_SKUS.includes(newServiceId)) {
      return NextResponse.json({ error: "This item cannot be booked as an appointment" }, { status: 400 });
    }

    // Look up BranchService to get duration + price for the (possibly new) branch
    const bs = await prisma.branchService.findUnique({
      where: { branchId_serviceId: { branchId: newBranchId, serviceId: newServiceId } },
      include: { service: true },
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
      online: true,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "Time slot not available", scheduledCount: result.scheduledCount, occupiedCount: result.occupiedCount },
        { status: 409 },
      );
    }

    const requestedAddonIds = Array.isArray(addonIds)
      ? [...new Set(addonIds.filter((value): value is string => typeof value === "string"))]
      : null;
    const addonOptions = requestedAddonIds
      ? await prisma.serviceAddon.findMany({
          where: { id: { in: requestedAddonIds }, isActive: true },
          select: { id: true, price: true },
        })
      : await prisma.bookingAddon.findMany({
          where: { bookingId: id },
          select: { addonId: true, price: true },
        }).then(rows => rows.map(row => ({ id: row.addonId, price: row.price })));
    if (requestedAddonIds && addonOptions.length !== requestedAddonIds.length) {
      return NextResponse.json({ error: "One or more add-ons are unavailable" }, { status: 400 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const membership = booking.customer.membership;
    const hasActiveMembership = !!membership
      && !membership.pendingActivation
      && (!membership.expiresAt || membership.expiresAt >= today)
      && (membership.usagesAllowed === 0 || membership.usagesUsed < membership.usagesAllowed);
    const hasActivePackage = (await findActivePackages(booking.customerId)).length > 0;
    const hasMemberPricing = hasActiveMembership || hasActivePackage;
    const configuredMemberPrice = bs.service.memberPrice != null && bs.service.memberPrice > 0
      ? bs.service.memberPrice
      : bs.service.memberDiscountPercent > 0
        ? Math.round(bs.price * (1 - bs.service.memberDiscountPercent / 100))
        : bs.price;
    const promotionalPrice = getPromotionServicePrice(newServiceId, newDate, hasMemberPricing);
    const servicePrice = promotionalPrice ?? (hasMemberPricing ? Math.min(bs.price, configuredMemberPrice) : bs.price);
    const newTotal = servicePrice + addonOptions.reduce((sum, addon) => sum + addon.price, 0);
    const nextNotes = notes === undefined ? booking.notes : String(notes).trim().slice(0, 1000) || null;

    const updated = await prisma.$transaction(async (tx) => {
      if (requestedAddonIds) {
        await tx.bookingAddon.deleteMany({ where: { bookingId: id } });
        if (addonOptions.length > 0) {
          await tx.bookingAddon.createMany({
            data: addonOptions.map(addon => ({ bookingId: id, addonId: addon.id, price: addon.price })),
          });
        }
      }
      const result = await tx.booking.update({
        where: { id },
        data: {
          branchId:   newBranchId,
          serviceId:  newServiceId,
          date:       new Date(newDate + "T12:00:00"),
          startTime:  newStartTime,
          endTime:    newEndTime,
          totalPrice: newTotal,
          notes:      nextNotes,
          // Clear specific staff assignment when branch changes — admin will re-assign
          ...(branchId && branchId !== booking.branchId ? { staffId: null } : {}),
        },
        select: {
          id: true, branchId: true, serviceId: true, staffId: true, customerId: true,
          date: true, startTime: true, endTime: true, status: true, notes: true,
          totalPrice: true, createdAt: true, updatedAt: true,
          branch: true, service: true, staff: true, customer: true,
          addons: { include: { addon: true } },
        },
      });
      return result;
    });

    // Refresh the branch group's today-list when the customer moved the slot
    // (time, date, or branch). No-op for non-today or already-past slots.
    const movedTime   = newStartTime !== booking.startTime;
    const movedDate   = newDate !== booking.date.toISOString().slice(0, 10);
    const movedBranch = newBranchId !== booking.branchId;
    const changedDetails = newServiceId !== booking.serviceId || requestedAddonIds !== null || notes !== undefined;
    if (movedTime || movedDate || movedBranch || changedDetails) {
      sendGroupBookingNotice(id, "changed")
        .catch(e => console.error("[notify] group time changed failed", e));
    }

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
    const startsAt = bookingStartsAt(auth.booking.date, auth.booking.startTime);
    if (!Number.isFinite(startsAt) || startsAt - Date.now() <= CANCELLATION_CUTOFF_MS) {
      return NextResponse.json(
        {
          error: "cancellation_cutoff",
          message: "ไม่สามารถยกเลิกออนไลน์ภายใน 30 นาทีก่อนเวลานัด กรุณาติดต่อแอดมิน",
        },
        { status: 409 },
      );
    }

    await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Notify staff (and confirm to the customer) — the customer cancelled it themselves.
    sendBookingCancelled(id, { byCustomer: true })
      .catch(e => console.error("[notify] booking cancelled failed", e));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
