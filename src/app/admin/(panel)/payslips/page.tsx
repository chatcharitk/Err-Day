import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { bangkokTodayStr } from "@/lib/payroll";
import { buildPayslipDraft, type PayslipLine } from "@/lib/payslip";
import PayslipsManager from "./PayslipsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "สลิปเงินเดือน — err.day" };

export default async function PayslipsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await getCurrentAdmin();
  if (me?.role !== "OWNER") notFound(); // salary data — owner only

  const thisMonth = bangkokTodayStr().slice(0, 7);
  const { month: q } = await searchParams;
  const month = q && /^\d{4}-\d{2}$/.test(q) && q <= thisMonth ? q : thisMonth;

  const slips = await prisma.payslip.findMany({ where: { month }, orderBy: { name: "asc" } });
  // Fresh payroll facts per slip, so the owner sees what is still unconfirmed
  // and which salary payments were recorded, before issuing.
  const checks = await Promise.all(slips.map(s => buildPayslipDraft(s.staffIds, month)));

  return (
    <PayslipsManager
      month={month}
      thisMonth={thisMonth}
      slips={slips.map((s, i) => ({
        id: s.id, name: s.name, legalName: s.legalName, status: s.status, revision: s.revision,
        lines: s.lines as unknown as PayslipLine[], notes: s.notes,
        grossSatang: s.grossSatang, deductionSatang: s.deductionSatang, netSatang: s.netSatang, paidDailySatang: s.paidDailySatang,
        issuedAt: s.issuedAt?.toISOString() ?? null,
        pendingDays: checks[i].pendingDays,
        salaryPayments: checks[i].salaryPayments,
      }))}
    />
  );
}
