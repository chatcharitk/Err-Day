"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Calendar as CalendarIcon, CalendarRange, Clock, Sparkles } from "lucide-react";
import StaffNav from "./StaffNav";
import type { CurrentStaff } from "@/lib/staff-auth";
import { customerLabel } from "@/lib/customer-name";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";

interface Booking {
  id:               string;
  date:             string;  // YYYY-MM-DD
  startTime:        string;
  endTime:          string;
  status:           string;
  totalPrice:       number;
  notes:            string | null;
  staffId:          string | null;
  staffName:        string | null;
  isMine:           boolean;
  serviceName:      string;
  customerName:     string;
  customerPhone:    string;
  customerNickname: string | null;
  branchId:         string;
  branchName:       string;
}
interface Shift { date: string; startTime: string; endTime: string; branchName: string | null }
interface WeekData {
  todayStr: string;
  bookings: Booking[];
  shifts:   Shift[];
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: "รอยืนยัน",  bg: "#FFF7ED", fg: "#9A3412" },
  CONFIRMED: { label: "ยืนยันแล้ว", bg: "#EFF6FF", fg: "#1D4ED8" },
  COMPLETED: { label: "เสร็จสิ้น",  bg: "#F0FDF4", fg: "#166534" },
  CANCELLED: { label: "ยกเลิก",   bg: "#FEF2F2", fg: "#B91C1C" },
  NO_SHOW:   { label: "ไม่มา",    bg: "#F4F4F5", fg: "#52525B" },
};

const DOW_TH_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}
function mondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = c.getDay();
  c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow));
  c.setHours(0, 0, 0, 0);
  return c;
}
function thaiDayShort(d: Date): string {
  const di = (d.getDay() + 6) % 7; // 0 = Mon
  return DOW_TH_SHORT[di];
}

export default function StaffDashboard({ me, week: allWeek, branches, myBranchIds }: {
  me: CurrentStaff; week: WeekData; branches: { id: string; name: string }[]; myBranchIds: string[];
}) {
  // Bookings from every branch are loaded; this picks which ones to show.
  // "mine" = the branch(es) this person works at (the default).
  const [branchView, setBranchView] = useState<string>("mine");
  const week = useMemo(() => ({
    ...allWeek,
    bookings: allWeek.bookings.filter(b =>
      branchView === "all" ? true : branchView === "mine" ? myBranchIds.includes(b.branchId) : b.branchId === branchView),
  }), [allWeek, branchView, myBranchIds]);
  const showBranch = branchView === "all" || (branchView === "mine" && myBranchIds.length > 1);
  const router = useRouter();
  const [tab, setTab] = useState<"today" | "week" | "next">("today");

  const today = parseYmd(week.todayStr);
  const monday = mondayOf(today);
  const weekOffset = tab === "next" ? 7 : 0;
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i + weekOffset)),
    [monday.getTime(), weekOffset],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const todayBookings = useMemo(
    () => week.bookings.filter(b => b.date === week.todayStr),
    [week.bookings, week.todayStr],
  );
  const tomorrowStr = ymd(addDays(today, 1));
  const tomorrowBookings = useMemo(
    () => week.bookings.filter(b => b.date === tomorrowStr),
    [week.bookings, tomorrowStr],
  );

  // A multi-branch person can have two shifts in one day (one per branch).
  const todayShifts  = week.shifts.filter(s => s.date === week.todayStr);
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of week.bookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return map;
  }, [week.bookings]);

  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen pb-12" style={{ background: BG }}>
      {/* Header — full-width red bar */}
      <header className="px-4 pt-4 pb-3" style={{ background: PRIMARY }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs">สวัสดี · พนักงาน</p>
            <h1 className="text-white text-lg font-bold leading-tight">{me.name}</h1>
            <p className="text-white/70 text-[11px] mt-0.5">{me.branchName}</p>
          </div>
          <button onClick={logout}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white px-3 py-1.5 rounded-full"
            style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
            <LogOut size={12} />
            ออกจากระบบ
          </button>
        </div>
      </header>

      <StaffNav active="schedule" />

      {/* Tabs */}
      <div className="px-4 pt-4 mb-3 max-w-2xl mx-auto flex gap-2">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Clock size={14} />}>
          วันนี้
        </TabButton>
        <TabButton active={tab === "week"} onClick={() => setTab("week")} icon={<CalendarIcon size={14} />}>
          สัปดาห์นี้
        </TabButton>
        <TabButton active={tab === "next"} onClick={() => setTab("next")} icon={<CalendarRange size={14} />}>
          สัปดาห์หน้า
        </TabButton>
      </div>

      {/* Which branch's bookings to show */}
      <div className="px-4 mb-3 max-w-2xl mx-auto flex gap-2 overflow-x-auto">
        {[{ id: "mine", name: myBranchIds.length > 1 ? "สาขาที่ฉันทำ" : "สาขาของฉัน" }, ...branches.filter(b => myBranchIds.length > 1 || !myBranchIds.includes(b.id)), { id: "all", name: "ทุกสาขา" }]
          .map(b => (
            <button key={b.id} type="button" onClick={() => setBranchView(b.id)}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium"
              style={branchView === b.id ? { background: TEXT, color: "white" } : { background: "white", color: TEXT, border: `1px solid ${BORDER}` }}>
              {b.name}
            </button>
          ))}
      </div>

      {/* Body */}
      <section className="px-4 space-y-3 max-w-2xl mx-auto">
        {tab === "today" && (
          <>
            {/* Today's shift card */}
            <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>กะวันนี้</p>
              {todayShifts.length > 0 ? todayShifts.map(s => (
                <p key={s.startTime} className="text-lg font-bold mt-1" style={{ color: TEXT }}>
                  {s.startTime} – {s.endTime}
                  {s.branchName && <span className="ml-2 text-xs font-medium" style={{ color: MUTED }}>{s.branchName}</span>}
                </p>
              )) : (
                <p className="text-sm mt-1 italic" style={{ color: MUTED }}>วันหยุด · ไม่มีกะ</p>
              )}
            </div>

            {/* Today's bookings */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold" style={{ color: TEXT }}>การจองวันนี้</h2>
                <span className="text-xs" style={{ color: MUTED }}>{todayBookings.length} รายการ</span>
              </div>
              {todayBookings.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
                  <Sparkles size={20} className="mx-auto mb-2 opacity-50" />
                  ไม่มีการจองสำหรับวันนี้
                </div>
              ) : (
                <ul className="space-y-2">
                  {todayBookings.map(b => <BookingRow key={b.id} b={b} showBranch={showBranch} />)}
                </ul>
              )}
            </div>

            {/* Tomorrow */}
            {tomorrowBookings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-sm font-bold" style={{ color: TEXT }}>พรุ่งนี้</h2>
                  <span className="text-xs" style={{ color: MUTED }}>{tomorrowBookings.length} รายการ</span>
                </div>
                <ul className="space-y-2 opacity-90">
                  {tomorrowBookings.map(b => <BookingRow key={b.id} b={b} dim showBranch={showBranch} />)}
                </ul>
              </div>
            )}
          </>
        )}

        {(tab === "week" || tab === "next") && (
          <div className="space-y-3">
            {weekDays.map(d => {
              const ds = ymd(d);
              const dayShifts = week.shifts.filter(s => s.date === ds);
              const bookings = bookingsByDay.get(ds) ?? [];
              const isToday  = ds === week.todayStr;
              return (
                <div key={ds} className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${isToday ? PRIMARY : BORDER}` }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: isToday ? "#FFF8F4" : "#FAFAFA" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-white"
                        style={{ background: isToday ? PRIMARY : "#9CA3AF" }}>
                        <span className="text-[10px] leading-none opacity-80">{thaiDayShort(d)}</span>
                        <span className="text-sm font-bold leading-none mt-0.5">{d.getDate()}</span>
                      </div>
                      <div>
                        {dayShifts.length > 0 ? dayShifts.map(shift => (
                          <p key={shift.startTime} className="text-xs font-semibold" style={{ color: TEXT }}>
                            {shift.startTime} – {shift.endTime}
                            {shift.branchName && <span className="ml-1.5 font-normal" style={{ color: MUTED }}>· {shift.branchName}</span>}
                          </p>
                        )) : (
                          <p className="text-xs italic" style={{ color: MUTED }}>วันหยุด</p>
                        )}
                        <p className="text-[10px]" style={{ color: MUTED }}>
                          {bookings.length} การจอง
                        </p>
                      </div>
                    </div>
                  </div>
                  {bookings.length > 0 && (
                    <ul className="divide-y" style={{ borderColor: BORDER }}>
                      {bookings.map(b => (
                        <li key={b.id}>
                          <BookingRow b={b} compact showBranch={showBranch} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
      style={{
        background: active ? PRIMARY : "white",
        color:      active ? "white" : TEXT,
        border:     `1px solid ${active ? PRIMARY : BORDER}`,
      }}>
      {icon}
      {children}
    </button>
  );
}

function BookingRow({ b, dim = false, compact = false, showBranch = false }: { b: Booking; dim?: boolean; compact?: boolean; showBranch?: boolean }) {
  const meta = STATUS_META[b.status] ?? STATUS_META.PENDING;
  return (
    <Link href={`/staff/bookings/${b.id}`}
      prefetch
      className={`flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-transform ${compact ? "" : "bg-white rounded-xl"}`}
      style={compact
        ? { background: b.isMine ? "#FFF8F4" : "transparent" }
        : { border: `1.5px solid ${b.isMine ? PRIMARY : BORDER}`, opacity: dim ? 0.75 : 1, background: b.isMine ? "#FFF8F4" : "white" }}>
      <div className="flex flex-col items-center justify-center" style={{ minWidth: 46 }}>
        <span className="text-sm font-bold leading-none" style={{ color: PRIMARY }}>{b.startTime}</span>
        <span className="text-[10px] mt-0.5 leading-none" style={{ color: MUTED }}>{b.endTime}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: TEXT }}>
          <span className="truncate">
            {customerLabel({ name: b.customerName, nickname: b.customerNickname })}
          </span>
          {b.isMine && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: PRIMARY, color: "white" }}>
              ของฉัน
            </span>
          )}
        </p>
        <p className="text-xs truncate" style={{ color: MUTED }}>
          {b.serviceName}
          {b.staffName && <span className="ml-1.5" style={{ color: b.isMine ? PRIMARY : MUTED }}>· {b.staffName}</span>}
          {!b.staffName && <span className="ml-1.5 italic" style={{ color: MUTED }}>· ไม่ระบุช่าง</span>}
          {showBranch && <span className="ml-1.5" style={{ color: MUTED }}>· {b.branchName}</span>}
        </p>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: meta.bg, color: meta.fg }}>
        {meta.label}
      </span>
    </Link>
  );
}
