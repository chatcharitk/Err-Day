import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timeToMins } from "@/lib/capacity";

/**
 * GET /api/admin/staff/[id]/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * List a staff member's shifts within an optional date range.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const shift = await prisma.staffShift.create({
      data: {
        staffId:   id,
        date:      new Date(date + "T12:00:00"), // noon local — same convention as bookings
        startTime,
        endTime,
      },
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
