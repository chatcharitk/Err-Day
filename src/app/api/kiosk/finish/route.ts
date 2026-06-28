import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

/**
 * Finished: the service is done. Flips the booking to COMPLETED (counts toward
 * sales + commission). Payment stays in the existing POS / LINE-slip flow.
 * Branch-scoped via the kiosk cookie.
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
    select: { id: true, branchId: true, checkedInAt: true, completedAt: true },
  });
  if (!booking || booking.branchId !== branch.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const now = new Date();
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "COMPLETED",
      completedAt: booking.completedAt ?? now,
      // Guard: if finished straight from waiting (no check-in tap), stamp arrival
      // too so it still counts toward the serving staff's load.
      ...(booking.checkedInAt ? {} : { checkedInAt: now }),
    },
  });

  return NextResponse.json({ ok: true });
}
