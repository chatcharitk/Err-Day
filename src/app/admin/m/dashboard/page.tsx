import { prisma } from "@/lib/prisma";
import { TIP_INCOME_FROM, tipIncomeSatang } from "@/lib/tip-income";
import { dashPeriod, BI_HOUR_FROM, BI_HOUR_TO } from "@/lib/dashboard-month";
import MobileDashboard, { MobileDashData } from "./MobileDashboard";

export const revalidate = 30;

// ── Date helpers ──────────────────────────────────────────────────────────────
function bkkNow(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

function dayBounds(dateStr: string) {
  return {
    start: new Date(dateStr + "T00:00:00.000Z"),
    end:   new Date(dateStr + "T23:59:59.999Z"),
  };
}

function partialMonthBounds(year: number, month: number, endDay: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(endDay).padStart(2, "0");
  return {
    start: new Date(`${year}-${m}-01T00:00:00.000Z`),
    end:   new Date(`${year}-${m}-${d}T23:59:59.999Z`),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function MobileDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; month?: string }>;
}) {
  const { branchId: rawBranchId, month: rawMonth } = await searchParams;
  const branchFilter   = rawBranchId && rawBranchId !== "all" ? { branchId: rawBranchId } : {};
  const activeBranchId = (rawBranchId && rawBranchId !== "all") ? rawBranchId : "all";

  const now           = bkkNow();
  const todayStr      = now.toISOString().slice(0, 10);
  // Selected month (?month=YYYY-MM). Current month = month-to-date; a past
  // month = the whole month vs the whole previous month.
  const period        = dashPeriod(todayStr, rawMonth);
  const thisYear      = period.year;
  const thisMonthIdx  = period.monthIdx;
  const dayOfMonth    = period.endDay;
  const lastMonthIdx  = period.lastMonthIdx;
  const lastMonthYear = period.lastYear;
  const lastMonthClampedDay = period.lastEndDay;

  const todayB        = dayBounds(todayStr);
  const thisMonthMTDB = partialMonthBounds(thisYear, thisMonthIdx, dayOfMonth);
  const lastMonthMTDB = partialMonthBounds(lastMonthYear, lastMonthIdx, lastMonthClampedDay);
  const fullMonthEnd  = period.fullMonthEnd;
  const thisMonthFullB = partialMonthBounds(thisYear, thisMonthIdx, fullMonthEnd);

  const [
    branches,
    todayCompleted,
    thisMonthCompleted,
    lastMonthAgg,
    activeMembersList,
    newMembersThisMonth,
  ] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    prisma.booking.findMany({
      where: { ...branchFilter, status: "COMPLETED", date: { gte: todayB.start, lte: todayB.end } },
      select: { totalPrice: true, tipSatang: true, date: true },
    }),

    prisma.booking.findMany({
      where: { ...branchFilter, status: "COMPLETED", date: { gte: thisMonthFullB.start, lte: thisMonthFullB.end } },
      select: {
        totalPrice: true,
        tipSatang:  true,
        serviceId:  true,
        date:       true,
        startTime:  true,
        service:  { select: { nameTh: true } },
        customer: { select: { id: true, name: true } },
        staff:    { select: { id: true, name: true } },
      },
    }),

    prisma.booking.aggregate({
      where: { ...branchFilter, status: "COMPLETED", date: { gte: lastMonthMTDB.start, lte: lastMonthMTDB.end } },
      _sum: { totalPrice: true, tipSatang: true },
      _count: true,
    }),

    prisma.membership.findMany({
      where:  { pendingActivation: false },
      select: { expiresAt: true, usagesUsed: true, usagesAllowed: true },
    }),

    prisma.membership.count({
      where: { joinedAt: { gte: thisMonthMTDB.start, lte: thisMonthMTDB.end } },
    }),
  ]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Revenue = services + tips (tips are income from Oct 2026, see tip-income.ts).
  const todayRevenue = todayCompleted.reduce((s, b) => s + b.totalPrice + tipIncomeSatang(b.date, b.tipSatang), 0);
  const todayCount   = todayCompleted.length;

  const mtdEnd = new Date(`${todayStr}T23:59:59.999Z`);
  const thisMonthMTDCompleted = thisMonthCompleted.filter(b => b.date <= mtdEnd);
  const thisMonthServices = thisMonthMTDCompleted.reduce((s, b) => s + b.totalPrice, 0);
  const thisMonthRevenue = thisMonthServices + thisMonthMTDCompleted.reduce((s, b) => s + tipIncomeSatang(b.date, b.tipSatang), 0);
  const thisMonthCount   = thisMonthMTDCompleted.length;
  const lastMonthRevenue = (lastMonthAgg._sum.totalPrice ?? 0)
    + (lastMonthMTDB.end.toISOString().slice(0, 10) >= TIP_INCOME_FROM ? (lastMonthAgg._sum.tipSatang ?? 0) : 0);
  // Average bill is the service price only — tips aren't part of the ticket.
  const avgTicket        = thisMonthCount > 0 ? Math.round(thisMonthServices / thisMonthCount) : 0;

  const nowDate = new Date();
  const activeMembers = activeMembersList.filter(m => {
    const notExpired = m.expiresAt == null || m.expiresAt >= nowDate;
    const notUsedUp  = m.usagesAllowed === 0 || m.usagesUsed < m.usagesAllowed;
    return notExpired && notUsedUp;
  }).length;

  const serviceMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    if (!serviceMap.has(b.serviceId))
      serviceMap.set(b.serviceId, { name: b.service.nameTh || "ไม่ระบุ", total: 0, count: 0 });
    const s = serviceMap.get(b.serviceId)!;
    s.total += b.totalPrice; s.count++;
  }
  const serviceBreakdown = [...serviceMap.values()].sort((a, b) => b.total - a.total);

  const customerMap = new Map<string, { id: string; name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    const { id, name } = b.customer;
    if (!customerMap.has(id)) customerMap.set(id, { id, name, total: 0, count: 0 });
    const c = customerMap.get(id)!;
    c.total += b.totalPrice; c.count++;
  }
  const topCustomers = [...customerMap.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 5);

  const staffMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    if (!b.staff) continue;
    const { id, name } = b.staff;
    if (!staffMap.has(id)) staffMap.set(id, { name, total: 0, count: 0 });
    const s = staffMap.get(id)!;
    s.total += b.totalPrice; s.count++;
  }
  const staffRevenue = [...staffMap.values()].sort((a, b) => b.total - a.total);

  const weekTotals = [0, 0, 0, 0, 0];
  for (const b of thisMonthCompleted) {
    const day     = b.date.getUTCDate();
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
    weekTotals[weekIdx] += b.totalPrice + tipIncomeSatang(b.date, b.tipSatang);
  }
  const weeklyRevenue = weekTotals
    .map((total, i) => ({ label: String(i + 1), total }))
    .filter((_, i) => i * 7 + 1 <= fullMonthEnd);

  // Hourly usage (07–22)
  const hourCounts = new Array(24).fill(0);
  for (const b of thisMonthCompleted) {
    const h = parseInt((b.startTime ?? "").split(":")[0] ?? "", 10);
    if (Number.isFinite(h) && h >= 0 && h < 24) hourCounts[h]++;
  }
  const hourlyUsage: { hour: number; count: number }[] = [];
  for (let h = BI_HOUR_FROM; h <= BI_HOUR_TO; h++) {
    hourlyUsage.push({ hour: h, count: hourCounts[h] });
  }

  const dashData: MobileDashData = {
    branches,
    activeBranchId,
    todayRevenue, todayCount,
    thisMonthRevenue, thisMonthCount,
    lastMonthRevenue,
    activeMembers, newMembersThisMonth,
    serviceBreakdown, topCustomers, staffRevenue, weeklyRevenue,
    hourlyUsage,
    avgTicket,
    currentMonthLabel:    period.monthLabel,
    thisMonthRangeLabel:  period.rangeLabel,
    lastMonthRangeLabel:  period.lastRangeLabel,
    monthKey:             period.monthKey,
    isCurrentMonth:       period.isCurrent,
    monthOptions:         period.options,
  };

  return <MobileDashboard data={dashData} />;
}
