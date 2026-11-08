import { prisma } from "@/lib/prisma";
import { getMembershipBranchByCustomer } from "@/lib/membership";
import { branchCode } from "@/lib/branch-display";
import { SALE_ONLY_SKUS } from "@/lib/capacity";
import { TIP_INCOME_FROM, tipIncomeSatang } from "@/lib/tip-income";
import { dashPeriod, BI_HOUR_FROM, BI_HOUR_TO } from "@/lib/dashboard-month";
import DashboardView, { DashboardData } from "./DashboardView";

export const revalidate = 30;

/**
 * A customer counts as "came once then vanished" only after this many days of
 * silence. Without a window, every first-timer who visited yesterday would be
 * labelled churned — which inflates the number badly (669 vs 350 on current
 * data, because ~319 are recent first-timers who may well come back).
 */
const CHURN_QUIET_DAYS = 60;

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Current time in Bangkok (UTC+7). */
function bkkNow(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

/** Bounds for a full calendar day (UTC midnight → end-of-day). */
function dayBounds(dateStr: string) {
  return {
    start: new Date(dateStr + "T00:00:00.000Z"),
    end:   new Date(dateStr + "T23:59:59.999Z"),
  };
}

/** Bounds from day 1 of (year, month) through `endDay` inclusive (UTC). */
function partialMonthBounds(year: number, month: number, endDay: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(endDay).padStart(2, "0");
  return {
    start: new Date(`${year}-${m}-01T00:00:00.000Z`),
    end:   new Date(`${year}-${m}-${d}T23:59:59.999Z`),
  };
}

// ── Server component ──────────────────────────────────────────────────────────

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; month?: string }>;
}) {
  const { branchId: rawBranchId, month: rawMonth } = await searchParams;
  // "all" / "" / missing → no branch filter; specific id → narrow all booking queries to that branch.
  const branchFilter = rawBranchId && rawBranchId !== "all" ? { branchId: rawBranchId } : {};
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

  // For grouping (weekly bars, etc.) we still want the full current month.
  const fullMonthEnd = period.fullMonthEnd;
  const thisMonthFullB = partialMonthBounds(thisYear, thisMonthIdx, fullMonthEnd);

  const [
    branches,
    todayCompleted,
    thisMonthCompleted,
    lastMonthAgg,
    activeMembersList,
    newMembersThisMonth,
    visitsPerCustomer,
  ] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    // Today: completed bookings (branch-filtered if applicable)
    prisma.booking.findMany({
      where: { ...branchFilter, status: "COMPLETED", date: { gte: todayB.start, lte: todayB.end } },
      select: { totalPrice: true, tipSatang: true, date: true },
    }),

    // This month: completed bookings (need full detail for breakdowns)
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

    // Last month MTD aggregate (1st → same day of month)
    prisma.booking.aggregate({
      where: { ...branchFilter, status: "COMPLETED", date: { gte: lastMonthMTDB.start, lte: lastMonthMTDB.end } },
      _sum: { totalPrice: true, tipSatang: true },
      _count: true,
    }),

    // Memberships — fetch & filter active in JS for accuracy (Prisma can't compare
    // two columns natively for `usagesUsed < usagesAllowed`).
    prisma.membership.findMany({
      where:  { pendingActivation: false },
      select: { customerId: true, expiresAt: true, usagesUsed: true, usagesAllowed: true },
    }),

    // New memberships this month (by joinedAt)
    prisma.membership.count({
      where: { joinedAt: { gte: thisMonthMTDB.start, lte: thisMonthMTDB.end } },
    }),

    // Retention: one row per customer with their visit count + last visit date.
    //
    // Deliberately NOT branch-filtered. A customer's history spans branches (some
    // use both), so counting per-branch would label "went to the other branch"
    // as churned — the card is labelled ทั่วระบบ to match.
    //
    // groupBy keeps this to a single aggregate returning ~1 row per customer,
    // rather than pulling every booking row into the dashboard on each load.
    prisma.booking.groupBy({
      by:     ["customerId"],
      where:  { status: "COMPLETED", serviceId: { notIn: SALE_ONLY_SKUS } },
      _count: { _all: true },
      _max:   { date: true },
    }),
  ]);

  // ── Derived metrics ─────────────────────────────────────────────────────────

  // Revenue = services + tips (tips are income from Oct 2026, see tip-income.ts).
  const todayRevenue     = todayCompleted.reduce((s, b) => s + b.totalPrice + tipIncomeSatang(b.date, b.tipSatang), 0);
  const todayCount       = todayCompleted.length;

  // Month-to-date totals (only days 1 → today)
  const mtdEnd = new Date(`${todayStr}T23:59:59.999Z`);
  const thisMonthMTDCompleted = thisMonthCompleted.filter(b => b.date <= mtdEnd);
  const thisMonthServices = thisMonthMTDCompleted.reduce((s, b) => s + b.totalPrice, 0);
  const thisMonthRevenue = thisMonthServices + thisMonthMTDCompleted.reduce((s, b) => s + tipIncomeSatang(b.date, b.tipSatang), 0);
  const thisMonthCount   = thisMonthMTDCompleted.length;

  const lastMonthRevenue = (lastMonthAgg._sum.totalPrice ?? 0)
    + (lastMonthMTDB.end.toISOString().slice(0, 10) >= TIP_INCOME_FROM ? (lastMonthAgg._sum.tipSatang ?? 0) : 0);
  const lastMonthCount   = lastMonthAgg._count;
  // Average bill is the service price only — tips aren't part of the ticket.
  const avgTicket        = thisMonthCount > 0 ? Math.round(thisMonthServices / thisMonthCount) : 0;

  // "มาครั้งเดียวแล้วหาย": exactly one completed visit, and silent since.
  // `new Date()` rather than `Date.now()` — the latter trips react-hooks/purity,
  // and this file already uses the plain-constructor form (see nowDate below).
  const quietBefore       = new Date(new Date().getTime() - CHURN_QUIET_DAYS * 24 * 3600 * 1000);
  const customersWithVisit = visitsPerCustomer.length;
  const oneTimeGone = visitsPerCustomer.filter(
    r => r._count._all === 1 && (r._max.date ?? new Date(0)) < quietBefore,
  ).length;
  const oneTimeGonePct = customersWithVisit > 0
    ? Math.round((oneTimeGone / customersWithVisit) * 1000) / 10
    : 0;

  // Active members: not pending, not expired, not used-up.
  const nowDate = new Date();
  const activeMemberRows = activeMembersList.filter(m => {
    const notExpired = m.expiresAt == null || m.expiresAt >= nowDate;
    const notUsedUp  = m.usagesAllowed === 0 || m.usagesUsed < m.usagesAllowed;
    return notExpired && notUsedUp;
  });
  const activeMembers = activeMemberRows.length;

  // Breakdown of active members by the branch where they bought/renewed
  // (derived from the membership's latest POS booking). Manual entries have no
  // booking → counted as "unknown".
  const memberBranch = await getMembershipBranchByCustomer(activeMemberRows.map(m => m.customerId));
  const membersByBranch = { s1: 0, s2: 0, unknown: 0 };
  for (const m of activeMemberRows) {
    const code = branchCode(memberBranch.get(m.customerId));
    if      (code === "S1") membersByBranch.s1++;
    else if (code === "S2") membersByBranch.s2++;
    else                    membersByBranch.unknown++;
  }

  // Service breakdown (full month)
  const serviceMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    if (!serviceMap.has(b.serviceId))
      serviceMap.set(b.serviceId, { name: b.service.nameTh || "ไม่ระบุ", total: 0, count: 0 });
    const s = serviceMap.get(b.serviceId)!;
    s.total += b.totalPrice;
    s.count++;
  }
  const serviceBreakdown = [...serviceMap.values()].sort((a, b) => b.total - a.total);

  // Top customers — by USAGE count (visits), not revenue
  const customerMap = new Map<string, { id: string; name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    const { id, name } = b.customer;
    if (!customerMap.has(id)) customerMap.set(id, { id, name, total: 0, count: 0 });
    const c = customerMap.get(id)!;
    c.total += b.totalPrice;
    c.count++;
  }
  const topCustomers = [...customerMap.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total) // count desc, tiebreak by spend
    .slice(0, 5);

  // Staff revenue
  const staffMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of thisMonthCompleted) {
    if (!b.staff) continue;
    const { id, name } = b.staff;
    if (!staffMap.has(id)) staffMap.set(id, { name, total: 0, count: 0 });
    const s = staffMap.get(id)!;
    s.total += b.totalPrice;
    s.count++;
  }
  const staffRevenue = [...staffMap.values()].sort((a, b) => b.total - a.total);

  // Weekly revenue (W1=days 1-7, …, W5=29+)
  const weekTotals = [0, 0, 0, 0, 0];
  for (const b of thisMonthCompleted) {
    const day     = b.date.getUTCDate();
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
    weekTotals[weekIdx] += b.totalPrice + tipIncomeSatang(b.date, b.tipSatang);
  }
  const weeklyRevenue = weekTotals
    .map((total, i) => ({ label: String(i + 1), total }))
    .filter((_, i) => i * 7 + 1 <= fullMonthEnd);

  // Hourly usage — bookings grouped by start hour (07–22)
  const hourCounts = new Array(24).fill(0);
  for (const b of thisMonthCompleted) {
    const h = parseInt((b.startTime ?? "").split(":")[0] ?? "", 10);
    if (Number.isFinite(h) && h >= 0 && h < 24) hourCounts[h]++;
  }
  const hourlyUsage: { hour: number; count: number }[] = [];
  for (let h = BI_HOUR_FROM; h <= BI_HOUR_TO; h++) {
    hourlyUsage.push({ hour: h, count: hourCounts[h] });
  }

  const currentMonthLabel   = period.monthLabel;
  const lastMonthRangeLabel = period.lastRangeLabel;
  const thisMonthRangeLabel = period.rangeLabel;

  const dashData: DashboardData = {
    branches,
    activeBranchId,
    todayRevenue, todayCount,
    thisMonthRevenue, thisMonthCount,
    lastMonthRevenue, lastMonthCount,
    activeMembers, newMembersThisMonth, membersByBranch,
    oneTimeGone, oneTimeGonePct, customersWithVisit, churnQuietDays: CHURN_QUIET_DAYS,
    serviceBreakdown, topCustomers, staffRevenue, weeklyRevenue,
    hourlyUsage,
    avgTicket,
    currentMonthLabel,
    lastMonthRangeLabel,
    thisMonthRangeLabel,
    monthKey:       period.monthKey,
    isCurrentMonth: period.isCurrent,
    monthOptions:   period.options,
  };

  return (
    <div className="px-8 py-8">
      <DashboardView data={dashData} />
    </div>
  );
}
