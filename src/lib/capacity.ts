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
import type { Prisma } from "@/generated/prisma/client";
import { BUFFET_SKU, FIVE_PACK_SKU } from "@/lib/packages";
import { MEMBERSHIP_SKU } from "@/lib/membership";

/** A Prisma client or an interactive-transaction client — so capacity reads can
 *  run inside the same transaction (and advisory lock) as the booking insert. */
type Db = Prisma.TransactionClient;

/**
 * Bookings whose serviceId is a sale-only SKU represent a POS *transaction*
 * (the customer bought a membership or package), not an appointment with a
 * stylist. They shouldn't consume a chair / staff slot — exclude them from
 * the capacity snapshot.
 */
export const SALE_ONLY_SKUS = [MEMBERSHIP_SKU, BUFFET_SKU, FIVE_PACK_SKU];

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

// ── Slot grid helpers ─────────────────────────────────────────────────────────

/**
 * Build a 30-minute slot list from openTime up to (closeTime − 30 min).
 * E.g. generateTimeSlots("08:00","21:00") → ["08:00","08:30",…,"20:30"]
 */
export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const openMin  = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = openMin; t <= closeMin - 30; t += 30) {
    slots.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
    );
  }
  return slots;
}

/** Full default slot grid (Mon–Sat hours). Exported for admin schedule views. */
export const ALL_SLOTS = generateTimeSlots("08:00", "21:00"); // 08:00 … 20:30

// ── Day snapshot — fetch shifts + bookings + active staff for one branch/day ──

export interface DaySnapshot {
  /** Branch id — used for branch-specific online booking caps. */
  branchId: string;
  /**
   * Per-branch concurrency cap for ONLINE bookings (customer-facing only).
   *   null → no cap (use staff-on-shift count)
   *   N    → cap online bookings at N concurrent
   * Admin bookings bypass this cap (skipConflictCheck = true).
   */
  onlineCap: number | null;
  /**
   * Per-time-window overrides for this branch/date. The most specific (date)
   * wins over day-of-week. If a window matches, it overrides `onlineCap` for
   * that slice of the day.
   */
  overrides: { startTime: string; endTime: string; capacity: number; specific: boolean }[];
  /** All active staff at the branch (used as legacy fallback when no shifts exist). */
  activeStaffIds: string[];
  /** Whether *any* shifts are defined for this branch on this date. */
  hasShifts: boolean;
  /** Shifts of branch staff for this date. */
  shifts: { staffId: string; startTime: string; endTime: string }[];
  /** Non-cancelled bookings for this branch on this date (excluding excludeBookingId). */
  bookings: { id: string; startTime: string; endTime: string; staffId: string | null }[];
  /**
   * Admin-created blocked slots.
   *   staffId = null  → whole branch is blocked during this window
   *   staffId = <id>  → only that staff member is blocked
   */
  blockedSlots: { staffId: string | null; startTime: string; endTime: string }[];
}

/**
 * Pick the cap that applies to a given window for this snapshot, in priority order:
 *   1. date-specific override covering the window
 *   2. day-of-week override covering the window
 *   3. branch.onlineCap
 *   4. null (no cap)
 * "Covering" means the override window fully contains the requested window.
 */
export function resolveCap(snapshot: DaySnapshot, startTime: string, endTime: string): number | null {
  const sMin = timeToMins(startTime);
  const eMin = timeToMins(endTime);
  // Try specific (date) first, then non-specific (day-of-week)
  for (const specific of [true, false]) {
    const match = snapshot.overrides.find(o =>
      o.specific === specific
      && timeToMins(o.startTime) <= sMin
      && timeToMins(o.endTime)   >= eMin,
    );
    if (match) return match.capacity;
  }
  return snapshot.onlineCap;
}

export async function loadDaySnapshot(
  branchId: string,
  date: string,
  excludeBookingId?: string,
  db: Db = prisma,
): Promise<DaySnapshot> {
  const { start, end } = dayBounds(date);

  // Day-of-week (0=Sun … 6=Sat) for matching recurring overrides.
  // The `date` string is "YYYY-MM-DD" in Bangkok local time.
  const [yy, mm, dd] = date.split("-").map(Number);
  const dow = new Date(yy, mm - 1, dd).getDay();

  const [branchRow, activeStaff, overrideRows, blockedRows] = await Promise.all([
    db.branch.findUnique({ where: { id: branchId }, select: { onlineCap: true } }),
    db.staff.findMany({ where: { branchId, isActive: true }, select: { id: true } }),
    db.capacityOverride.findMany({
      where: {
        branchId,
        OR: [
          { date: { gte: start, lte: end } },
          { dayOfWeek: dow },
        ],
      },
      select: { date: true, startTime: true, endTime: true, capacity: true },
    }),
    prisma.blockedSlot.findMany({
      where: { branchId, date },
      select: { staffId: true, startTime: true, endTime: true },
    }),
  ]);
  const activeStaffIds = activeStaff.map((s) => s.id);
  const onlineCap      = branchRow?.onlineCap ?? null;
  const overrides      = overrideRows.map(o => ({
    startTime: o.startTime,
    endTime:   o.endTime,
    capacity:  o.capacity,
    specific:  o.date != null,
  }));

  const [shifts, bookings] = await Promise.all([
    activeStaffIds.length === 0
      ? Promise.resolve([])
      : db.staffShift.findMany({
          where: { staffId: { in: activeStaffIds }, date: { gte: start, lte: end } },
          select: { staffId: true, startTime: true, endTime: true },
        }),
    db.booking.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
        status:    { notIn: ["CANCELLED"] },
        serviceId: { notIn: SALE_ONLY_SKUS },  // exclude POS membership/package transactions
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true, staffId: true },
    }),
  ]);

  const blockedSlots = blockedRows.map(r => ({ staffId: r.staffId, startTime: r.startTime, endTime: r.endTime }));
  return { branchId, onlineCap, overrides, activeStaffIds, hasShifts: shifts.length > 0, shifts, bookings, blockedSlots };
}

// ── Capacity check (single window) ────────────────────────────────────────────

export type ConflictReason = "no_capacity" | "selected_staff_busy" | "selected_staff_off_shift";

export interface CapacityResult {
  ok: boolean;
  reason?: ConflictReason;
  scheduledCount: number;
  occupiedCount: number;
}

/** Pure logic — given a snapshot, decide whether a window is bookable.
 *  When `online` is true, also enforces per-branch online cap and rejects
 *  windows with no shifts assigned (no legacy fallback). */
export function evaluateCapacity(
  snapshot: DaySnapshot,
  startTime: string,
  endTime: string,
  staffId: string | null = null,
  online: boolean = false,
): CapacityResult {
  const { activeStaffIds, hasShifts, shifts, bookings, blockedSlots } = snapshot;

  // Branch-wide block: any block with staffId=null overlapping this window → unavailable.
  const branchBlocked = blockedSlots.some(
    b => b.staffId === null && overlaps(startTime, endTime, b.startTime, b.endTime),
  );
  if (branchBlocked) {
    return { ok: false, reason: "no_capacity", scheduledCount: 0, occupiedCount: 0 };
  }

  // Staff scheduled to cover the window.
  // Online bookings ALWAYS require explicit shifts — no staff = unavailable.
  // Admin bookings keep the legacy fallback (assume all active staff free).
  const scheduledIds = hasShifts
    ? new Set(
        shifts
          .filter((s) => shiftCovers(s.startTime, s.endTime, startTime, endTime))
          .map((s) => s.staffId),
      )
    : (online ? new Set<string>() : new Set(activeStaffIds));

  // Bookings overlapping the window
  const conflicting = bookings.filter((b) => overlaps(startTime, endTime, b.startTime, b.endTime));

  if (staffId) {
    if (!scheduledIds.has(staffId)) {
      return { ok: false, reason: "selected_staff_off_shift", scheduledCount: scheduledIds.size, occupiedCount: 0 };
    }
    if (conflicting.some((b) => b.staffId === staffId)) {
      return { ok: false, reason: "selected_staff_busy", scheduledCount: scheduledIds.size, occupiedCount: 0 };
    }
    // Staff-specific block
    const staffBlocked = blockedSlots.some(
      b => b.staffId === staffId && overlaps(startTime, endTime, b.startTime, b.endTime),
    );
    if (staffBlocked) {
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

  // Branch-specific cap for online bookings, with optional per-window overrides
  // (date-specific > day-of-week > branch default). Admin/POS bookings bypass
  // via skipConflictCheck → online=false here.
  const cap = online ? resolveCap(snapshot, startTime, endTime) : null;
  const effectiveCap = cap != null ? Math.min(cap, scheduledIds.size) : scheduledIds.size;

  if (occupied >= effectiveCap) {
    return { ok: false, reason: "no_capacity", scheduledCount: effectiveCap, occupiedCount: occupied };
  }
  return { ok: true, scheduledCount: effectiveCap, occupiedCount: occupied };
}

/** Convenience: load snapshot and evaluate a single window. */
export async function checkCapacity(args: {
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  staffId?: string | null;
  excludeBookingId?: string;
  online?: boolean;
  /** Run the capacity reads on this client (e.g. inside a booking transaction). */
  db?: Db;
}): Promise<CapacityResult> {
  const snapshot = await loadDaySnapshot(args.branchId, args.date, args.excludeBookingId, args.db ?? prisma);
  return evaluateCapacity(snapshot, args.startTime, args.endTime, args.staffId ?? null, args.online ?? false);
}

// ── Slot grid (used by /api/availability) ─────────────────────────────────────

export async function getTakenSlots(
  branchId: string,
  date: string,
  duration: number,
  staffId: string | null = null,
  excludeBookingId?: string,
  openTime  = "08:00",   // Mon–Sat default; caller passes "10:00" for Sunday
  closeTime = "21:00",
): Promise<string[]> {
  const snapshot = await loadDaySnapshot(branchId, date, excludeBookingId);
  const slots  = generateTimeSlots(openTime, closeTime);
  const taken: string[] = [];

  // Past-slot cutoff + minimum lead time. For today's date, mark any slot
  // whose start is in the past OR within MIN_LEAD_MINUTES from now as taken.
  // This prevents customers from booking "right now" without giving the
  // salon time to prepare (chair, staff, walk-up customers, etc.).
  //
  // Slot times are Thailand local (Asia/Bangkok = UTC+7); the server runs in
  // UTC, so we shift "now" by +7h before extracting the local date and time.
  const MIN_LEAD_MINUTES = 30;
  const bkkNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = `${bkkNow.getUTCFullYear()}-${String(bkkNow.getUTCMonth() + 1).padStart(2, "0")}-${String(bkkNow.getUTCDate()).padStart(2, "0")}`;
  const isToday = date === todayStr;
  const nowMin  = isToday ? (bkkNow.getUTCHours() * 60 + bkkNow.getUTCMinutes()) : -1;
  const earliestBookableMin = nowMin + MIN_LEAD_MINUTES;

  for (const slot of slots) {
    if (isToday && timeToMins(slot) < earliestBookableMin) {
      taken.push(slot);
      continue;
    }
    const slotEnd = addMinutes(slot, duration);
    const result  = evaluateCapacity(snapshot, slot, slotEnd, staffId, /* online */ true);
    if (!result.ok) taken.push(slot);
  }
  return taken;
}
