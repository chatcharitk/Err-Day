import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";

/**
 * ค่าเชียร์ from the front-desk board.
 *   POST   { bookingId, serviceId, staffId } — credit `staffId` for cheering this
 *          treatment on this booking (replaces an earlier pick for the same treatment)
 *   DELETE { cheerId } — remove a pick
 * The amount is the service's configured rate, snapshotted. Branch-scoped via
 * the kiosk cookie. Touches the booking so the board's etag refreshes.
 */
async function guard(bookingId: unknown) {
  const branch = await getKioskBranch();
  if (!branch) return { error: NextResponse.json({ error: "Kiosk not armed" }, { status: 401 }) };
  if (typeof bookingId !== "string") return { error: NextResponse.json({ error: "bookingId is required" }, { status: 400 }) };
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, branchId: true } });
  if (!booking || booking.branchId !== branch.id) return { error: NextResponse.json({ error: "Booking not found" }, { status: 404 }) };
  return { branch, booking };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { bookingId?: unknown; serviceId?: unknown; staffId?: unknown };
  const g = await guard(body.bookingId);
  if ("error" in g) return g.error;
  const [service, staff] = await Promise.all([
    typeof body.serviceId === "string" ? prisma.service.findUnique({ where: { id: body.serviceId }, select: { id: true, cheerSatang: true } }) : null,
    typeof body.staffId === "string" ? prisma.staff.findUnique({ where: { id: body.staffId }, select: { id: true, branchId: true, isActive: true } }) : null,
  ]);
  if (!service || service.cheerSatang <= 0) return NextResponse.json({ error: "บริการนี้ไม่มีค่าเชียร์" }, { status: 400 });
  if (!staff || !staff.isActive || staff.branchId !== g.branch.id) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 400 });

  await prisma.$transaction([
    prisma.bookingCheer.deleteMany({ where: { bookingId: g.booking.id, serviceId: service.id } }),
    prisma.bookingCheer.create({ data: { bookingId: g.booking.id, staffId: staff.id, serviceId: service.id, quantity: 1, amountSatang: service.cheerSatang } }),
    prisma.booking.update({ where: { id: g.booking.id }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({})) as { cheerId?: unknown };
  if (typeof body.cheerId !== "string") return NextResponse.json({ error: "cheerId is required" }, { status: 400 });
  const cheer = await prisma.bookingCheer.findUnique({ where: { id: body.cheerId }, select: { id: true, bookingId: true } });
  if (!cheer) return NextResponse.json({ ok: true });
  const g = await guard(cheer.bookingId);
  if ("error" in g) return g.error;
  await prisma.$transaction([
    prisma.bookingCheer.delete({ where: { id: cheer.id } }),
    prisma.booking.update({ where: { id: cheer.bookingId }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}
