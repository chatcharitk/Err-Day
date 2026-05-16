import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSlotAvailability } from "@/lib/capacity";

/**
 * GET /api/availability?branchId=...&date=YYYY-MM-DD&duration=60[&staffId=...]
 *
 * Response:
 *   { taken: string[], past: string[] }
 *
 * `taken` = slots that overlap with existing bookings or hit capacity caps.
 * `past`  = slots whose start time has already passed (today only).
 *
 * The UI should display the two reasons differently so customers understand
 * why a slot is unavailable. The legacy `taken` field used to combine both —
 * old clients that read only `taken` will see slightly fewer disabled slots
 * but the booking POST endpoint still enforces both rules server-side.
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

  const { taken, past } = await getSlotAvailability(branchId, date, duration, staffId, undefined, openTime, closeTime);
  return NextResponse.json({ taken, past });
}
