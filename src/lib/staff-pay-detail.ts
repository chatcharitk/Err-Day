import { prisma } from "@/lib/prisma";
import { bangkokMonthRange, CHEER_SOURCE, otRatePerHourSatang, type PayrollCalculation } from "@/lib/payroll";

/**
 * Per-day pay breakdown for the staff portal — every job with its ค่ามือ and
 * tip, plus OT, travel and adjustments — so an employee can check a day line by
 * line and query it. Confirmed (PAID) days read the snapshot frozen at payment;
 * other days are computed live from the bookings and flagged pending.
 */
export interface PayJob {
  time: string;
  customer: string;
  service: string;
  addons: string;
  primary: boolean;
  status: string;
  commissionSatang: number;
  tipSatang: number;
  /** A ค่าเชียร์ line (upsell), not a job the person performed. */
  cheer?: boolean;
}

export interface PayDay {
  date: string;
  branchIds: string[];
  confirmed: boolean;
  jobs: PayJob[];
  /** Commission total actually counted (may differ from the jobs' sum if set manually). */
  commissionSatang: number;
  commissionManual: boolean;
  otHours: number;
  otRateSatang: number;
  otSatang: number;
  tipSatang: number;
  travelSatang: number;
  adjustmentSatang: number;
  adjustmentReason: string;
  clockIn: string | null;
  clockOut: string | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10); // rows sit at UTC noon of their Bangkok day
const hm = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(11, 16) : null;

export async function staffPayDays(staffIds: string[], month: string): Promise<PayDay[]> {
  const { start, end } = bangkokMonthRange(month);
  const range = { gte: start, lte: end };
  const [staff, payouts, bookings, attendance] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, payType: true, baseSatang: true, otRateSatang: true } }),
    prisma.staffDailyPayout.findMany({ where: { staffId: { in: staffIds }, date: range } }),
    prisma.booking.findMany({
      where: {
        date: range,
        status: { notIn: ["CANCELLED"] },
        OR: [{ staffId: { in: staffIds } }, { extraStaff: { some: { staffId: { in: staffIds } } } }],
      },
      select: {
        date: true, startTime: true, endTime: true, status: true, staffId: true, branchId: true,
        commissionSatang: true, tipSatang: true,
        customer: { select: { name: true, nickname: true } },
        service: { select: { name: true, nameTh: true, commissionSatang: true } },
        addons: { select: { addon: { select: { name: true, nameTh: true, commissionSatang: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.staffAttendance.findMany({ where: { staffId: { in: staffIds }, date: range } }),
  ]);
  const cheers = await prisma.bookingCheer.findMany({
    where: { staffId: { in: staffIds }, booking: { date: range, status: "COMPLETED" } },
    select: {
      quantity: true, amountSatang: true,
      service: { select: { name: true, nameTh: true } },
      booking: { select: { date: true, startTime: true, endTime: true, status: true, branchId: true, customer: { select: { name: true, nickname: true } } } },
    },
  });

  const days = new Map<string, PayDay>();
  const get = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = { date, branchIds: [], confirmed: false, jobs: [], commissionSatang: 0, commissionManual: false, otHours: 0, otRateSatang: 0, otSatang: 0,
        tipSatang: 0, travelSatang: 0, adjustmentSatang: 0, adjustmentReason: "", clockIn: null, clockOut: null };
      days.set(date, d);
    }
    return d;
  };

  // 1) Confirmed days: the snapshot taken when the owner marked the day paid.
  const snapshotDays = new Set<string>();
  for (const p of payouts.filter(p => p.status === "PAID")) {
    const date = ymd(p.date);
    const d = get(date);
    d.confirmed = true;
    if (!d.branchIds.includes(p.branchId)) d.branchIds.push(p.branchId);
    const calc = p.calculation as unknown as PayrollCalculation | null;
    if (calc?.bookings) {
      snapshotDays.add(date);
      for (const b of calc.bookings) {
        d.jobs.push({ time: b.time, customer: b.customer, service: b.service, addons: b.addons, primary: b.primary, status: b.status, commissionSatang: b.commissionSatang, tipSatang: b.tipSatang ?? 0, cheer: b.source === CHEER_SOURCE });
      }
      d.otRateSatang = calc.otRateSatang;
      d.clockIn = hm(calc.clockIn); d.clockOut = hm(calc.clockOut);
    }
    const jobsSum = (calc?.bookings ?? []).reduce((s, b) => s + b.commissionSatang, 0);
    d.commissionSatang += p.commissionSatang ?? 0;
    if (calc?.bookings && (p.commissionSatang ?? 0) !== jobsSum) d.commissionManual = true;
    d.otHours += p.otHours;
    d.otSatang += p.otSatang ?? 0;
    d.tipSatang += p.tipSatang + (p.bookingTipSatang ?? 0);
    d.travelSatang += p.travelSatang;
    d.adjustmentSatang += p.adjustmentSatang;
    if (p.adjustmentReason) d.adjustmentReason = p.adjustmentReason;
  }

  // 2) Everything not yet confirmed: live from bookings + any saved draft row.
  for (const b of bookings) {
    const date = ymd(b.date);
    const rowId = b.staffId && staffIds.includes(b.staffId) ? b.staffId : null;
    const primary = !!rowId;
    // Jobs on a confirmed day are already in that day's snapshot. Older confirmed
    // rows have no snapshot, so their jobs are listed live (amounts not re-added).
    if (snapshotDays.has(date)) continue;
    const d = get(date);
    if (!d.branchIds.includes(b.branchId)) d.branchIds.push(b.branchId);
    const commission = b.status === "COMPLETED" && primary
      ? (b.commissionSatang ?? (b.service.commissionSatang + b.addons.reduce((s, a) => s + a.addon.commissionSatang, 0)))
      : 0;
    const tip = b.status === "COMPLETED" && primary ? b.tipSatang : 0;
    d.jobs.push({
      time: `${b.startTime}–${b.endTime}`,
      customer: b.customer.nickname || b.customer.name,
      service: b.service.nameTh || b.service.name,
      addons: b.addons.map(a => a.addon.nameTh || a.addon.name).join(", "),
      primary, status: b.status, commissionSatang: commission, tipSatang: tip,
    });
    if (!d.confirmed) { d.commissionSatang += commission; d.tipSatang += tip; }
  }
  // ค่าเชียร์ on days without a payment snapshot (snapshots already contain them).
  for (const c of cheers) {
    const date = ymd(c.booking.date);
    if (snapshotDays.has(date)) continue;
    const d = get(date);
    if (!d.branchIds.includes(c.booking.branchId)) d.branchIds.push(c.booking.branchId);
    d.jobs.push({
      time: `${c.booking.startTime}–${c.booking.endTime}`,
      customer: c.booking.customer.nickname || c.booking.customer.name,
      service: `เชียร์ ${c.service.nameTh || c.service.name}${c.quantity > 1 ? ` ×${c.quantity}` : ""}`,
      addons: "", primary: true, status: c.booking.status, commissionSatang: c.amountSatang, tipSatang: 0, cheer: true,
    });
    if (!d.confirmed) d.commissionSatang += c.amountSatang;
  }
  for (const p of payouts.filter(p => p.status !== "PAID")) {
    const d = get(ymd(p.date));
    if (d.confirmed) continue;
    const row = staff.find(s => s.id === p.staffId);
    if (p.commissionSatang != null) { d.commissionSatang = p.commissionSatang; d.commissionManual = true; }
    if (p.otMode === "MANUAL" && row) {
      d.otHours += p.otHours;
      d.otRateSatang = otRatePerHourSatang(row);
      d.otSatang += Math.round(d.otRateSatang * p.otHours);
    }
    d.tipSatang += p.tipSatang;
    d.travelSatang += p.travelSatang;
    d.adjustmentSatang += p.adjustmentSatang;
    if (p.adjustmentReason) d.adjustmentReason = p.adjustmentReason;
  }
  for (const a of attendance) {
    const d = days.get(ymd(a.date));
    if (d && !d.clockIn) { d.clockIn = hm(a.clockIn.toISOString()); d.clockOut = hm(a.clockOut.toISOString()); }
  }

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export const payDayTotal = (d: PayDay) => d.commissionSatang + d.otSatang + d.tipSatang + d.travelSatang + d.adjustmentSatang;
