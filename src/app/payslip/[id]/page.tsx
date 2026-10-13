import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import type { PayslipLine } from "@/lib/payslip";
import PayslipDocument from "@/components/PayslipDocument";
import PrintButton from "./PrintButton";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สลิปเงินเดือน — err.day" };

/**
 * One pay slip, print-ready ("Save as PDF" from the print dialog). Visible to
 * the OWNER (any status) and to the employee it belongs to once ISSUED —
 * anyone else gets a 404 so slip ids don't leak.
 */
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slip = await prisma.payslip.findUnique({ where: { id } });
  if (!slip) notFound();

  const admin = await getCurrentAdmin();
  const isOwner = admin?.role === "OWNER";
  let backHref = "/admin/payslips?month=" + slip.month;
  if (!isOwner) {
    const staff = await getCurrentStaffPerson();
    const mine = !!staff && slip.staffIds.some(s => staff.person.staffIds.includes(s));
    if (!mine || slip.status !== "ISSUED") notFound();
    backHref = "/staff/payslips";
  }

  const company = await prisma.companyProfile.findUnique({ where: { id: "company" } });

  return (
    <main className="min-h-screen py-6 px-3 print:p-0" style={{ background: "#FDF8F3" }}>
      <style>{`@media print { @page { size: A4; margin: 12mm; } body { background: white !important; } .payslip-doc { border: 0 !important; padding: 0 !important; max-width: none !important; } }`}</style>
      <div className="max-w-[760px] mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm underline" style={{ color: "#7A6258" }}>← กลับ</Link>
        <PrintButton />
      </div>
      <PayslipDocument d={{
        month: slip.month, name: slip.name, legalName: slip.legalName, taxId: slip.taxId,
        lines: slip.lines as unknown as PayslipLine[],
        grossSatang: slip.grossSatang, deductionSatang: slip.deductionSatang, netSatang: slip.netSatang,
        paidDailySatang: slip.paidDailySatang, notes: slip.notes, status: slip.status, revision: slip.revision,
        issuedAt: slip.issuedAt?.toISOString() ?? null,
        company: { legalName: company?.legalName ?? "", taxId: company?.taxId ?? "", addressLine: company?.addressLine ?? "", phone: company?.phone ?? null },
      }} />
      <p className="max-w-[760px] mx-auto mt-3 text-xs text-center print:hidden" style={{ color: "#A08070" }}>
        กดปุ่มด้านบน แล้วเลือก &quot;บันทึกเป็น PDF&quot; (Save as PDF) เพื่อดาวน์โหลด
      </p>
    </main>
  );
}
