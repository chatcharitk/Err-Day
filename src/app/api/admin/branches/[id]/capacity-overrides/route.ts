/**
 * Per-branch capacity overrides.
 *
 * GET    /api/admin/branches/[id]/capacity-overrides
 *        → list all overrides for the branch (date-specific + recurring)
 *
 * POST   /api/admin/branches/[id]/capacity-overrides
 *        body: { date?: "YYYY-MM-DD", dayOfWeek?: 0-6, startTime, endTime, capacity, note? }
 *        Exactly one of `date` / `dayOfWeek` must be provided.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseTime(t: unknown): string | null {
  if (typeof t !== "string") return null;
  if (!/^\d{2}:\d{2}$/.test(t)) return null;
  return t;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.capacityOverride.findMany({
    where:   { branchId: id },
    orderBy: [{ date: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(
    rows.map(r => ({
      id:        r.id,
      date:      r.date ? r.date.toISOString().slice(0, 10) : null,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime:   r.endTime,
      capacity:  r.capacity,
      note:      r.note,
    })),
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { date, dayOfWeek, startTime, endTime, capacity, note } = body;

  const start = parseTime(startTime);
  const end   = parseTime(endTime);
  if (!start || !end) {
    return NextResponse.json({ error: "startTime / endTime must be 'HH:mm'" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }
  if (typeof capacity !== "number" || capacity < 0 || !Number.isInteger(capacity)) {
    return NextResponse.json({ error: "capacity must be a non-negative integer" }, { status: 400 });
  }

  const hasDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const hasDow  = typeof dayOfWeek === "number" && dayOfWeek >= 0 && dayOfWeek <= 6;
  if (hasDate === hasDow) {
    return NextResponse.json(
      { error: "Provide exactly one of `date` (YYYY-MM-DD) or `dayOfWeek` (0-6)" },
      { status: 400 },
    );
  }

  const row = await prisma.capacityOverride.create({
    data: {
      branchId:  id,
      date:      hasDate ? new Date(date + "T12:00:00Z") : null,
      dayOfWeek: hasDow  ? dayOfWeek                     : null,
      startTime: start,
      endTime:   end,
      capacity,
      note:      typeof note === "string" && note.trim() ? note.trim() : null,
    },
  });

  return NextResponse.json({
    id:        row.id,
    date:      row.date ? row.date.toISOString().slice(0, 10) : null,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime:   row.endTime,
    capacity:  row.capacity,
    note:      row.note,
  }, { status: 201 });
}
