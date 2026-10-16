import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { bangkokTodayStr } from "@/lib/payroll";
import { monthLabelTh } from "@/lib/payslip-shared";
import { staffPayDays, payDayTotal, type PayDay } from "@/lib/staff-pay-detail";
import ReportButton from "./ReportButton";
import StaffHeader from "../StaffHeader";
import StaffNav from "../StaffNav";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ค่าตอบแทนของฉัน — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";
const FIRST_MONTH = "2026-06"; // daily payroll starts 22 Jun 2026

const money = (s: number) => `฿${(s / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dayLabel = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });


const STATUS_TH: Record<string, string> = { PENDING: "รอยืนยันคิว", CONFIRMED: "ยังไม่เสร็จ", NO_SHOW: "ลูกค้าไม่มา", CANCELLED: "ยกเลิก" };

function Line({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span><span>{money(v)}</span>
    </div>
  );
}

export default async function StaffPayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");

  const thisMonth = bangkokTodayStr().slice(0, 7);
  const { month: q } = await searchParams;
  const month = q && /^\d{4}-\d{2}$/.test(q) && q >= FIRST_MONTH && q <= thisMonth ? q : thisMonth;
  const ids = me.person.staffIds;

  const [staffRows, list] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: ids } }, select: { payType: true, baseSatang: true, payCadence: true } }),
    staffPayDays(ids, month),
  ]);
  const sumBy = (confirmed: boolean, f: (r: PayDay) => number) => list.filter(r => r.confirmed === confirmed).reduce((s, r) => s + f(r), 0);
  const confirmedTotal = sumBy(true, payDayTotal);
  const pendingTotal = sumBy(false, payDayTotal);

  const base = staffRows.find(s => s.baseSatang > 0);
  const months: string[] = [];
  for (let m = thisMonth; m >= FIRST_MONTH; ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  }

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      <StaffHeader name={me.name} subtitle={me.branchName} />
      <StaffNav active="pay" />
      <section className="px-4 pt-4 max-w-2xl mx-auto space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {months.map(m => (
            <Link key={m} href={`/staff/pay?month=${m}`}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
              style={m === month ? { background: PRIMARY, color: "white" } : { background: "white", color: TEXT, border: `1px solid ${BORDER}` }}>
              {monthLabelTh(m)}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>ยืนยันแล้ว</p>
            <p className="text-xl font-bold mt-1" style={{ color: "#166534" }}>{money(confirmedTotal)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>ค่าคอม OT ทิป ที่ร้านยืนยันจ่าย</p>
          </div>
          <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>รอยืนยัน</p>
            <p className="text-xl font-bold mt-1" style={{ color: "#B45309" }}>{money(pendingTotal)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>ประมาณการ อาจเปลี่ยนได้ (ยังไม่รวม OT)</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: MUTED }}>สรุป {monthLabelTh(month)} (ยืนยันแล้ว)</p>
          {[
            ["ค่าคอม / ค่ามือ", sumBy(true, r => r.commissionSatang)],
            ["ค่าล่วงเวลา (OT)", sumBy(true, r => r.otSatang)],
            ["ทิป", sumBy(true, r => r.tipSatang)],
            ["ค่าเดินทาง", sumBy(true, r => r.travelSatang)],
            ["ปรับเพิ่ม / ลด", sumBy(true, r => r.adjustmentSatang)],
          ].map(([label, v]) => (
            <div key={label as string} className="flex justify-between text-sm py-1" style={{ color: TEXT }}>
              <span>{label}</span><span className="font-medium">{money(v as number)}</span>
            </div>
          ))}
          {base && (
            <p className="text-xs mt-2 pt-2" style={{ color: MUTED, borderTop: `1px solid ${BORDER}` }}>
              {base.payType === "DAILY_WAGE" ? `ค่าแรงรายวัน ${money(base.baseSatang)}/วัน` : `เงินเดือน ${money(base.baseSatang)}`}
              {" "}— แสดงในสลิปเงินเดือนตอนสิ้นเดือน
            </p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold mb-2 px-1" style={{ color: TEXT }}>รายวัน</h2>
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>ยังไม่มีรายการในเดือนนี้</div>
          ) : (
            <ul className="space-y-2">
              {list.map(r => (
                <li key={r.date} className="bg-white rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
                  <details>
                    <summary className="p-3 flex items-center justify-between cursor-pointer list-none">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: TEXT }}>{dayLabel(r.date)}</p>
                        <p className="text-[11px]" style={{ color: MUTED }}>{r.jobs.filter(j => j.primary && !j.cheer && j.status === "COMPLETED").length} งาน{r.jobs.some(j => j.cheer) ? ` · เชียร์ ${r.jobs.filter(j => j.cheer).length}` : ""} · แตะเพื่อดูรายละเอียด</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold" style={{ color: TEXT }}>{money(payDayTotal(r))}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={r.confirmed ? { background: "#F0FDF4", color: "#166534" } : { background: "#FFFBEB", color: "#B45309" }}>
                          {r.confirmed ? "ยืนยันแล้ว" : "รอยืนยัน"}
                        </span>
                      </div>
                    </summary>
                    <div className="px-3 pb-3 text-xs" style={{ color: TEXT, borderTop: `1px solid ${BORDER}` }}>
                      {(r.clockIn || r.clockOut) && <p className="pt-2" style={{ color: MUTED }}>เวลาทำงานจริง {r.clockIn ?? "—"} – {r.clockOut ?? "—"}</p>}
                      <table className="w-full mt-2">
                        <thead><tr style={{ color: MUTED }}><th className="text-left font-normal pb-1">เวลา / ลูกค้า / งาน</th><th className="text-right font-normal pb-1">ค่ามือ</th><th className="text-right font-normal pb-1">ทิป</th></tr></thead>
                        <tbody>
                          {r.jobs.map((j, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, opacity: j.status === "COMPLETED" ? 1 : 0.55 }}>
                              <td className="py-1.5 pr-2">
                                <span className="font-medium">{j.time}</span> {j.customer}
                                <span className="block" style={{ color: MUTED }}>
                                  {j.service}{j.addons ? ` + ${j.addons}` : ""}
                                  {!j.primary && " · ผู้ช่วย (ไม่คิดค่ามือ)"}
                                  {j.status !== "COMPLETED" && ` · ${STATUS_TH[j.status] ?? j.status}`}
                                </span>
                              </td>
                              <td className="py-1.5 text-right align-top whitespace-nowrap">{money(j.commissionSatang)}</td>
                              <td className="py-1.5 text-right align-top whitespace-nowrap">{j.tipSatang ? money(j.tipSatang) : "–"}</td>
                            </tr>
                          ))}
                          {r.jobs.length === 0 && <tr><td colSpan={3} className="py-1.5" style={{ color: MUTED }}>ไม่มีงานในบุ๊กกิ้ง</td></tr>}
                        </tbody>
                      </table>
                      <div className="mt-2 pt-2 space-y-1" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <Line label={r.commissionManual ? "ค่าคอม / ค่ามือรวม (หัวหน้ากำหนดยอดเอง)" : "ค่าคอม / ค่ามือรวม"} v={r.commissionSatang} />
                        {r.otHours > 0 || r.otSatang > 0
                          ? <Line label={`OT ${r.otHours} ชม.${r.otRateSatang ? ` × ${money(r.otRateSatang)}/ชม.` : ""}`} v={r.otSatang} />
                          : !r.confirmed && <p style={{ color: MUTED }}>OT จะคำนวณตอนหัวหน้ายืนยันเวลาเข้า–ออก</p>}
                        {r.tipSatang > 0 && <Line label="ทิปรวม" v={r.tipSatang} />}
                        {r.travelSatang > 0 && <Line label="ค่าเดินทาง" v={r.travelSatang} />}
                        {r.adjustmentSatang !== 0 && <Line label={`ปรับเพิ่ม / ลด${r.adjustmentReason ? ` (${r.adjustmentReason})` : ""}`} v={r.adjustmentSatang} />}
                        <Line label="รวมวันนี้" v={payDayTotal(r)} bold />
                      </div>
                      <ReportButton date={r.date} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
