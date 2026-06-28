import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

/**
 * Check-in: a staff member taps their name as the customer arrives. Records
 * them as the serving stylist (overriding any pre-assigned one — "whoever taps
 * gets credit") and stamps checkedInAt. A PENDING booking is promoted to
 * CONFIRMED. Branch-scoped via the kiosk cookie.
 */
export async function POST(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const { bookingId, staffId } = await request.json().catch(() => ({}));
  if (typeof bookingId !== "string" || typeof staffId !== "string") {
    return NextResponse.json({ error: "bookingId and staffId are required" }, { status: 400 });
  }

  const [booking, staff] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, branchId: true, status: true } }),
    prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, branchId: true, isActive: true } }),
  ]);

  if (!booking || booking.branchId !== branch.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!staff || staff.branchId !== branch.id || !staff.isActive) {
    return NextResponse.json({ error: "Staff not found at this branch" }, { status: 400 });
  }
  if (booking.status === "COMPLETED") {
    return NextResponse.json({ error: "รายการนี้เสร็จสิ้นแล้ว" }, { status: 409 });
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      staffId,
      checkedInAt: new Date(),
      ...(booking.status === "PENDING" ? { status: "CONFIRMED" } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
