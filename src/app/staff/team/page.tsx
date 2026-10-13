import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { bangkokTodayStr } from "@/lib/payroll";
import StaffHeader from "../StaffHeader";
import StaffNav from "../StaffNav";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ตารางงานทีม — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};

/**
 * Every branch's shift roster for this week or next — so staff can see who is
 * on where (covering, swapping, knowing the team for the day). Read-only.
 */
export default async function StaffTeamPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");

  const { week } = await searchParams;
  const next = week === "next";
  const today = bangkokTodayStr();
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  const monday = addDays(today, (dow === 0 ? -6 : 1 - dow) + (next ? 7 : 0));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const [branches, shifts] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.staffShift.findMany({
      where: { date: { gte: new Date(days[0] + "T00:00:00Z"), lte: new Date(days[6] + "T23:59:59Z") } },
      select: { date: true, startTime: true, endTime: true, staffId: true, staff: { select: { name: true, branchId: true } } },
      orderBy: [{ startTime: "asc" }],
    }),
  ]);

  return (
    <main className="min-h-screen pb-12" style={{ background: "#FDF8F3" }}>
      <StaffHeader name={me.name} subtitle={me.branchName} />
      <StaffNav active="team" />
      <section className="px-4 pt-4 max-w-2xl mx-auto space-y-3">
        <div className="flex gap-2">
          {[["", "สัปดาห์นี้"], ["next", "สัปดาห์หน้า"]].map(([k, label]) => {
            const on = (k === "next") === next;
            return (
              <Link key={label} href={k ? `/staff/team?week=${k}` : "/staff/team"}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={on ? { background: PRIMARY, color: "white" } : { background: "white", color: TEXT, border: `1px solid ${BORDER}` }}>
                {label}
              </Link>
            );
          })}
        </div>

        {days.map(d => {
          const isToday = d === today;
          const dayShifts = shifts.filter(s => s.date.toISOString().slice(0, 10) === d);
          return (
            <div key={d} className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${isToday ? PRIMARY : BORDER}` }}>
              <p className="px-4 py-2 text-sm font-semibold" style={{ background: isToday ? "#FFF8F4" : "#FAFAFA", color: TEXT }}>
                {DOW[new Date(d + "T12:00:00Z").getUTCDay()]} {Number(d.slice(8, 10))}/{Number(d.slice(5, 7))}
                {isToday && <span className="ml-2 text-[11px] font-medium" style={{ color: PRIMARY }}>วันนี้</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: BORDER }}>
                {branches.map(b => {
                  const list = dayShifts.filter(s => s.staff.branchId === b.id);
                  return (
                    <div key={b.id} className="bg-white px-4 py-2.5">
                      <p className="text-[11px] font-semibold mb-1" style={{ color: MUTED }}>{b.name.replace("err.day ", "")} · {list.length} คน</p>
                      {list.length === 0 ? <p className="text-xs italic" style={{ color: MUTED }}>ยังไม่มีกะ</p> : (
                        <ul className="space-y-0.5">
                          {list.map(s => {
                            const mine = me.person.staffIds.includes(s.staffId);
                            return (
                              <li key={`${s.staffId}-${s.startTime}`} className="flex justify-between text-sm" style={{ color: mine ? PRIMARY : TEXT, fontWeight: mine ? 700 : 400 }}>
                                <span>{s.staff.name}{mine ? " (ฉัน)" : ""}</span>
                                <span className="tabular-nums">{s.startTime}–{s.endTime}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
