import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

/**
 * Undo one step — for fixing mis-taps at the counter:
 *   • DONE (COMPLETED)        → back to in-service (clear completedAt)
 *   • IN_SERVICE (checked in) → back to waiting    (clear checkedInAt)
 * staffId is left intact so a pre-assigned stylist isn't lost; the per-staff
 * count ignores rows with no checkedInAt, so clearing it is enough.
 */
export async function POST(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const { bookingId } = await request.json().catch(() => ({}));
  if (typeof bookingId !== "string") {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, branchId: true, status: true, checkedInAt: true },
  });
  if (!booking || booking.branchId !== branch.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "COMPLETED") {
    await prisma.booking.update({
      where: { id: bookingId },
      data:  { status: "CONFIRMED", completedAt: null },
    });
  } else if (booking.checkedInAt) {
    await prisma.booking.update({
      where: { id: bookingId },
      data:  { checkedInAt: null },
    });
  }
  // else: already at waiting — nothing to undo.

  return NextResponse.json({ ok: true });
}
