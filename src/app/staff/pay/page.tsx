import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { bangkokMonthRange, bangkokTodayStr } from "@/lib/payroll";
import { monthLabelTh } from "@/lib/payslip";
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

interface DayRow {
  date: string;
  confirmed: boolean;
  commission: number; ot: number; tips: number; travel: number; adjustment: number;
  jobs: number;
}

export default async function StaffPayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");

  const thisMonth = bangkokTodayStr().slice(0, 7);
  const { month: q } = await searchParams;
  const month = q && /^\d{4}-\d{2}$/.test(q) && q >= FIRST_MONTH && q <= thisMonth ? q : thisMonth;
  const { start, end } = bangkokMonthRange(month);
  const ids = me.person.staffIds;

  const [staffRows, payouts, bookings] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: ids } }, select: { payType: true, baseSatang: true, payCadence: true } }),
    prisma.staffDailyPayout.findMany({ where: { staffId: { in: ids }, date: { gte: start, lte: end } } }),
    prisma.booking.findMany({
      where: { staffId: { in: ids }, date: { gte: start, lte: end }, status: "COMPLETED" },
      select: {
        date: true, commissionSatang: true, tipSatang: true,
        service: { select: { commissionSatang: true } },
        addons: { select: { addon: { select: { commissionSatang: true } } } },
      },
    }),
  ]);

  // Confirmed days use the frozen payroll figures; other days show an estimate
  // from the bookings themselves (commission + booking tips), flagged pending.
  const days = new Map<string, DayRow>();
  const row = (date: string, confirmed: boolean) => {
    const r = days.get(date) ?? { date, confirmed, commission: 0, ot: 0, tips: 0, travel: 0, adjustment: 0, jobs: 0 };
    days.set(date, r);
    return r;
  };
  const paidDays = new Set<string>();
  for (const p of payouts.filter(p => p.status === "PAID")) {
    const d = p.date.toISOString().slice(0, 10);
    paidDays.add(d);
    const r = row(d, true);
    r.commission += p.commissionSatang ?? 0;
    r.ot += p.otSatang ?? 0;
    r.tips += p.tipSatang + (p.bookingTipSatang ?? 0);
    r.travel += p.travelSatang;
    r.adjustment += p.adjustmentSatang;
  }
  for (const b of bookings) {
    const d = b.date.toISOString().slice(0, 10);
    const r = row(d, paidDays.has(d));
    r.jobs += 1;
    if (r.confirmed) continue;
    r.commission += b.commissionSatang ?? (b.service.commissionSatang + b.addons.reduce((s, a) => s + a.addon.commissionSatang, 0));
    r.tips += b.tipSatang;
  }
  for (const p of payouts.filter(p => p.status !== "PAID")) {
    const d = p.date.toISOString().slice(0, 10);
    if (paidDays.has(d)) continue;
    const r = row(d, false);
    r.tips += p.tipSatang;
    r.travel += p.travelSatang;
    r.adjustment += p.adjustmentSatang;
  }
  const list = [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  const total = (r: DayRow) => r.commission + r.ot + r.tips + r.travel + r.adjustment;
  const sumBy = (confirmed: boolean, f: (r: DayRow) => number) => list.filter(r => r.confirmed === confirmed).reduce((s, r) => s + f(r), 0);
  const confirmedTotal = sumBy(true, total);
  const pendingTotal = sumBy(false, total);

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
            ["ค่าคอม / ค่ามือ", sumBy(true, r => r.commission)],
            ["ค่าล่วงเวลา (OT)", sumBy(true, r => r.ot)],
            ["ทิป", sumBy(true, r => r.tips)],
            ["ค่าเดินทาง", sumBy(true, r => r.travel)],
            ["ปรับเพิ่ม / ลด", sumBy(true, r => r.adjustment)],
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
                <li key={r.date} className="bg-white rounded-2xl p-3" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>{dayLabel(r.date)}</p>
                      <p className="text-[11px]" style={{ color: MUTED }}>{r.jobs} งาน</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold" style={{ color: TEXT }}>{money(total(r))}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={r.confirmed ? { background: "#F0FDF4", color: "#166534" } : { background: "#FFFBEB", color: "#B45309" }}>
                        {r.confirmed ? "ยืนยันแล้ว" : "รอยืนยัน"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
                    ค่าคอม {money(r.commission)}{r.ot ? ` · OT ${money(r.ot)}` : ""}{r.tips ? ` · ทิป ${money(r.tips)}` : ""}{r.travel ? ` · เดินทาง ${money(r.travel)}` : ""}{r.adjustment ? ` · ปรับ ${money(r.adjustment)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
