import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { timeToMins } from "@/lib/capacity";

/**
 * GET /api/admin/staff/[id]/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * List a staff member's shifts within an optional date range.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    dateFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    dateFilter.lte = d;
  }

  const shifts = await prisma.staffShift.findMany({
    where: {
      staffId: id,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(shifts);
}

/**
 * POST /api/admin/staff/[id]/shifts
 * Body: { date: "YYYY-MM-DD", startTime: "HH:mm", endTime: "HH:mm" }
 * Creates a shift for a staff member.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const { date, startTime, endTime } = body as { date: string; startTime: string; endTime: string };

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing date / startTime / endTime" }, { status: 400 });
    }
    if (timeToMins(startTime) >= timeToMins(endTime)) {
      return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

    // Replace any existing shift that OVERLAPS the new window on this day. The
    // (staffId,date,startTime) unique key only blocks an exact-start duplicate,
    // so editing a shift used to STACK a second overlapping row (e.g. 10:00–21:00
    // + 12:00–21:00), making the staff cover extra time slots and inflating
    // capacity. Non-overlapping split shifts (with a real gap) are preserved.
    const [yy, mm, dd] = date.split("-").map(Number);
    const dayStart = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0));
    const dayEnd   = new Date(Date.UTC(yy, mm - 1, dd, 23, 59, 59, 999));

    const shift = await prisma.$transaction(async (tx) => {
      const sameDay = await tx.staffShift.findMany({
        where:  { staffId: id, date: { gte: dayStart, lte: dayEnd } },
        select: { id: true, startTime: true, endTime: true },
      });
      const overlapIds = sameDay
        .filter(s => timeToMins(s.startTime) < timeToMins(endTime) && timeToMins(s.endTime) > timeToMins(startTime))
        .map(s => s.id);
      if (overlapIds.length > 0) {
        await tx.staffShift.deleteMany({ where: { id: { in: overlapIds } } });
      }
      return tx.staffShift.create({
        data: {
          staffId:   id,
          date:      new Date(date + "T12:00:00"), // noon local — same convention as bookings
          startTime,
          endTime,
        },
      });
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    // Prisma unique constraint violation = duplicate shift on this date+start
    const isDup = error instanceof Error && error.message.includes("Unique constraint");
    if (isDup) {
      return NextResponse.json({ error: "A shift starting at this time already exists for this staff/date" }, { status: 409 });
    }
    console.error("Create shift error:", error);
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  }
}
