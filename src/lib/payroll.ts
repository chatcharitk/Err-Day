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
 *     earns that service's fixed `commissionSatang` (ค่ามือ) — independent of what
 *     the customer actually paid (member discount / package redemption don't
 *     reduce it). Add-ons and extra (non-primary) stylists do not earn here.
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
  /** Daily cash-out = commission + OT (satang). */
  totalSatang: number;
  /** Did the staff work this day (drives daily-wage base accrual). */
  worked: boolean;
  status: StaffDailyPayout["status"];
  paidAt: string | null;
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
    // Completed bookings this branch/day, attributed to a primary stylist, with
    // their service's + add-ons' fixed commission.
    prisma.booking.findMany({
      where: {
        branchId,
        status: "COMPLETED",
        staffId: { not: null },
        date: { gte: start, lte: end },
      },
      select: {
        staffId: true,
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
    const cur = commByStaff.get(b.staffId) ?? { sum: 0, count: 0 };
    cur.sum += serviceComm + addonComm;
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
      totalSatang: commissionSatang + otSatang,
      worked: pr?.worked ?? true,
      status: pr?.status ?? "PENDING",
      paidAt: pr?.paidAt ? pr.paidAt.toISOString() : null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return rows;
}
