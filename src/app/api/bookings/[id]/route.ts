import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import { sendBookingConfirmed, sendBookingTimeChanged, sendBookingCancelled, sendGroupBookingNotice } from "@/lib/notifications";
import { issueReceiptForBooking } from "@/lib/receipts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { branch: true, service: true, staff: true, customer: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status, staffId, notes, internalNotes, startTime, endTime, totalPrice, commissionSatang, serviceId, date,
      completedAt, receiptUrl, paidAt,
      extraStaffIds, customerId: newCustomerId, branchId: newBranchId,
    } = body;

    // Don't let an appointment be turned into a sale-only SKU (membership /
    // package) unless it's also being completed — that would create a phantom
    // appointment. Sale-only sales belong to POS (always COMPLETED).
    if (serviceId !== undefined && SALE_ONLY_SKUS.includes(serviceId) && status !== "COMPLETED") {
      return NextResponse.json(
        { error: "ไม่สามารถเปลี่ยนคิวเป็นแพ็กเกจ/สมาชิกได้ (ขายผ่าน POS เท่านั้น)" },
        { status: 400 },
      );
    }
    if (commissionSatang !== undefined && commissionSatang !== null
      && (!Number.isFinite(Number(commissionSatang)) || Number(commissionSatang) < 0)) {
      return NextResponse.json({ error: "Invalid commission" }, { status: 400 });
    }

    // Capture previous fields we need to compare after the update (paidAt so a
    // receipt upload preserves an earlier payment time instead of re-stamping).
    const needsPrev = status !== undefined || startTime !== undefined || endTime !== undefined
      || !!receiptUrl || paidAt !== undefined;
    const prev = needsPrev
      ? await prisma.booking.findUnique({ where: { id }, select: { status: true, startTime: true, endTime: true, customerId: true, paidAt: true } })
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
        ...(internalNotes  !== undefined ? { internalNotes: internalNotes || null }  : {}),
        ...(startTime      !== undefined ? { startTime }                             : {}),
        ...(endTime        !== undefined ? { endTime }                               : {}),
        ...(totalPrice     !== undefined ? { totalPrice: Number(totalPrice) }        : {}),
        ...(commissionSatang !== undefined
          ? { commissionSatang: commissionSatang === null
              ? null
              : Math.max(0, Math.round(Number(commissionSatang))) }
          : {}),
        ...(serviceId      !== undefined ? { serviceId }                             : {}),
        ...(date           !== undefined ? { date: new Date(date + "T12:00:00") }   : {}),
        ...(newBranchId    !== undefined ? { branchId: newBranchId }                : {}),
        ...(newCustomerId  !== undefined ? { customerId: newCustomerId }            : {}),
        ...(completedAt    !== undefined ? { completedAt: completedAt ? new Date(completedAt) : null } : {}),
        ...(receiptUrl     !== undefined ? {
          receiptUrl: receiptUrl || null,
          receiptUploadedAt: receiptUrl ? new Date() : null,
          // A receipt/slip attached by an admin is payment evidence — stamp
          // paidAt (keeping an earlier payment time). Clearing the receipt
          // leaves paidAt alone; un-pay explicitly via the paidAt field.
          ...(receiptUrl ? { paidAt: prev?.paidAt ?? new Date() } : {}),
        } : {}),
        // Explicit mark-paid / un-paid (admin-only route). Placed after the
        // receipt spread so an explicit value always wins.
        ...(paidAt         !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
      },
      include: { branch: true, service: true, staff: true, customer: true },
    });

    // Payment just recorded (null → set) through any admin path — slip confirm,
    // receipt/slip upload, explicit mark-paid. Awaited rather than fired off:
    // a receipt is a record, not a notification, and it must not be cut short
    // when the function returns. Non-fatal — the payment itself is already saved.
    if (booking.paidAt && !prev?.paidAt) {
      try {
        await issueReceiptForBooking(booking.id, {
          issuedByAdminId: admin.id,
          issuedByName:    admin.name,
        });
      } catch (e) {
        console.error("[receipt] issue on mark-paid failed", e);
      }
    }

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
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
