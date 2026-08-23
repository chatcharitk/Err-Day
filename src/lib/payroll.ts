/**
 * Payroll — staff daily payout (commission + OT) computation.
 *
 * Pay models (per staff, configured on the Staff record):
 *   • MONTHLY_SALARY — baseSatang is a monthly salary; OT hourly = base / (30*8)
 *   • DAILY_WAGE     — baseSatang is a per-day wage;     OT hourly = base / 8
 *   (otRateSatang overrides the derived rate when set.)
 *
 * The DAILY cash-out the owner pays = service commission earned that day + OT pay.
 *   • Commission: per COMPLETED booking, the PRIMARY stylist (booking.staffId)
 *     earns the booking's saved `commissionSatang` (ค่ามือ). Legacy bookings
 *     without a saved value use the service + add-on settings. This is independent
 *     of what the customer paid; extra (non-primary) stylists do not earn here.
 *   • OT: admin-entered hours for the day × the staff's OT hourly rate.
 *
 * Base salary/wage is disbursed on its own cadence (monthly / weekly) and is NOT
 * part of the daily cash-out — it's surfaced separately in rollups.
 *
 * All money is satang (THB*100). Booking.date is UTC-noon of the Bangkok day.
 */

import { prisma } from "@/lib/prisma";
import type { Staff, StaffDailyPayout } from "@/generated/prisma/client";

const MONTHLY_OT_DIVISOR = 30 * 8; // owner's rule: monthly salary / (30*8)
const DAILY_OT_DIVISOR = 8;

type PayConfig = Pick<Staff, "payType" | "baseSatang" | "otRateSatang">;

/** OT hourly rate in satang. Manual override wins; else derived from base pay. */
export function otRatePerHourSatang(s: PayConfig): number {
  if (s.otRateSatang != null) return s.otRateSatang;
  if (s.baseSatang <= 0) return 0;
  const divisor = s.payType === "DAILY_WAGE" ? DAILY_OT_DIVISOR : MONTHLY_OT_DIVISOR;
  return s.baseSatang / divisor;
}

/** OT pay in satang for a given number of hours (rounded to the satang). */
export function otPaySatang(s: PayConfig, hours: number): number {
  return Math.round(otRatePerHourSatang(s) * (hours || 0));
}

/** UTC range covering one "YYYY-MM-DD" Bangkok day as stored on Booking/payout date. */
export function bangkokDayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0)),
    end:   new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

/** "YYYY-MM-DD" Bangkok today. */
export function bangkokTodayStr(): string {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth() + 1)}-${p(bkk.getUTCDate())}`;
}

/** The canonical stored value for a Bangkok day: UTC noon (matches Booking.date). */
export function bangkokDayNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export interface StaffPayoutRow {
  staffId: string;
  name: string;
  payType: Staff["payType"];
  baseSatang: number;
  payCadence: Staff["payCadence"];
  /** Service commission earned this day (satang). */
  commissionSatang: number;
  /** Number of completed, commission-eligible bookings this day. */
  completedCount: number;
  /** Admin-entered OT hours for the day. */
  otHours: number;
  /** Derived (or overridden) OT hourly rate, satang. */
  otRateSatang: number;
  /** OT pay this day (satang). */
  otSatang: number;
  /** Admin-entered tip amount for the day (satang) — flat entry, not computed. */
  tipSatang: number;
  /** Daily cash-out = commission + OT + tip (satang). */
  totalSatang: number;
  /** Did the staff work this day (drives daily-wage base accrual). */
  worked: boolean;
  status: StaffDailyPayout["status"];
  paidAt: string | null;
  /** Set once this day's payout has been recorded as an Expense. */
  expenseId: string | null;
}

/**
 * Compute the daily payout rows for one branch on one Bangkok day. Returns a row
 * for every ACTIVE staff at the branch (so the admin can enter OT even on a
 * zero-commission day), plus any staff who already have a payout row that day.
 */
export async function computeBranchDailyPayout(
  branchId: string,
  dateStr: string,
): Promise<StaffPayoutRow[]> {
  const { start, end } = bangkokDayRange(dateStr);

  const [staff, bookings, payoutRows] = await Promise.all([
    prisma.staff.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, payType: true, baseSatang: true, payCadence: true, otRateSatang: true },
      orderBy: { name: "asc" },
    }),
    // Completed bookings this branch/day, attributed to a primary stylist.
    // New records carry a per-booking snapshot/override; legacy null records
    // continue to use their service's + add-ons' configured commission.
    prisma.booking.findMany({
      where: {
        branchId,
        status: "COMPLETED",
        staffId: { not: null },
        date: { gte: start, lte: end },
      },
      select: {
        staffId: true,
        commissionSatang: true,
        service: { select: { commissionSatang: true } },
        addons:  { select: { addon: { select: { commissionSatang: true } } } },
      },
    }),
    prisma.staffDailyPayout.findMany({
      where: { branchId, date: { gte: start, lte: end } },
    }),
  ]);

  const commByStaff = new Map<string, { sum: number; count: number }>();
  for (const b of bookings) {
    if (!b.staffId) continue;
    const serviceComm = b.service?.commissionSatang ?? 0;
    const addonComm = b.addons.reduce((s, a) => s + (a.addon?.commissionSatang ?? 0), 0);
    const bookingComm = b.commissionSatang ?? (serviceComm + addonComm);
    const cur = commByStaff.get(b.staffId) ?? { sum: 0, count: 0 };
    cur.sum += bookingComm;
    cur.count += 1;
    commByStaff.set(b.staffId, cur);
  }
  const payoutByStaff = new Map(payoutRows.map(r => [r.staffId, r]));

  // Union of active staff + any staff with a payout row that day (e.g. deactivated).
  const ids = new Set<string>([...staff.map(s => s.id), ...payoutRows.map(r => r.staffId)]);
  const staffById = new Map(staff.map(s => [s.id, s]));
  // Backfill config for payout-only staff that aren't in the active list.
  const missing = [...ids].filter(id => !staffById.has(id));
  if (missing.length > 0) {
    const extra = await prisma.staff.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true, payType: true, baseSatang: true, payCadence: true, otRateSatang: true },
    });
    for (const s of extra) staffById.set(s.id, s);
  }

  const rows: StaffPayoutRow[] = [];
  for (const id of ids) {
    const s = staffById.get(id);
    if (!s) continue;
    const comm = commByStaff.get(id) ?? { sum: 0, count: 0 };
    const pr = payoutByStaff.get(id);
    const otHours = pr?.otHours ?? 0;
    const otRate = otRatePerHourSatang(s);
    // If already settled, trust the snapshot; else compute live.
    const commissionSatang = pr?.status === "PAID" && pr.commissionSatang != null ? pr.commissionSatang : comm.sum;
    const otSatang = pr?.status === "PAID" && pr.otSatang != null ? pr.otSatang : otPaySatang(s, otHours);
    const tipSatang = pr?.tipSatang ?? 0;
    rows.push({
      staffId: id,
      name: s.name,
      payType: s.payType,
      baseSatang: s.baseSatang,
      payCadence: s.payCadence,
      commissionSatang,
      completedCount: comm.count,
      otHours,
      otRateSatang: otRate,
      otSatang,
      tipSatang,
      totalSatang: commissionSatang + otSatang + tipSatang,
      worked: pr?.worked ?? true,
      status: pr?.status ?? "PENDING",
      paidAt: pr?.paidAt ? pr.paidAt.toISOString() : null,
      expenseId: pr?.expenseId ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return rows;
}

// ── Monthly rollup → Expense integration ────────────────────────────────────

/** The idempotency marker stashed in Expense.notes so re-clicking never double-records a month. */
export function payrollExpenseMarker(staffId: string, month: string): string {
  return `[PAYROLL:${staffId}:${month}]`;
}

export interface MonthlyPayoutRow {
  staffId: string;
  name: string;
  daysPaid: number;
  commissionSatang: number;
  otSatang: number;
  totalSatang: number;
  /** Set if this staff/month has already been recorded as an Expense. */
  recordedExpenseId: string | null;
}

/** "YYYY-MM-01" / "YYYY-MM-<lastDay>" UTC bounds for a "YYYY-MM" month string. */
export function bangkokMonthRange(month: string): { start: Date; end: Date; lastDay: number } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
    end:   new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999)),
    lastDay,
  };
}

/**
 * Sum PAID StaffDailyPayout rows (commission + OT actually cashed out, per
 * the snapshot taken when each day was marked paid) for one branch/month, per
 * staff. This deliberately does NOT include base salary/wage — per this
 * file's own convention, base pay is disbursed on its own cadence outside the
 * daily cash-out this app tracks, so there is no reliable per-day "worked"
 * signal to compute it from here.
 */
export async function computeBranchMonthlyPayout(branchId: string, month: string): Promise<MonthlyPayoutRow[]> {
  const { start, end } = bangkokMonthRange(month);

  const [payouts, staff, existingExpenses] = await Promise.all([
    prisma.staffDailyPayout.findMany({
      where: { branchId, status: "PAID", date: { gte: start, lte: end } },
      select: { staffId: true, commissionSatang: true, otSatang: true },
    }),
    prisma.staff.findMany({
      where: { branchId },
      select: { id: true, name: true },
    }),
    // Idempotency check — has this staff/month already been recorded?
    prisma.expense.findMany({
      where: { branchId, category: "commission_bonus", notes: { contains: `:${month}]` } },
      select: { id: true, notes: true },
    }),
  ]);

  const staffById = new Map(staff.map(s => [s.id, s.name]));
  const expenseByMarker = new Map<string, string>();
  for (const e of existingExpenses) {
    const m = e.notes?.match(/\[PAYROLL:([^:]+):([^\]]+)\]/);
    if (m) expenseByMarker.set(`${m[1]}:${m[2]}`, e.id);
  }

  const byStaff = new Map<string, { days: number; commission: number; ot: number }>();
  for (const p of payouts) {
    const cur = byStaff.get(p.staffId) ?? { days: 0, commission: 0, ot: 0 };
    cur.days += 1;
    cur.commission += p.commissionSatang ?? 0;
    cur.ot += p.otSatang ?? 0;
    byStaff.set(p.staffId, cur);
  }

  const rows: MonthlyPayoutRow[] = [];
  for (const [staffId, agg] of byStaff) {
    const name = staffById.get(staffId) ?? staffId;
    rows.push({
      staffId,
      name,
      daysPaid: agg.days,
      commissionSatang: agg.commission,
      otSatang: agg.ot,
      totalSatang: agg.commission + agg.ot,
      recordedExpenseId: expenseByMarker.get(`${staffId}:${month}`) ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return rows;
}
