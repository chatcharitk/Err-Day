/**
 * Daily capacity breakdown for the admin Capacity page.
 *
 * GET /api/admin/capacity?branchId=...&date=YYYY-MM-DD
 *
 * Returns the hourly timeline for one branch on one day, showing for each
 * hour the # of staff on shift, # of overlapping bookings, the effective
 * online cap, available online slots, and a status flag.
 */
import { NextResponse } from "next/server";
import { loadDaySnapshot, timeToMins, shiftCovers } from "@/lib/capacity";

interface HourRow {
  hour:        string;   // "HH:00"
  endHour:     string;   // "HH:00" (one hour later)
  staffOnShift: number;
  bookings:    number;
  /** Effective online cap for this hour = min(onlineCap ?? Inf, staffOnShift). */
  onlineCap:   number;
  /** Slots still available for ONLINE bookings (after walk-in / hard cap). */
  available:   number;
  /** "open" | "tight" (<=1 left) | "full" (=0) | "over" (over capacity). */
  status:      "open" | "tight" | "full" | "over";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  const date     = url.searchParams.get("date");
  if (!branchId || !date) {
    return NextResponse.json({ error: "branchId and date are required" }, { status: 400 });
  }

  const snapshot = await loadDaySnapshot(branchId, date);

  // Bangkok day-of-week (0=Sun) — Sunday opens at 10:00, otherwise 08:00
  const [y, mo, d] = date.split("-").map(Number);
  const dow        = new Date(y, mo - 1, d).getDay();
  const openHour   = dow === 0 ? 10 : 8;
  const closeHour  = 21; // 21:00 (last bookable hour is 20:00–21:00)

  const rows: HourRow[] = [];

  for (let h = openHour; h < closeHour; h++) {
    const hour    = `${String(h).padStart(2, "0")}:00`;
    const endHour = `${String(h + 1).padStart(2, "0")}:00`;

    // # staff scheduled to cover the FULL hour (start..start+60min)
    const staffOnShift = snapshot.hasShifts
      ? snapshot.shifts.filter(s => shiftCovers(s.startTime, s.endTime, hour, endHour)).length
      : snapshot.activeStaffIds.length;

    // # overlapping bookings (uses any-overlap rule, same as evaluateCapacity)
    const overlapping = snapshot.bookings.filter(b =>
      timeToMins(b.startTime) < timeToMins(endHour)
      && timeToMins(b.endTime) > timeToMins(hour),
    ).length;

    // Effective online cap = min(branch.onlineCap, staffOnShift)
    const cap = snapshot.onlineCap != null
      ? Math.min(snapshot.onlineCap, staffOnShift)
      : staffOnShift;
    const available = Math.max(0, cap - overlapping);

    let status: HourRow["status"];
    if (overlapping > cap)       status = "over";
    else if (overlapping === cap) status = "full";
    else if (cap - overlapping <= 1) status = "tight";
    else                          status = "open";

    rows.push({
      hour, endHour, staffOnShift, bookings: overlapping,
      onlineCap: cap, available, status,
    });
  }

  // Daily summary
  const totalBookings  = snapshot.bookings.length;
  const peakBookings   = rows.reduce((m, r) => Math.max(m, r.bookings), 0);
  const overHours      = rows.filter(r => r.status === "over").length;
  const tightHours     = rows.filter(r => r.status === "tight" || r.status === "full").length;

  return NextResponse.json({
    branchId,
    date,
    onlineCap:  snapshot.onlineCap,
    hasShifts:  snapshot.hasShifts,
    rows,
    summary: { totalBookings, peakBookings, overHours, tightHours },
  });
}
