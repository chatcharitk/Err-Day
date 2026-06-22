import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCachedBranches } from "@/lib/branches-cache";
import { computeBranchDailyPayout, bangkokTodayStr } from "@/lib/payroll";
import PayrollView from "@/app/admin/(panel)/payroll/PayrollView";

export const dynamic = "force-dynamic";
export const metadata = { title: "ค่าตอบแทน — err.day" };

export default async function MobilePayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  // The mobile layout does NOT authenticate (proxy only checks cookie presence),
  // so gate to OWNER here — salary data is sensitive.
  const me = await getCurrentAdmin();
  if (!me || me.role !== "OWNER") notFound();

  const { branchId, date } = await searchParams;
  const branches = await getCachedBranches();
  const activeBranchId = branchId && branches.some(b => b.id === branchId) ? branchId : (branches[0]?.id ?? "");
  const activeDate = date || bangkokTodayStr();

  const [rows, staffConfig, services, addons] = await Promise.all([
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
    prisma.serviceAddon.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
      select: { id: true, nameTh: true, name: true, commissionSatang: true },
    }),
  ]);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/admin/m" className="p-1" style={{ color: "#A08070" }}><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>ค่าตอบแทนพนักงาน</p>
      </div>
      <PayrollView
        basePath="/admin/m/payroll"
        branches={branches}
        activeBranchId={activeBranchId}
        activeDate={activeDate}
        todayStr={bangkokTodayStr()}
        rows={rows}
        staffConfig={staffConfig.map(s => ({
          id: s.id, name: s.name, branchId: s.branchId,
          payType: s.payType, baseSatang: s.baseSatang, payCadence: s.payCadence, otRateSatang: s.otRateSatang,
        }))}
        services={services.map(s => ({ id: s.id, nameTh: s.nameTh || s.name, category: s.category, commissionSatang: s.commissionSatang }))}
        addons={addons.map(a => ({ id: a.id, nameTh: a.nameTh || a.name, commissionSatang: a.commissionSatang }))}
      />
    </div>
  );
}
