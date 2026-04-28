import { NextResponse } from "next/server";
import { getTakenSlots } from "@/lib/capacity";

/**
 * GET /api/availability?branchId=...&date=YYYY-MM-DD&duration=60[&staffId=...]
 * Returns the slots that are NOT bookable due to staff-capacity rules.
 *
 * Rule: a slot is bookable when (staff on shift covering the slot) > (overlapping bookings).
 * If no shifts are defined for the branch on this date, every active staff member is
 * treated as available (legacy fallback so the system works pre-shift-config).
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

  const taken = await getTakenSlots(branchId, date, duration, staffId);
  return NextResponse.json({ taken });
}
