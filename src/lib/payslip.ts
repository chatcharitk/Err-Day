import { prisma } from "@/lib/prisma";
import { bangkokMonthRange } from "@/lib/payroll";
import type { PayslipLine } from "@/lib/payslip-shared";

export * from "@/lib/payslip-shared";

/**
 * Monthly pay slips. A draft is assembled from what the system knows — the
 * configured base pay and the CONFIRMED (PAID) daily payroll — then the owner
 * reviews/edits it and issues it. See the Payslip model for the lifecycle.
 */
const day = (d: Date) => d.toISOString().slice(0, 10); // rows are stored at UTC noon of their Bangkok day
const baht = (s: number) => (s / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 });

export interface PayslipDraft {
  lines: PayslipLine[];
  /** Earnings already paid out day by day (confirmed daily payroll). */
  paidDailySatang: number;
  /** Days in the month whose daily pay is not confirmed yet — not on the slip. */
  pendingDays: string[];
  /** Salary-category expenses recorded for this person in the month, for the owner to reconcile. */
  salaryPayments: { date: string; amountSatang: number; notes: string | null }[];
}

export async function buildPayslipDraft(staffIds: string[], month: string): Promise<PayslipDraft> {
  const { start, end } = bangkokMonthRange(month);
  const range = { gte: start, lte: end };
  const [staff, payouts, shifts, attendance, bookings, salary] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, payType: true, baseSatang: true } }),
    prisma.staffDailyPayout.findMany({ where: { staffId: { in: staffIds }, date: range } }),
    prisma.staffShift.findMany({ where: { staffId: { in: staffIds }, date: range }, select: { staffId: true, date: true } }),
    prisma.staffAttendance.findMany({ where: { staffId: { in: staffIds }, date: range }, select: { date: true } }),
    prisma.booking.findMany({ where: { staffId: { in: staffIds }, date: range, status: "COMPLETED" }, select: { date: true } }),
    prisma.expense.findMany({
      where: { category: "salary", status: { not: "VOID" }, date: range, vendorRef: { staffId: { in: staffIds } } },
      select: { date: true, totalAmount: true, notes: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const lines: PayslipLine[] = [];

  // Base pay — from the row the person worked most shifts on this month.
  const shiftCount = (id: string) => shifts.filter(s => s.staffId === id).length;
  const base = staff.filter(s => s.baseSatang > 0).sort((a, b) => shiftCount(b.id) - shiftCount(a.id))[0];
  if (base?.payType === "MONTHLY_SALARY") {
    lines.push({ kind: "BASE", label: "เงินเดือน", amountSatang: base.baseSatang });
  } else if (base?.payType === "DAILY_WAGE") {
    const days = new Set([...shifts.map(s => day(s.date)), ...attendance.map(a => day(a.date))]).size;
    lines.push({ kind: "BASE", label: `ค่าแรงรายวัน ${days} วัน × ฿${baht(base.baseSatang)}`, amountSatang: base.baseSatang * days });
  }

  // Confirmed daily payroll only. PAID rows carry their frozen commission/OT.
  const paid = payouts.filter(p => p.status === "PAID");
  const sum = (f: (p: typeof paid[number]) => number) => paid.reduce((s, p) => s + f(p), 0);
  const commission = sum(p => p.commissionSatang ?? 0);
  const ot = sum(p => p.otSatang ?? 0);
  const tips = sum(p => p.tipSatang + (p.bookingTipSatang ?? 0));
  const travel = sum(p => p.travelSatang);
  const adjustment = sum(p => p.adjustmentSatang);
  if (commission) lines.push({ kind: "COMMISSION", label: "ค่าคอม / ค่ามือ", amountSatang: commission });
  if (ot) lines.push({ kind: "OT", label: "ค่าล่วงเวลา (OT)", amountSatang: ot });
  if (tips) lines.push({ kind: "TIP", label: "ทิป", amountSatang: tips });
  if (travel) lines.push({ kind: "TRAVEL", label: "ค่าเดินทาง", amountSatang: travel });
  if (adjustment) lines.push({ kind: "ADJUSTMENT", label: "ปรับเพิ่ม / ลด (รายวัน)", amountSatang: adjustment });

  const paidDays = new Set(paid.map(p => day(p.date)));
  const pendingDays = [...new Set([
    ...payouts.filter(p => p.status !== "PAID").map(p => day(p.date)),
    ...bookings.map(b => day(b.date)).filter(d => !paidDays.has(d)),
  ])].sort();

  return {
    lines,
    paidDailySatang: commission + ot + tips + travel + adjustment,
    pendingDays,
    salaryPayments: salary.map(e => ({ date: day(e.date), amountSatang: e.totalAmount, notes: e.notes })),
  };
}
