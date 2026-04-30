import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTakenSlots } from "@/lib/capacity";

/**
 * GET /api/availability?branchId=...&date=YYYY-MM-DD&duration=60[&staffId=...]
 * Returns the slots that are NOT bookable due to staff-capacity rules.
 *
 * Rule: a slot is bookable when (staff on shift covering the slot) > (overlapping bookings).
 * If no shifts are defined for the branch on this date, every active staff member is
 * treated as available (legacy fallback so the system works pre-shift-config).
 *
 * Open hours are read from the Branch record:
 *   Mon–Sat → branch.openTime  (default "08:00")
 *   Sunday  → "10:00" override
 *   Close   → branch.closeTime (default "21:00")
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const date     = searchParams.get("date");
  const staffId  = searchParams.get("staffId") || null;
  const duration = parseInt(searchParams.get("duration") ?? "60");

  if (!branchId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Detect Sunday from the date string (parse as local date to avoid UTC offset issues)
  const [yr, mo, dy] = date.split("-").map(Number);
  const isSunday = new Date(yr, mo - 1, dy).getDay() === 0;

  // Fetch branch open/close hours
  const branch = await prisma.branch.findUnique({
    where:  { id: branchId },
    select: { openTime: true, closeTime: true },
  });

  const openTime  = isSunday ? "10:00" : (branch?.openTime  ?? "08:00");
  const closeTime = branch?.closeTime ?? "21:00";

  const taken = await getTakenSlots(branchId, date, duration, staffId, undefined, openTime, closeTime);
  return NextResponse.json({ taken });
}
