import { prisma } from "./prisma";
import { validDay, workMinutes } from "./finance-math";
import type { PayrollCalculation, PayrollBooking } from "./payroll";
export function reportRange(sp: URLSearchParams) {
  const branchId = sp.get("branchId") || "",
    from = sp.get("from") || "",
    to = sp.get("to") || "",
    staffId = sp.get("staffId") || "";
  if (
    !branchId ||
    !validDay(from) ||
    !validDay(to) ||
    from > to ||
    Date.parse(to) - Date.parse(from) > 366 * 86400000
  )
    throw new Error("เลือกสาขาและช่วงวันที่ไม่เกิน 366 วัน");
  return {
    branchId,
    from,
    to,
    staffId,
    start: new Date(from + "T00:00:00Z"),
    end: new Date(to + "T23:59:59.999Z"),
  };
}
export async function payrollReport(sp: URLSearchParams) {
  const range = reportRange(sp),
    { branchId, staffId, start, end } = range;
  const dayWhere = { gte: start, lte: end };
  const [staff, payouts, attendance, bookings, branch] = await Promise.all([
    prisma.staff.findMany({
      where: {
        ...(staffId ? { id: staffId } : {}),
        OR: [
          { branchId },
          { dailyPayouts: { some: { branchId, date: dayWhere } } },
        ],
      },
      select: { id: true, name: true, payType: true, baseSatang: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffDailyPayout.findMany({
      where: { branchId, date: dayWhere, ...(staffId ? { staffId } : {}) },
      orderBy: { date: "asc" },
    }),
    prisma.staffAttendance.findMany({
      where: {
        staff: {
          OR: [
            { branchId },
            { dailyPayouts: { some: { branchId, date: dayWhere } } },
          ],
        },
        date: dayWhere,
        ...(staffId ? { staffId } : {}),
      },
      orderBy: { date: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        branchId,
        date: dayWhere,
        ...(staffId
          ? { OR: [{ staffId }, { extraStaff: { some: { staffId } } }] }
          : {}),
      },
      include: {
        service: true,
        addons: { include: { addon: true } },
        customer: { select: { name: true } },
        extraStaff: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { name: true },
    }),
  ]);
  const people = staff.map((s) => {
    const ps = payouts.filter((p) => p.staffId === s.id),
      ats = attendance.filter((a) => a.staffId === s.id),
      bs = bookings.filter(
        (b) =>
          b.staffId === s.id || b.extraStaff.some((e) => e.staffId === s.id),
      );
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const dates = [
      ...new Set([
        ...ps.map((p) => day(p.date)),
        ...ats.map((a) => day(a.date)),
        ...bs.map((b) => day(b.date)),
      ]),
    ].sort();
    const days = dates.map((date) => {
      const p = ps.find((p) => day(p.date) === date),
        a = ats.find((a) => day(a.date) === date);
      const snapshot =
        p?.status === "PAID"
          ? (p.calculation as unknown as PayrollCalculation | null)
          : null;
      const details: PayrollBooking[] =
        snapshot?.bookings ??
        bs
          .filter((b) => day(b.date) === date)
          .map((b) => ({
            id: b.id,
            time: `${b.startTime}–${b.endTime}`,
            customer: b.customer.name,
            service: b.service.nameTh || b.service.name,
            addons: b.addons
              .map((a) => a.addon.nameTh || a.addon.name)
              .join(", "),
            status: b.status,
            primary: b.staffId === s.id,
            commissionSatang:
              b.status === "COMPLETED" && b.staffId === s.id
                ? (b.commissionSatang ??
                  b.service.commissionSatang +
                    b.addons.reduce((v, a) => v + a.addon.commissionSatang, 0))
                : 0,
            source:
              b.commissionSatang == null ? "เรตบริการเดิม" : "ค่ามือบุ๊กกิ้ง",
          }));
      const paid = p?.status === "PAID";
      const commission = paid
        ? (p.commissionSatang ?? 0)
        : details.reduce((v, b) => v + b.commissionSatang, 0);
      const ot = paid ? (p.otSatang ?? 0) : 0,
        tip = p?.tipSatang ?? 0,
        adjustment = p?.adjustmentSatang ?? 0;
      const clockIn = snapshot?.clockIn ?? a?.clockIn.toISOString() ?? null,
        clockOut = snapshot?.clockOut ?? a?.clockOut.toISOString() ?? null,
        breakMinutes = snapshot?.breakMinutes ?? a?.breakMinutes ?? 0;
      return {
        date,
        status: paid ? "PAID" : "PENDING",
        clockIn,
        clockOut,
        breakMinutes,
        workedMinutes:
          clockIn && clockOut
            ? workMinutes(clockIn, clockOut, breakMinutes)
            : null,
        otHours: paid ? p.otHours : null,
        commissionSatang: commission,
        otSatang: ot,
        tipSatang: tip,
        adjustmentSatang: adjustment,
        reason: p?.adjustmentReason || "",
        totalSatang: paid ? commission + ot + tip + adjustment : 0,
        paidAt: p?.paidAt?.toISOString() ?? null,
        expenseId: p?.expenseId ?? null,
        legacy: !!(paid && !snapshot),
        bookings: details,
      };
    });
    return {
      ...s,
      days,
      totalSatang: days.reduce((v, d) => v + d.totalSatang, 0),
      workedMinutes: days.reduce((v, d) => v + (d.workedMinutes ?? 0), 0),
    };
  });
  return {
    range,
    branch: branch.name,
    people,
    totalSatang: people.reduce((v, p) => v + p.totalSatang, 0),
  };
}
