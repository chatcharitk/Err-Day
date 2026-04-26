import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(slotStart: string, duration: number, bookStart: string, bookEnd: string): boolean {
  const s = timeToMins(slotStart);
  const bS = timeToMins(bookStart);
  const bE = timeToMins(bookEnd);
  return s < bE && s + duration > bS;
}

const ALL_SLOTS = [
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const date = searchParams.get("date");
  const staffId = searchParams.get("staffId") || null;
  const duration = parseInt(searchParams.get("duration") ?? "60");

  if (!branchId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      branchId,
      date: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED"] },
      ...(staffId ? { staffId } : {}),
    },
    select: { startTime: true, endTime: true, staffId: true },
  });

  const taken: string[] = [];

  if (staffId) {
    for (const slot of ALL_SLOTS) {
      if (bookings.some((b) => overlaps(slot, duration, b.startTime, b.endTime))) {
        taken.push(slot);
      }
    }
  } else {
    // Slot is unavailable only if ALL staff are booked at that time
    const staffCount = await prisma.staff.count({ where: { branchId } });
    if (staffCount > 0) {
      for (const slot of ALL_SLOTS) {
        const conflicting = bookings.filter((b) => overlaps(slot, duration, b.startTime, b.endTime));
        const uniqueStaffBooked = new Set(conflicting.filter((b) => b.staffId).map((b) => b.staffId)).size;
        const nullStaffBooked = conflicting.filter((b) => !b.staffId).length;
        if (uniqueStaffBooked + nullStaffBooked >= staffCount) {
          taken.push(slot);
        }
      }
    }
  }

  return NextResponse.json({ taken });
}
