import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { monthLabelTh } from "@/lib/payslip";
import StaffHeader from "../StaffHeader";
import StaffNav from "../StaffNav";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สลิปเงินเดือน — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const money = (s: number) => `฿${(s / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

export default async function StaffPayslipsPage() {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");

  // Only ISSUED slips — drafts are the owner's working copy.
  const slips = await prisma.payslip.findMany({
    where: { status: "ISSUED", staffIds: { hasSome: me.person.staffIds } },
    orderBy: { month: "desc" },
    select: { id: true, month: true, netSatang: true, issuedAt: true, revision: true },
  });

  return (
    <main className="min-h-screen pb-12" style={{ background: "#FDF8F3" }}>
      <StaffHeader name={me.name} subtitle={me.branchName} />
      <StaffNav active="payslips" />
      <section className="px-4 pt-4 max-w-2xl mx-auto">
        <p className="text-xs mb-3" style={{ color: MUTED }}>สลิปจะขึ้นที่นี่หลังร้านตรวจและออกสลิปของแต่ละเดือน · กดเพื่อดูและดาวน์โหลด PDF</p>
        {slips.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
            <FileText size={20} className="mx-auto mb-2 opacity-50" />ยังไม่มีสลิปเงินเดือน
          </div>
        ) : (
          <ul className="space-y-2">
            {slips.map(s => (
              <li key={s.id}>
                <Link href={`/payslip/${s.id}`} className="bg-white rounded-2xl p-4 flex items-center gap-3" style={{ border: `1px solid ${BORDER}` }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FFF8F4", color: PRIMARY }}><FileText size={18} /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold" style={{ color: TEXT }}>{monthLabelTh(s.month)}</span>
                    <span className="block text-[11px]" style={{ color: MUTED }}>
                      รายได้สุทธิ {money(s.netSatang)}{s.revision > 0 ? " · ฉบับแก้ไข" : ""}
                    </span>
                  </span>
                  <ChevronRight size={18} style={{ color: MUTED }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
