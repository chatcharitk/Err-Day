"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Calendar as CalendarIcon, Clock, User, Phone, Sparkles, TrendingUp } from "lucide-react";
import type { CurrentStaff } from "@/lib/staff-auth";

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
  serviceName:      string;
  customerName:     string;
  customerPhone:    string;
  customerNickname: string | null;
}
interface Shift { date: string; startTime: string; endTime: string }
interface MonthStats {
  bookings:       number;
  revenue:        number;
  commission:     number;
  commissionRate: number;
}
interface WeekData {
  todayStr:   string;
  bookings:   Booking[];
  shifts:     Shift[];
  monthStats: MonthStats;
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
function formatBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}
function thaiDayShort(d: Date): string {
  const di = (d.getDay() + 6) % 7; // 0 = Mon
  return DOW_TH_SHORT[di];
}

export default function StaffDashboard({ me, week }: { me: CurrentStaff; week: WeekData }) {
  const router = useRouter();
  const [tab, setTab] = useState<"today" | "week">("today");

  const today = parseYmd(week.todayStr);
  const monday = mondayOf(today);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday.getTime()],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const todayBookings = useMemo(
    () => week.bookings.filter(b => b.date === week.todayStr),
    [week.bookings, week.todayStr],
  );
  const tomorrowStr = ymd(addDays(today, 1));
  const tomorrowBookings = useMemo(
    () => week.bookings.filter(b => b.date === tomorrowStr).slice(0, 3),
    [week.bookings, tomorrowStr],
  );

  const todayShift   = week.shifts.find(s => s.date === week.todayStr);
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
      {/* Header */}
      <header className="px-4 pt-4 pb-3" style={{ background: PRIMARY }}>
        <div className="flex items-center justify-between">
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

      {/* Month stats */}
      <section className="px-4 -mt-1 mb-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px]" style={{ color: MUTED }}>เดือนนี้</p>
            <p className="text-base font-bold mt-0.5" style={{ color: TEXT }}>{week.monthStats.bookings}</p>
            <p className="text-[10px]" style={{ color: MUTED }}>การจอง</p>
          </div>
          <div className="bg-white rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px]" style={{ color: MUTED }}>รายได้</p>
            <p className="text-base font-bold mt-0.5" style={{ color: TEXT }}>{formatBaht(week.monthStats.revenue)}</p>
            <p className="text-[10px]" style={{ color: MUTED }}>เสร็จสิ้น</p>
          </div>
          <div className="bg-white rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[10px]" style={{ color: MUTED }}>ค่าคอม</p>
            <p className="text-base font-bold mt-0.5" style={{ color: PRIMARY }}>{formatBaht(week.monthStats.commission)}</p>
            <p className="text-[10px]" style={{ color: MUTED }}>{week.monthStats.commissionRate}%</p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="px-4 mb-3 flex gap-2">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Clock size={14} />}>
          วันนี้
        </TabButton>
        <TabButton active={tab === "week"} onClick={() => setTab("week")} icon={<CalendarIcon size={14} />}>
          สัปดาห์นี้
        </TabButton>
      </div>

      {/* Body */}
      <section className="px-4 space-y-3">
        {tab === "today" && (
          <>
            {/* Today's shift card */}
            <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>กะวันนี้</p>
              {todayShift ? (
                <p className="text-lg font-bold mt-1" style={{ color: TEXT }}>
                  {todayShift.startTime} – {todayShift.endTime}
                </p>
              ) : (
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
                  {todayBookings.map(b => <BookingRow key={b.id} b={b} />)}
                </ul>
              )}
            </div>

            {/* Tomorrow preview */}
            {tomorrowBookings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold px-1 mb-2" style={{ color: TEXT }}>พรุ่งนี้ (ตัวอย่าง)</h2>
                <ul className="space-y-2 opacity-90">
                  {tomorrowBookings.map(b => <BookingRow key={b.id} b={b} dim />)}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === "week" && (
          <div className="space-y-3">
            {weekDays.map(d => {
              const ds = ymd(d);
              const shift = week.shifts.find(s => s.date === ds);
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
                        {shift ? (
                          <p className="text-xs font-semibold" style={{ color: TEXT }}>
                            {shift.startTime} – {shift.endTime}
                          </p>
                        ) : (
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
                          <BookingRow b={b} compact />
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

function BookingRow({ b, dim = false, compact = false }: { b: Booking; dim?: boolean; compact?: boolean }) {
  const meta = STATUS_META[b.status] ?? STATUS_META.PENDING;
  return (
    <Link href={`/staff/bookings/${b.id}`}
      prefetch
      className={`flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-transform ${compact ? "" : "bg-white rounded-xl"}`}
      style={compact ? {} : { border: `1px solid ${BORDER}`, opacity: dim ? 0.75 : 1 }}>
      <div className="flex flex-col items-center justify-center" style={{ minWidth: 46 }}>
        <span className="text-sm font-bold leading-none" style={{ color: PRIMARY }}>{b.startTime}</span>
        <span className="text-[10px] mt-0.5 leading-none" style={{ color: MUTED }}>{b.endTime}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
          {b.customerName}
          {b.customerNickname && <span className="font-normal text-xs ml-1" style={{ color: MUTED }}>({b.customerNickname})</span>}
        </p>
        <p className="text-xs truncate" style={{ color: MUTED }}>{b.serviceName}</p>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: meta.bg, color: meta.fg }}>
        {meta.label}
      </span>
    </Link>
  );
}
