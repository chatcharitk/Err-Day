import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_SLOTS, evaluateCapacity, loadDaySnapshot, addMinutes } from "@/lib/capacity";

/**
 * GET /api/admin/branches/[id]/schedule?date=YYYY-MM-DD
 * Returns a per-slot capacity report for one day, useful for admin dashboards.
 *
 * Response:
 *   {
 *     date,
 *     branchId,
 *     staff: [{ id, name, shifts: [{startTime, endTime}] }],
 *     slots: [{ time, scheduledCount, occupiedCount, free, ok }]
 *   }
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: branchId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const [staff, snapshot] = await Promise.all([
    prisma.staff.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shifts: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          select: { id: true, startTime: true, endTime: true },
          orderBy: { startTime: "asc" },
        },
      },
    }),
    loadDaySnapshot(branchId, date),
  ]);

  // Default to 60-minute slots for the dashboard view (per requirement: "1 hour for now").
  const slots = ALL_SLOTS.filter((s, i) => i % 2 === 0).map((time) => {
    const end = addMinutes(time, 60);
    const r = evaluateCapacity(snapshot, time, end);
    return {
      time,
      endTime: end,
      scheduledCount: r.scheduledCount,
      occupiedCount:  r.occupiedCount,
      free:           Math.max(0, r.scheduledCount - r.occupiedCount),
      ok:             r.ok,
    };
  });

  return NextResponse.json({
    date,
    branchId,
    hasShifts: snapshot.hasShifts,
    staff,
    slots,
  });
}
