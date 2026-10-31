import type { PayslipLine } from "@/lib/payslip-shared";
import { monthLabelTh } from "@/lib/payslip-shared";

const TEXT  = "#3B2A24";
const MUTED = "#7A6258";
const LINE  = "#E8D8CC";

const money = (s: number) => (s / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PayslipDocData {
  month: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  lines: PayslipLine[];
  grossSatang: number;
  deductionSatang: number;
  netSatang: number;
  paidDailySatang: number;
  notes: string | null;
  status: string;
  revision: number;
  issuedAt: string | null;
  company: { legalName: string; taxId: string; addressLine: string; phone: string | null };
}

/** The printable pay slip — A4 portrait, used by both the staff portal and the owner. */
export default function PayslipDocument({ d }: { d: PayslipDocData }) {
  const earnings = d.lines.filter(l => l.kind !== "DEDUCTION");
  const deductions = d.lines.filter(l => l.kind === "DEDUCTION");
  return (
    <article className="payslip-doc bg-white mx-auto p-5 sm:p-10 print:p-0" style={{ color: TEXT, maxWidth: 760, border: `1px solid ${LINE}`, borderRadius: 16 }}>
      {d.status !== "ISSUED" && (
        <p className="text-center text-xs font-bold mb-4 py-1.5 rounded" style={{ background: "#FEF3C7", color: "#92400E" }}>
          ฉบับร่าง — ยังไม่ได้ออกสลิปให้พนักงาน
        </p>
      )}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 print:flex-row print:justify-between pb-4" style={{ borderBottom: `2px solid ${TEXT}` }}>
        <div>
          <p className="text-lg font-bold">{d.company.legalName || "err.day"}</p>
          {d.company.addressLine && <p className="text-xs whitespace-pre-line mt-1" style={{ color: MUTED }}>{d.company.addressLine}</p>}
          {d.company.taxId && <p className="text-xs mt-1" style={{ color: MUTED }}>เลขประจำตัวผู้เสียภาษี {d.company.taxId}</p>}
        </div>
        <div className="sm:text-right print:text-right flex-shrink-0">
          <p className="text-xl font-bold">สลิปเงินเดือน</p>
          <p className="text-xs" style={{ color: MUTED }}>PAY SLIP</p>
          <p className="text-sm font-semibold mt-2">ประจำเดือน {monthLabelTh(d.month)}</p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 py-4 text-sm" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div>
          <p className="text-xs" style={{ color: MUTED }}>ชื่อพนักงาน</p>
          <p className="font-semibold">{d.legalName || d.name}{d.legalName && d.legalName !== d.name ? ` (${d.name})` : ""}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: MUTED }}>เลขประจำตัวประชาชน / ผู้เสียภาษี</p>
          <p className="font-semibold">{d.taxId || "—"}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 py-4">
        <div>
          <p className="text-xs font-bold mb-2">รายได้</p>
          <table className="w-full text-sm"><tbody>
            {earnings.map((l, i) => (
              <tr key={i}><td className="py-1 pr-2">{l.label}</td><td className="py-1 text-right whitespace-nowrap">{money(l.amountSatang)}</td></tr>
            ))}
            {earnings.length === 0 && <tr><td className="py-1" style={{ color: MUTED }}>—</td></tr>}
          </tbody></table>
        </div>
        <div>
          <p className="text-xs font-bold mb-2">รายการหัก</p>
          <table className="w-full text-sm"><tbody>
            {deductions.map((l, i) => (
              <tr key={i}><td className="py-1 pr-2">{l.label}</td><td className="py-1 text-right whitespace-nowrap">{money(l.amountSatang)}</td></tr>
            ))}
            {deductions.length === 0 && <tr><td className="py-1" style={{ color: MUTED }}>ไม่มี</td></tr>}
          </tbody></table>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 py-3 text-sm" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `2px solid ${TEXT}` }}>
        <div><p className="text-xs" style={{ color: MUTED }}>รวมรายได้</p><p className="font-semibold">{money(d.grossSatang)}</p></div>
        <div><p className="text-xs" style={{ color: MUTED }}>รวมรายการหัก</p><p className="font-semibold">{money(d.deductionSatang)}</p></div>
        <div className="text-right"><p className="text-xs" style={{ color: MUTED }}>รายได้สุทธิ (บาท)</p><p className="text-lg font-bold">{money(d.netSatang)}</p></div>
      </section>

      {d.notes && <p className="text-xs mt-2 whitespace-pre-line">หมายเหตุ: {d.notes}</p>}

      <footer className="flex justify-between text-[11px] mt-8" style={{ color: MUTED }}>
        <span>ออกโดยระบบ err.day{d.revision > 0 ? ` · ฉบับแก้ไขครั้งที่ ${d.revision}` : ""}</span>
        <span>{d.issuedAt ? `ออกเมื่อ ${new Date(d.issuedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" })}` : ""}</span>
      </footer>
    </article>
  );
}
