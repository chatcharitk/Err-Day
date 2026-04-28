/**
 * Capacity & availability — single source of truth.
 *
 * Core rule
 * ---------
 *   bookable( branch, date, [start, end] )
 *     = (# staff on shift covering the window)
 *       − (# staff occupied by overlapping bookings, including unassigned bookings)
 *     > 0
 *
 * Notes
 * -----
 * • A booking with `staffId === null` still consumes one unit of capacity (the
 *   admin will pick a stylist later, but the slot is taken).
 * • If NO shifts at all are defined for the branch on the given date, we fall
 *   back to "every active staff at the branch is available" so the system
 *   keeps working before any shifts have been entered.
 * • We treat the requested window as available for a staff member only if
 *   their shift fully covers it (booking can't span past their off-time).
 */

import { prisma } from "@/lib/prisma";

// ── Time helpers ──────────────────────────────────────────────────────────────

export function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function addMinutes(time: string, minutes: number): string {
  const total = timeToMins(time) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMins(aStart) < timeToMins(bEnd) && timeToMins(aEnd) > timeToMins(bStart);
}

/** True iff the shift fully covers [windowStart, windowEnd]. */
export function shiftCovers(
  shiftStart: string, shiftEnd: string,
  windowStart: string, windowEnd: string,
): boolean {
  return timeToMins(shiftStart) <= timeToMins(windowStart)
      && timeToMins(shiftEnd)   >= timeToMins(windowEnd);
}

function dayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ── Default open slot grid ────────────────────────────────────────────────────

export const ALL_SLOTS = [
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30",
];

// ── Day snapshot — fetch shifts + bookings + active staff for one branch/day ──

export interface DaySnapshot {
  /** All active staff at the branch (used as legacy fallback when no shifts exist). */
  activeStaffIds: string[];
  /** Whether *any* shifts are defined for this branch on this date. */
  hasShifts: boolean;
  /** Shifts of branch staff for this date. */
  shifts: { staffId: string; startTime: string; endTime: string }[];
  /** Non-cancelled bookings for this branch on this date (excluding excludeBookingId). */
  bookings: { id: string; startTime: string; endTime: string; staffId: string | null }[];
}

export async function loadDaySnapshot(
  branchId: string,
  date: string,
  excludeBookingId?: string,
): Promise<DaySnapshot> {
  const { start, end } = dayBounds(date);

  const activeStaff = await prisma.staff.findMany({
    where: { branchId, isActive: true },
    select: { id: true },
  });
  const activeStaffIds = activeStaff.map((s) => s.id);

  const [shifts, bookings] = await Promise.all([
    activeStaffIds.length === 0
      ? Promise.resolve([])
      : prisma.staffShift.findMany({
          where: { staffId: { in: activeStaffIds }, date: { gte: start, lte: end } },
          select: { staffId: true, startTime: true, endTime: true },
        }),
    prisma.booking.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
        status: { notIn: ["CANCELLED"] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true, staffId: true },
    }),
  ]);

  return { activeStaffIds, hasShifts: shifts.length > 0, shifts, bookings };
}

// ── Capacity check (single window) ────────────────────────────────────────────

export type ConflictReason = "no_capacity" | "selected_staff_busy" | "selected_staff_off_shift";

export interface CapacityResult {
  ok: boolean;
  reason?: ConflictReason;
  scheduledCount: number;
  occupiedCount: number;
}

/** Pure logic — given a snapshot, decide whether a window is bookable. */
export function evaluateCapacity(
  snapshot: DaySnapshot,
  startTime: string,
  endTime: string,
  staffId: string | null = null,
): CapacityResult {
  const { activeStaffIds, hasShifts, shifts, bookings } = snapshot;

  // Staff scheduled to cover the window
  const scheduledIds = hasShifts
    ? new Set(
        shifts
          .filter((s) => shiftCovers(s.startTime, s.endTime, startTime, endTime))
          .map((s) => s.staffId),
      )
    : new Set(activeStaffIds);

  // Bookings overlapping the window
  const conflicting = bookings.filter((b) => overlaps(startTime, endTime, b.startTime, b.endTime));

  if (staffId) {
    if (!scheduledIds.has(staffId)) {
      return { ok: false, reason: "selected_staff_off_shift", scheduledCount: scheduledIds.size, occupiedCount: 0 };
    }
    if (conflicting.some((b) => b.staffId === staffId)) {
      return { ok: false, reason: "selected_staff_busy", scheduledCount: scheduledIds.size, occupiedCount: 0 };
    }
    return { ok: true, scheduledCount: scheduledIds.size, occupiedCount: 0 };
  }

  // No specific staff — count occupied (assigned + unassigned bookings)
  const assignedBusy = new Set(conflicting.filter((b) => b.staffId).map((b) => b.staffId)).size;
  const unassigned   = conflicting.filter((b) => !b.staffId).length;
  const occupied     = assignedBusy + unassigned;

  if (scheduledIds.size === 0) {
    return { ok: false, reason: "no_capacity", scheduledCount: 0, occupiedCount: occupied };
  }
  if (occupied >= scheduledIds.size) {
    return { ok: false, reason: "no_capacity", scheduledCount: scheduledIds.size, occupiedCount: occupied };
  }
  return { ok: true, scheduledCount: scheduledIds.size, occupiedCount: occupied };
}

/** Convenience: load snapshot and evaluate a single window. */
export async function checkCapacity(args: {
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  staffId?: string | null;
  excludeBookingId?: string;
}): Promise<CapacityResult> {
  const snapshot = await loadDaySnapshot(args.branchId, args.date, args.excludeBookingId);
  return evaluateCapacity(snapshot, args.startTime, args.endTime, args.staffId ?? null);
}

// ── Slot grid (used by /api/availability) ─────────────────────────────────────

export async function getTakenSlots(
  branchId: string,
  date: string,
  duration: number,
  staffId: string | null = null,
  excludeBookingId?: string,
): Promise<string[]> {
  const snapshot = await loadDaySnapshot(branchId, date, excludeBookingId);
  const taken: string[] = [];
  for (const slot of ALL_SLOTS) {
    const slotEnd = addMinutes(slot, duration);
    const result = evaluateCapacity(snapshot, slot, slotEnd, staffId);
    if (!result.ok) taken.push(slot);
  }
  return taken;
}
