import { prisma } from "@/lib/prisma";
import StaffManager from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tab, month } = await searchParams;

  const [allStaff, branches] = await Promise.all([
    prisma.staff.findMany({
      where: { isActive: true },
      include: { branch: true },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Commission stats — default to current month
  const [yr, mo] = month ? month.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo, 0, 23, 59, 59, 999);

  const staffWithStats = await Promise.all(
    allStaff.map(async (s) => {
      const bookings = await prisma.booking.findMany({
        where: {
          staffId: s.id,
          status: "COMPLETED",
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { totalPrice: true },
      });
      const revenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
      return {
        ...s,
        monthlyRevenue: revenue,
        monthlyCommission: Math.round(revenue * s.commissionRate / 100),
      };
    })
  );

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
