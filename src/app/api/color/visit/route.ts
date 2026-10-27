import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bangkokNoon, cleanZones, colorActor } from "@/lib/color";

/**
 * POST /api/color/visit — start a colour record for one job.
 *   { customerId, bookingId?, branchId?, copyFrom?: visitId }
 * Opening the same appointment again returns its existing record.
 */
export async function POST(request: Request) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => null) as { customerId?: string; bookingId?: string; branchId?: string; copyFrom?: string } | null;
  if (!b?.customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (b.bookingId) {
    const existing = await prisma.colorVisit.findUnique({ where: { bookingId: b.bookingId }, select: { id: true } });
    if (existing) return NextResponse.json({ id: existing.id });
  }
  const booking = b.bookingId
    ? await prisma.booking.findFirst({ where: { id: b.bookingId, customerId: b.customerId }, select: { id: true, date: true, branchId: true, staffId: true, staff: { select: { name: true } } } })
    : null;
  const branchId = booking?.branchId ?? b.branchId ?? actor.branchId;
  if (!branchId || !await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } })) {
    return NextResponse.json({ error: "เลือกสาขาก่อน" }, { status: 400 });
  }

  const source = b.copyFrom
    ? await prisma.colorVisit.findFirst({ where: { id: b.copyFrom, customerId: b.customerId }, select: { zones: true, serviceTypes: true, targetLevel: true, otherProducts: true } })
    : null;
  const zones = source ? cleanZones(source.zones).map(z => ({ ...z, startedAt: null, rinsedAt: null })) : [];
  const visitNo = (await prisma.colorVisit.count({ where: { customerId: b.customerId } })) + 1;

  const v = await prisma.colorVisit.create({
    data: {
      customerId: b.customerId, bookingId: booking?.id ?? null, branchId,
      staffId: booking?.staffId ?? actor.staffId ?? null, stylistName: booking?.staff?.name ?? actor.name,
      visitNo, date: booking?.date ?? bangkokNoon(),
      serviceTypes: source?.serviceTypes ?? [], targetLevel: source?.targetLevel ?? null, otherProducts: source?.otherProducts ?? null,
      zones, createdBy: actor.name,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: v.id });
}
