import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/slips/[id]
 * Body: { action: "confirm", bookingId? } | { action: "dismiss" }
 *
 * confirm — attach the slip to the booking as its receipt and check the
 * booking out (status COMPLETED). bookingId in the body overrides the
 * auto-suggested one; one of the two must exist.
 * dismiss — mark the slip handled without touching any booking (e.g. a
 * non-payment image that slipped through, or a slip already processed).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const { id } = await params;
    const body = await request.json() as { action?: string; bookingId?: string };

    const slip = await prisma.paymentSlip.findUnique({ where: { id } });
    if (!slip) return NextResponse.json({ error: "ไม่พบสลิป" }, { status: 404 });
    if (slip.status !== "PENDING") {
      return NextResponse.json({ error: "สลิปนี้ถูกจัดการไปแล้ว", alreadyHandled: true }, { status: 409 });
    }

    if (body.action === "dismiss") {
      const updated = await prisma.paymentSlip.update({
        where: { id },
        data:  { status: "DISMISSED", confirmedBy: admin.username, confirmedAt: new Date() },
      });
      return NextResponse.json({ ok: true, slip: { id: updated.id, status: updated.status } });
    }

    if (body.action !== "confirm") {
      return NextResponse.json({ error: "action must be confirm or dismiss" }, { status: 400 });
    }

    const bookingId = body.bookingId || slip.bookingId;
    if (!bookingId) {
      return NextResponse.json({ error: "กรุณาเลือกคิวที่สลิปนี้ชำระ" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, status: true, completedAt: true },
    });
    if (!booking) return NextResponse.json({ error: "ไม่พบคิวที่เลือก" }, { status: 404 });
    if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      return NextResponse.json({ error: "คิวนี้ถูกยกเลิกแล้ว — เลือกคิวอื่น" }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          receiptUrl:        slip.imageUrl,
          receiptUploadedAt: now,
          status:            "COMPLETED",
          // Preserve an existing completion time if the booking was already
          // checked out and we're just attaching the receipt.
          completedAt: booking.completedAt ?? now,
        },
      }),
      prisma.paymentSlip.update({
        where: { id },
        data: {
          status:      "CONFIRMED",
          bookingId,
          confirmedBy: admin.username,
          confirmedAt: now,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slip review error:", error);
    return NextResponse.json({ error: "Failed to update slip" }, { status: 500 });
  }
}
