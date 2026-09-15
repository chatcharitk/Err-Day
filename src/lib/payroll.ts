import { createHash } from "crypto";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import type { Prisma, Staff } from "@/generated/prisma/client";
import { validDay, workMinutes, overtimeMinutes, roundUpToHalfHour } from "@/lib/finance-math";

type DB = Prisma.TransactionClient;
type PayConfig = Pick<Staff, "payType" | "baseSatang" | "otRateSatang">;
export function otRatePerHourSatang(s: PayConfig): number {
  return (
    s.otRateSatang ??
    (s.baseSatang <= 0
      ? 0
      : s.baseSatang / (s.payType === "DAILY_WAGE" ? 8 : 240))
  );
}
export function otPaySatang(s: PayConfig, hours: number): number {
  return Math.round(otRatePerHourSatang(s) * hours);
}
export function bangkokDayRange(day: string) {
  if (!validDay(day)) throw new Error("วันที่ไม่ถูกต้อง");
  return {
    start: new Date(day + "T00:00:00Z"),
    end: new Date(day + "T23:59:59.999Z"),
  };
}
export function bangkokTodayStr() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
}
export function bangkokDayNoon(day: string) {
  bangkokDayRange(day);
  return new Date(day + "T12:00:00Z");
}
export function bangkokMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDay(month + "-01"))
    throw new Error("เดือนไม่ถูกต้อง");
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: new Date(month + "-01T00:00:00Z"),
    end: new Date(`${month}-${lastDay}T23:59:59.999Z`),
    lastDay,
  };
}
export function payrollExpenseMarker(staffId: string, month: string) {
  return `[PAYROLL:${staffId}:${month}]`;
}
export interface PayrollBooking {
  id: string;
  time: string;
  customer: string;
  service: string;
  addons: string;
  status: string;
  primary: boolean;
  commissionSatang: number;
  source: string;
}
export interface PayrollCalculation {
  bookings: PayrollBooking[];
  normalWorkMinutes: number;
  workedMinutes: number | null;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  attendanceNotes: string;
  otMode: string;
  otHours: number;
  otRateSatang: number;
  otSatang: number;
  commissionSatang: number;
  tipSatang: number;
  adjustmentSatang: number;
  adjustmentReason: string;
  totalSatang: number;
}
export interface StaffPayoutRow extends PayrollCalculation {
  staffId: string;
  name: string;
  payType: Staff["payType"];
  baseSatang: number;
  payCadence: Staff["payCadence"];
  completedCount: number;
  calculatedCommissionSatang: number;
  commissionOverridden: boolean;
  worked: boolean;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  expenseId: string | null;
  sourceToken: string;
  revision: number;
  shifts: string[];
  legacySnapshot: boolean;
  changedSincePaid: boolean;
  warnings: string[];
}
export async function computeBranchDailyPayout(
  branchId: string,
  dateStr: string,
  db: DB = prisma,
): Promise<StaffPayoutRow[]> {
  const { start, end } = bangkokDayRange(dateStr);
  const [staff, bookings, payouts, attendance, shifts] = await Promise.all([
    db.staff.findMany({
      where: {
        OR: [
          { branchId, isActive: true },
          {
            dailyPayouts: {
              some: { branchId, date: { gte: start, lte: end } },
            },
          },
          { bookings: { some: { branchId, date: { gte: start, lte: end } } } },
          {
            bookingStaff: {
              some: { booking: { branchId, date: { gte: start, lte: end } } },
            },
          },
        ],
      },
      orderBy: { name: "asc" },
    }),
    db.booking.findMany({
      where: { branchId, date: { gte: start, lte: end } },
      include: {
        service: true,
        customer: { select: { name: true } },
        addons: { include: { addon: true } },
        extraStaff: true,
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    db.staffDailyPayout.findMany({
      where: { branchId, date: { gte: start, lte: end } },
    }),
    db.staffAttendance.findMany({
      where: {
        date: { gte: start, lte: end },
        staff: {
          OR: [
            { branchId },
            {
              dailyPayouts: {
                some: { branchId, date: { gte: start, lte: end } },
              },
            },
          ],
        },
      },
    }),
    db.staffShift.findMany({
      where: {
        date: { gte: start, lte: end },
        staff: {
          OR: [
            { branchId },
            {
              dailyPayouts: {
                some: { branchId, date: { gte: start, lte: end } },
              },
            },
          ],
        },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);
  const expenseIds = payouts.flatMap((p) => (p.expenseId ? [p.expenseId] : []));
  const linkedExpenses = expenseIds.length
    ? await db.expense.findMany({
        where: { id: { in: expenseIds } },
        select: { id: true, status: true, totalAmount: true },
      })
    : [];
  return staff.map((s) => {
    const payout = payouts.find((p) => p.staffId === s.id);
    const att = attendance.find((a) => a.staffId === s.id);
    const details: PayrollBooking[] = bookings
      .filter(
        (b) =>
          b.staffId === s.id || b.extraStaff.some((e) => e.staffId === s.id),
      )
      .map((b) => {
        const primary = b.staffId === s.id;
        return {
          id: b.id,
          time: `${b.startTime}–${b.endTime}`,
          customer: b.customer.name,
          service: b.service.nameTh || b.service.name,
          addons: b.addons
            .map((a) => a.addon.nameTh || a.addon.name)
            .join(", "),
          status: b.status,
          primary,
          commissionSatang:
            b.status === "COMPLETED" && primary
              ? (b.commissionSatang ??
                b.service.commissionSatang +
                  b.addons.reduce((v, a) => v + a.addon.commissionSatang, 0))
              : 0,
          source:
            b.commissionSatang == null
              ? "เรตบริการเดิม"
              : "ค่ามือที่บันทึกในบุ๊กกิ้ง",
        };
      });
    const minutes = att
      ? workMinutes(att.clockIn, att.clockOut, att.breakMinutes)
      : null;
    const otMode = payout?.otMode ?? "AUTO";
    const hours =
      otMode === "MANUAL"
        ? (payout?.otHours ?? 0)
        : minutes == null
          ? 0
          : roundUpToHalfHour(overtimeMinutes(minutes, s.normalWorkMinutes) / 60);
    const calculatedCommissionSatang = details.reduce(
      (v, b) => v + b.commissionSatang,
      0,
    );
    const commissionOverridden =
      payout?.status !== "PAID" && payout?.commissionSatang != null;
    const live: PayrollCalculation = {
      bookings: details,
      normalWorkMinutes: s.normalWorkMinutes,
      workedMinutes: minutes,
      clockIn: att?.clockIn.toISOString() ?? null,
      clockOut: att?.clockOut.toISOString() ?? null,
      breakMinutes: att?.breakMinutes ?? 0,
      attendanceNotes: att?.notes ?? "",
      otMode,
      otHours: hours,
      otRateSatang: otRatePerHourSatang(s),
      otSatang: otPaySatang(s, hours),
      commissionSatang: payout?.commissionSatang ?? calculatedCommissionSatang,
      tipSatang: payout?.tipSatang ?? 0,
      adjustmentSatang: payout?.adjustmentSatang ?? 0,
      adjustmentReason: payout?.adjustmentReason ?? "",
      totalSatang: 0,
    };
    live.totalSatang =
      live.commissionSatang +
      live.otSatang +
      live.tipSatang +
      live.adjustmentSatang;
    const paid = payout?.status === "PAID";
    const snapshot =
      payout?.calculation as unknown as PayrollCalculation | null;
    const calc = paid
      ? (snapshot ?? {
          ...live,
          commissionSatang: payout.commissionSatang ?? 0,
          otSatang: payout.otSatang ?? 0,
          totalSatang:
            (payout.commissionSatang ?? 0) +
            (payout.otSatang ?? 0) +
            payout.tipSatang +
            payout.adjustmentSatang,
        })
      : live;
    const linkedExpense = linkedExpenses.find(
      (e) => e.id === payout?.expenseId,
    );
    const warnings: string[] = [];
    if (payout?.expenseId && !linkedExpense)
      warnings.push(
        "ไม่พบรายจ่ายที่เคยเชื่อม สามารถลงรายจ่ายใหม่จากยอดจ่ายเดิมได้",
      );
    if (linkedExpense && linkedExpense.totalAmount !== calc.totalSatang)
      warnings.push(
        "ยอดรายจ่ายเดิมไม่ตรงกับค่าตอบแทนที่บันทึก กรุณาตรวจและเปิดแก้ก่อนส่งบัญชี",
      );
    if (linkedExpense?.status === "VOIDED")
      warnings.push(
        "รายจ่ายที่เชื่อมถูกยกเลิกแล้ว กรุณาตรวจประวัติและเปิดแก้ค่าตอบแทน",
      );
    if (!att && !paid) warnings.push("ยังไม่ยืนยันเวลาเข้า–ออกจริง");
    if (hours > 0 && live.otRateSatang === 0)
      warnings.push("ยังไม่มีเรต OT — ตั้งค่าก่อนยืนยันจ่าย");
    if (
      details.some(
        (b) =>
          b.status === "COMPLETED" && b.primary && b.source === "เรตบริการเดิม",
      )
    )
      warnings.push("มีงานเก่าที่ใช้เรตบริการปัจจุบัน กรุณาตรวจค่ามือ");
    // Includes all source data, so changing any booking, attendance or payroll setting requires a fresh review.
    const sourceToken = createHash("sha256")
      .update(
        JSON.stringify({
          live,
          linkedExpense,
          revision: payout?.revision ?? 0,
          status: payout?.status ?? "PENDING",
          staff: {
            name: s.name,
            branchId: s.branchId,
            base: s.baseSatang,
            payType: s.payType,
          },
        }),
      )
      .digest("hex");
    return {
      ...calc,
      staffId: s.id,
      name: s.name,
      payType: s.payType,
      baseSatang: s.baseSatang,
      payCadence: s.payCadence,
      completedCount: calc.bookings.filter(
        (b) => b.status === "COMPLETED" && b.primary,
      ).length,
      calculatedCommissionSatang,
      commissionOverridden,
      worked: minutes != null && minutes > 0,
      status: payout?.status ?? "PENDING",
      paidAt: payout?.paidAt?.toISOString() ?? null,
      expenseId: linkedExpense?.id ?? null,
      revision: payout?.revision ?? 0,
      sourceToken,
      shifts: shifts
        .filter((a) => a.staffId === s.id)
        .map((a) => `${a.startTime}–${a.endTime}`),
      legacySnapshot: paid && !snapshot,
      changedSincePaid: !!(
        paid &&
        snapshot &&
        !isDeepStrictEqual(snapshot.bookings, details)
      ),
      warnings,
    };
  });
}
export async function computeBranchMonthlyPayout(
  branchId: string,
  month: string,
) {
  const { start, end } = bangkokMonthRange(month);
  const [payouts, attendance] = await Promise.all([
    prisma.staffDailyPayout.findMany({
      where: { branchId, date: { gte: start, lte: end } },
      include: { staff: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.staffAttendance.findMany({
      where: {
        staff: {
          OR: [
            { branchId },
            {
              dailyPayouts: {
                some: { branchId, date: { gte: start, lte: end } },
              },
            },
          ],
        },
        date: { gte: start, lte: end },
      },
    }),
  ]);
  const ids = [
    ...new Set([
      ...payouts.map((p) => p.staffId),
      ...attendance.map((a) => a.staffId),
    ]),
  ];
  const staff = await prisma.staff.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return staff.map((s) => {
    const days = payouts.filter((p) => p.staffId === s.id);
    const paid = days.filter((p) => p.status === "PAID");
    const sum = (
      key: "commissionSatang" | "otSatang" | "tipSatang" | "adjustmentSatang",
    ) => paid.reduce((v, p) => v + (p[key] ?? 0), 0);
    return {
      staffId: s.id,
      name: s.name,
      daysPaid: paid.length,
      daysPending: days.length - paid.length,
      workedDays: attendance.filter((a) => a.staffId === s.id).length,
      workedMinutes: attendance
        .filter((a) => a.staffId === s.id)
        .reduce(
          (v, a) => v + workMinutes(a.clockIn, a.clockOut, a.breakMinutes),
          0,
        ),
      commissionSatang: sum("commissionSatang"),
      otSatang: sum("otSatang"),
      tipSatang: sum("tipSatang"),
      adjustmentSatang: sum("adjustmentSatang"),
      totalSatang:
        sum("commissionSatang") +
        sum("otSatang") +
        sum("tipSatang") +
        sum("adjustmentSatang"),
      missingExpenseCount: paid.filter((p) => !p.expenseId).length,
    };
  });
}
