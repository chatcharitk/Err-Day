import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/branches/[id]/blocked-slots?date=YYYY-MM-DD */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id: branchId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const slots = await prisma.blockedSlot.findMany({
    where: { branchId, date },
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ slots });
}

/** POST /api/admin/branches/[id]/blocked-slots */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id: branchId } = await params;
  const body = await request.json();
  const { date, startTime, endTime, staffId, reason } = body;

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }

  const slot = await prisma.blockedSlot.create({
    data: {
      branchId,
      staffId: staffId || null,
      date,
      startTime,
      endTime,
      reason: reason || null,
    },
    include: { staff: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ slot }, { status: 201 });
}
