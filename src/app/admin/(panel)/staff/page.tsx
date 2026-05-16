import { prisma } from "@/lib/prisma";
import StaffManager from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tab, month } = await searchParams;

  // Commission stats — default to current month
  const [yr, mo] = month ? month.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo, 0, 23, 59, 59, 999);

  // Three queries in parallel:
  //   1. Active staff (with branch)
  //   2. Active branches
  //   3. Per-staff revenue aggregated for the month
  // (Was: 1 staff query + N booking queries in a sequential loop — N+1 pattern.)
  const [allStaff, branches, revenueStats] = await Promise.all([
    prisma.staff.findMany({
      where:   { isActive: true },
      include: { branch: true },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.booking.groupBy({
      by: ["staffId"],
      where: {
        staffId: { not: null },
        status:  "COMPLETED",
        date:    { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalPrice: true },
    }),
  ]);

  const revenueByStaff = new Map<string, number>(
    revenueStats.map(r => [r.staffId!, r._sum.totalPrice ?? 0]),
  );

  const staffWithStats = allStaff.map(s => {
    const revenue = revenueByStaff.get(s.id) ?? 0;
    return {
      ...s,
      monthlyRevenue:    revenue,
      monthlyCommission: Math.round((revenue * s.commissionRate) / 100),
    };
  });

  const monthLabel = new Date(yr, mo - 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const currentMonth = `${yr}-${String(mo).padStart(2, "0")}`;

  return (
    <StaffManager
      staff={staffWithStats}
      branches={branches}
      monthLabel={monthLabel}
      currentMonth={currentMonth}
      activeTab={(tab as "manage" | "commission") ?? "manage"}
    />
  );
}
