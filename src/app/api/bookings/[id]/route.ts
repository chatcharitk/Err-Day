import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmed, sendBookingTimeChanged, sendBookingCancelled, sendGroupBookingNotice } from "@/lib/notifications";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { branch: true, service: true, staff: true, customer: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status, staffId, notes, startTime, endTime, totalPrice, serviceId, date,
      completedAt, receiptUrl,
      extraStaffIds, customerId: newCustomerId, branchId: newBranchId,
    } = body;

    // Capture previous fields we need to compare after the update
    const needsPrev = status !== undefined || startTime !== undefined || endTime !== undefined;
    const prev = needsPrev
      ? await prisma.booking.findUnique({ where: { id }, select: { status: true, startTime: true, endTime: true, customerId: true } })
      : null;

    // Update extra staff if provided
    if (Array.isArray(extraStaffIds)) {
      await prisma.bookingStaff.deleteMany({ where: { bookingId: id } });
      if (extraStaffIds.length > 0) {
        await prisma.bookingStaff.createMany({
          data: extraStaffIds.map((sid: string) => ({ bookingId: id, staffId: sid })),
          skipDuplicates: true,
        });
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(status         !== undefined ? { status }                                : {}),
        ...(staffId        !== undefined ? { staffId: staffId || null }              : {}),
        ...(notes          !== undefined ? { notes: notes || null }                  : {}),
        ...(startTime      !== undefined ? { startTime }                             : {}),
        ...(endTime        !== undefined ? { endTime }                               : {}),
        ...(totalPrice     !== undefined ? { totalPrice: Number(totalPrice) }        : {}),
        ...(serviceId      !== undefined ? { serviceId }                             : {}),
        ...(date           !== undefined ? { date: new Date(date + "T12:00:00") }   : {}),
        ...(newBranchId    !== undefined ? { branchId: newBranchId }                : {}),
        ...(newCustomerId  !== undefined ? { customerId: newCustomerId }            : {}),
        ...(completedAt    !== undefined ? { completedAt: completedAt ? new Date(completedAt) : null } : {}),
        ...(receiptUrl     !== undefined ? {
          receiptUrl: receiptUrl || null,
          receiptUploadedAt: receiptUrl ? new Date() : null,
        } : {}),
      },
      include: { branch: true, service: true, staff: true, customer: true },
    });

    // Fire-and-forget LINE confirmation when status flips to CONFIRMED.
    if (status === "CONFIRMED" && prev?.status !== "CONFIRMED") {
      sendBookingConfirmed(booking.id).catch(e => console.error("[notify] booking confirmed failed", e));
    }

    // Notify customer + staff when the booking is cancelled by the shop.
    if (status === "CANCELLED" && prev?.status !== "CANCELLED") {
      sendBookingCancelled(booking.id).catch(e => console.error("[notify] booking cancelled failed", e));
    }

    // Notify customer + refresh the branch group's today-list when start time
    // changes (admin reschedule). The group notice is a no-op for non-today or
    // already-past slots.
    if (prev && startTime !== undefined && startTime !== prev.startTime) {
      sendBookingTimeChanged(booking.id, prev.startTime, prev.endTime)
        .catch(e => console.error("[notify] time changed failed", e));
      sendGroupBookingNotice(booking.id, "changed")
        .catch(e => console.error("[notify] group time changed failed", e));
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
