import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCachedBranches } from "@/lib/branches-cache";
import { computeBranchDailyPayout, bangkokTodayStr } from "@/lib/payroll";
import PayrollView from "./PayrollView";

// Live daily payout — always fresh.
export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  // Salary data — OWNER only. The (panel) layout authenticates; this enforces role.
  const me = await getCurrentAdmin();
  if (!me || me.role !== "OWNER") notFound();

  const { branchId, date } = await searchParams;
  const branches = await getCachedBranches();
  const activeBranchId = branchId && branches.some(b => b.id === branchId)
    ? branchId
    : (branches[0]?.id ?? "");
  const activeDate = date || bangkokTodayStr();

  const [rows, staffConfig, services] = await Promise.all([
    activeBranchId ? computeBranchDailyPayout(activeBranchId, activeDate) : Promise.resolve([]),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, branchId: true, payType: true, baseSatang: true, payCadence: true, otRateSatang: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { nameTh: "asc" }],
      select: { id: true, nameTh: true, name: true, category: true, commissionSatang: true },
    }),
  ]);

  return (
    <PayrollView
      branches={branches}
      activeBranchId={activeBranchId}
      activeDate={activeDate}
      todayStr={bangkokTodayStr()}
      rows={rows}
      staffConfig={staffConfig.map(s => ({
        id: s.id, name: s.name, branchId: s.branchId,
        payType: s.payType, baseSatang: s.baseSatang, payCadence: s.payCadence,
        otRateSatang: s.otRateSatang,
      }))}
      services={services.map(s => ({
        id: s.id, nameTh: s.nameTh || s.name, category: s.category, commissionSatang: s.commissionSatang,
      }))}
    />
  );
}
