"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

// Modals are lazy-loaded — only fetched when the user actually opens one.
// Cuts ~700 lines (~30-40 KB) from the initial calendar bundle.
const EditModal       = dynamic(() => import("./EditModal"),       { ssr: false });
const AddBookingModal = dynamic(() => import("./AddBookingModal"), { ssr: false });
const BlockSlotModal  = dynamic(() => import("./BlockSlotModal"),  { ssr: false });

/* ─── Types ─────────────────────────────────────────────── */
interface ShiftInfo   { startTime: string; endTime: string }
/** staffId → shift for the day (null = staff exists but is off-shift) */
type StaffShiftMap = Record<string, ShiftInfo | null>;

interface BookingAddon {
  id: string;
  nameTh: string;
  name: string;
  price: number;
}
interface BookingItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  notes: string | null;
  /** ISO — payment received. null on a COMPLETED booking = ยังไม่ชำระ. */
  paidAt: string | null;
  serviceId: string;
  service: { name: string; nameTh: string; category: string };
  customer: { id: string; name: string; nickname: string | null; phone: string };
  staff: { id: string; name: string } | null;
  extraStaff: { id: string; name: string }[];
  addons: BookingAddon[];
}
interface StaffItem    { id: string; name: string }
interface BranchItem   { id: string; name: string }
interface ServiceOption {
  id: string;        // BranchService.id
  duration: number;
  price: number;
  service: { id: string; name: string; nameTh: string };
}
interface BranchServiceItem {
  id:                    string;  // serviceId
  nameTh:                string;
  category:              string;
  price:                 number;
  duration:              number;
  memberPrice:           number | null;
  memberDiscountPercent: number;
}
interface AddonItem { id: string; nameTh: string; price: number; }

interface BlockedSlotItem {
  id:        string;
  date:      string;
  startTime: string;
  endTime:   string;
  reason:    string | null;
  staffId:   string | null;
  staff:     { id: string; name: string } | null;
}

interface Props {
  weekBookings:    BookingItem[];
  staff:           StaffItem[];
  selectedDate:    string;          // "YYYY-MM-DD"
  branches:        BranchItem[];
  activeBranchId:  string;
  branchServices:  BranchServiceItem[];
  addons:          AddonItem[];
}

/* ─── Constants ─────────────────────────────────────────── */
const DAY_START = 8;
const DAY_END   = 21;
const HOUR_PX   = 80;
const COL_W     = 160;
const TIME_COL  = 60;
const HOUR_PX_H = 80;
const ROW_H     = 56;

type ViewMode   = "vertical" | "horizontal" | "list";
type PeriodType = "day" | "week" | "month" | "year";

const DAYS_TH   = ["จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์","อาทิตย์"];
const DAYS_EN   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { bg:"bg-amber-50",  text:"text-amber-800",  border:"border-amber-300",  dot:"bg-amber-400"  },
  CONFIRMED: { bg:"bg-blue-50",   text:"text-blue-800",   border:"border-blue-300",   dot:"bg-blue-500"   },
  COMPLETED: { bg:"bg-green-50",  text:"text-green-800",  border:"border-green-300",  dot:"bg-green-500"  },
  CANCELLED: { bg:"bg-red-50",    text:"text-red-800",    border:"border-red-200",    dot:"bg-red-400"    },
  NO_SHOW:   { bg:"bg-gray-100",  text:"text-gray-500",   border:"border-gray-200",   dot:"bg-gray-400"   },
};
const STATUS_LABEL: Record<string,string> = {
  PENDING:"รอยืนยัน", CONFIRMED:"ยืนยันแล้ว", COMPLETED:"เสร็จแล้ว", CANCELLED:"ยกเลิก", NO_SHOW:"ไม่มา",
};

/* ─── Date helpers (timezone-safe) ──────────────────────── */
/**
 * Format a Date object as "YYYY-MM-DD" using LOCAL timezone,
 * avoiding the UTC-shift bug of toISOString().slice(0,10).
 */
function toLocalStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Parse "YYYY-MM-DD" as LOCAL noon to avoid DST / midnight edge cases. */
function parseLocal(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function addDays(dateStr: string, n: number): string {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalStr(d);
}

function getWeekMonday(dateStr: string): string {
  const d = parseLocal(dateStr);
  const dow = d.getDay(); // 0=Sun … 6=Sat
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toLocalStr(d);
}

function shiftPeriod(dateStr: string, period: PeriodType, dir: -1 | 1): string {
  const d = parseLocal(dateStr);
  if (period === "day")   d.setDate(d.getDate() + dir);
  if (period === "week")  d.setDate(d.getDate() + dir * 7);
  if (period === "month") d.setMonth(d.getMonth() + dir);
  if (period === "year")  d.setFullYear(d.getFullYear() + dir);
  return toLocalStr(d);
}

function periodLabel(dateStr: string, period: PeriodType, weekDays: string[]): string {
  const d = parseLocal(dateStr);
  if (period === "day")
    return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
  if (period === "week") {
    const s = parseLocal(weekDays[0]);
    const e = parseLocal(weekDays[6]);
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_TH[e.getMonth()]} ${e.getFullYear() + 543}`;
  }
  if (period === "month") return `${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
  return `${d.getFullYear() + 543}`;
}

/** Day-of-week index 0=Mon…6=Sun from a date string. */
function dayIndex(dateStr: string): number {
  const dow = parseLocal(dateStr).getDay(); // 0=Sun
  return (dow + 6) % 7;                    // 0=Mon
}

/* ─── Other helpers ──────────────────────────────────────── */
function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function addMinutes(time: string, mins: number): string {
  const total = timeToMins(time) + mins;
  return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}
function formatPrice(satang: number) {
  return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0 });
}
function makeTimeSlots(step = 30): string[] {
  const slots: string[] = [];
  for (let h = DAY_START; h < DAY_END; h++)
    for (let m = 0; m < 60; m += step)
      slots.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  return slots;
}
function todayStr(): string { return toLocalStr(new Date()); }

/* ─── Off-shift shade helper ─────────────────────────────── */
const SHADE_STYLE: React.CSSProperties = {
  position: "absolute", left: 0, right: 0, pointerEvents: "none", zIndex: 1,
  background: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.035) 5px,rgba(0,0,0,0.035) 6px)",
  backgroundColor: "rgba(0,0,0,0.03)",
};

function OffShiftShade({
  shiftInfo, hasShifts, totalHeight, dayStart, hourPx,
}: {
  shiftInfo:   ShiftInfo | null | undefined;
  hasShifts:   boolean;
  totalHeight: number;
  dayStart:    number;
  hourPx:      number;
}) {
  if (!hasShifts) return null; // legacy mode — no shading
  if (shiftInfo === undefined) return null; // staff not in map yet

  // Full column shaded (staff is off today)
  if (shiftInfo === null) {
    return <div style={{ ...SHADE_STYLE, top: 0, height: totalHeight }} />;
  }

  const shiftStartPx = ((timeToMins(shiftInfo.startTime) - dayStart * 60) / 60) * hourPx;
  const shiftEndPx   = ((timeToMins(shiftInfo.endTime)   - dayStart * 60) / 60) * hourPx;

  return (
    <>
      {shiftStartPx > 0 && (
        <div style={{ ...SHADE_STYLE, top: 0, height: shiftStartPx }} />
      )}
      {shiftEndPx < totalHeight && (
        <div style={{ ...SHADE_STYLE, top: shiftEndPx, height: totalHeight - shiftEndPx }} />
      )}
    </>
  );
}

/* ─── Vertical Gantt — staff columns, one day ───────────── */
function VerticalGantt({
  dayBookings, staff, selectedDate, onClickBooking, staffShiftMap, hasShifts, blockedSlots,
}: {
  dayBookings:  BookingItem[];
  staff:        StaffItem[];
  selectedDate: string;
  onClickBooking: (b: BookingItem) => void;
  staffShiftMap:  StaffShiftMap;
  hasShifts:      boolean;
  blockedSlots:   BlockedSlotItem[];
}) {
  const totalHours = DAY_END - DAY_START;
  const gridHeight = totalHours * HOUR_PX;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START + i);

  const [nowMins, setNowMins] = useState<number | null>(null);
  const isToday = selectedDate === todayStr();
  useEffect(() => {
    const tick = () => {
      if (!isToday) { setNowMins(null); return; }
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const nowTop = nowMins !== null
    ? ((nowMins - DAY_START * 60) / 60) * HOUR_PX
    : null;

  const columns: { id: string | null; name: string }[] = [
    ...staff.map(s => ({ id: s.id, name: s.name })),
    { id: null, name: "ไม่ระบุ" },
  ];

  if (columns.length === 1 && dayBookings.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        ไม่มีพนักงานหรือการจองในวันนี้
      </div>
    );
  }

  return (
    <div className="overflow-auto border border-gray-200 rounded-xl" style={{ maxHeight: "72vh" }}>
      {/* Header — sticky top */}
      <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200"
        style={{ minWidth: TIME_COL + columns.length * COL_W }}>
        <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: TIME_COL }} />
        {columns.map(col => (
          <div key={col.id ?? "__none__"}
            className="flex-shrink-0 flex items-center justify-center font-semibold text-sm text-gray-700 border-r border-gray-200 last:border-r-0 py-3 px-2"
            style={{ width: COL_W }}>
            {col.name}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex relative" style={{ minWidth: TIME_COL + columns.length * COL_W }}>
        {/* Time labels — sticky left */}
        <div className="flex-shrink-0 sticky left-0 z-10 bg-white border-r border-gray-200"
          style={{ width: TIME_COL, height: gridHeight }}>
          {hours.map(h => (
            <div key={h} className="absolute text-xs text-gray-400 text-right"
              style={{ top: (h - DAY_START) * HOUR_PX - 8, right: 8, width: TIME_COL - 8 }}>
              {String(h).padStart(2,"0")}:00
            </div>
          ))}
          {nowTop !== null && nowTop >= 0 && nowTop <= gridHeight && (
            <div className="absolute w-2.5 h-2.5 rounded-full bg-red-500 -translate-y-1/2 z-20"
              style={{ top: nowTop, right: -5 }} />
          )}
        </div>

        {/* Staff columns */}
        {columns.map((col, colIdx) => {
          const colBkgs = dayBookings.filter(b =>
            col.id === null ? b.staff === null : b.staff?.id === col.id
          );
          const shiftInfo = col.id !== null ? (staffShiftMap[col.id] ?? null) : undefined;
          return (
            <div key={col.id ?? "__none__"}
              className="flex-shrink-0 relative border-r border-gray-100 last:border-r-0"
              style={{ width: COL_W, height: gridHeight }}>
              {/* Hour lines */}
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (h - DAY_START) * HOUR_PX }} />
              ))}
              {/* Half-hour dashed */}
              {hours.slice(0,-1).map(h => (
                <div key={`${h}h`} className="absolute left-0 right-0 border-t border-dashed border-gray-50"
                  style={{ top: (h - DAY_START) * HOUR_PX + HOUR_PX / 2 }} />
              ))}
              {/* Off-shift shading */}
              <OffShiftShade
                shiftInfo={shiftInfo}
                hasShifts={hasShifts}
                totalHeight={gridHeight}
                dayStart={DAY_START}
                hourPx={HOUR_PX}
              />
              {/* Now line — spans all columns via first column */}
              {colIdx === 0 && nowTop !== null && nowTop >= 0 && nowTop <= gridHeight && (
                <div className="absolute left-0 border-t-2 border-red-400/60 pointer-events-none z-10"
                  style={{ top: nowTop, width: columns.length * COL_W }} />
              )}
              {/* Booking blocks */}
              {colBkgs.map(b => {
                const top    = ((timeToMins(b.startTime) - DAY_START * 60) / 60) * HOUR_PX;
                const height = Math.max(((timeToMins(b.endTime) - timeToMins(b.startTime)) / 60) * HOUR_PX, 22);
                const c = STATUS_COLOR[b.status] ?? STATUS_COLOR.PENDING;
                return (
                  <div key={b.id}
                    className={`absolute left-1 right-1 rounded-lg border cursor-pointer select-none transition-shadow hover:shadow-md hover:z-20 ${c.bg} ${c.border}`}
                    style={{ top, height, zIndex: 5 }}
                    onClick={() => onClickBooking(b)}>
                    <div className={`px-1.5 py-1 text-[11px] leading-tight ${c.text}`}>
                      <div className="font-semibold truncate">
                        {b.customer.nickname
                          ? `${b.customer.name.split(" ")[0]} (${b.customer.nickname})`
                          : b.customer.name.split(" ")[0]}
                      </div>
                      <div className="opacity-70 truncate">{b.startTime}</div>
                      {height > 44 && (
                        <div className="opacity-60 truncate text-[10px]">
                          {b.service.nameTh || b.service.name}
                        </div>
                      )}
                      {height > 68 && b.addons.length > 0 && (
                        <div className="opacity-60 truncate text-[10px]" style={{ color: "#8B1D24" }}>
                          +{b.addons.length} เสริม
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Blocked slot bars */}
              {blockedSlots
                .filter(bl => bl.staffId === null || bl.staffId === col.id)
                .map(bl => {
                  const top    = ((timeToMins(bl.startTime) - DAY_START * 60) / 60) * HOUR_PX;
                  const height = Math.max(((timeToMins(bl.endTime) - timeToMins(bl.startTime)) / 60) * HOUR_PX, 18);
                  return (
                    <div key={bl.id}
                      className="absolute left-1 right-1 rounded-lg border select-none"
                      style={{
                        top, height, zIndex: 6,
                        backgroundColor: "rgba(75,85,99,0.12)",
                        borderColor: "#9CA3AF",
                        background: "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(75,85,99,0.12) 4px,rgba(75,85,99,0.12) 5px)",
                      }}>
                      <div className="px-1.5 py-1 text-[10px] leading-tight text-gray-500 font-medium truncate">
                        🚫 {bl.reason || "ปิดเวลา"}
                        {height > 32 && <div className="opacity-70">{bl.startTime}–{bl.endTime}</div>}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Horizontal Gantt — staff rows, time X-axis ─────────── */
function HorizontalGantt({
  dayBookings, staff, onClickBooking, staffShiftMap, hasShifts,
}: {
  dayBookings:    BookingItem[];
  staff:          StaffItem[];
  onClickBooking: (b: BookingItem) => void;
  staffShiftMap:  StaffShiftMap;
  hasShifts:      boolean;
}) {
  const totalHours = DAY_END - DAY_START;
  const gridWidth  = totalHours * HOUR_PX_H;
  const NAME_COL   = 120;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START + i);
  const rows: { id: string | null; name: string }[] = [
    ...staff.map(s => ({ id: s.id, name: s.name })),
    { id: null, name: "ไม่ระบุ" },
  ];

  return (
    <div className="overflow-auto border border-gray-200 rounded-xl" style={{ maxHeight: "72vh" }}>
      <div style={{ minWidth: NAME_COL + gridWidth }}>
        {/* Time header */}
        <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200"
          style={{ minWidth: NAME_COL + gridWidth }}>
          <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: NAME_COL }} />
          <div className="relative" style={{ height: 36, width: gridWidth }}>
            {hours.map(h => (
              <span key={h} className="absolute text-xs text-gray-400 -translate-x-1/2"
                style={{ left: (h - DAY_START) * HOUR_PX_H, top: 10 }}>
                {String(h).padStart(2,"0")}:00
              </span>
            ))}
          </div>
        </div>
        {rows.map(row => {
          const rowBkgs = dayBookings.filter(b =>
            row.id === null ? b.staff === null : b.staff?.id === row.id
          );
          const shiftInfo = row.id !== null ? (staffShiftMap[row.id] ?? null) : undefined;
          return (
            <div key={row.id ?? "__none__"} className="flex border-b border-gray-100 last:border-b-0"
              style={{ height: ROW_H, minWidth: NAME_COL + gridWidth }}>
              <div className="flex-shrink-0 sticky left-0 z-10 bg-white border-r border-gray-200 flex items-center px-3"
                style={{ width: NAME_COL }}>
                <span className="text-sm text-gray-700 truncate">{row.name}</span>
              </div>
              <div className="relative" style={{ width: gridWidth, height: ROW_H }}>
                {hours.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: (h - DAY_START) * HOUR_PX_H }} />
                ))}
                {/* Off-shift shading (horizontal — shade left/right outside shift) */}
                {hasShifts && shiftInfo !== undefined && (() => {
                  if (shiftInfo === null) {
                    return <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                      background:"repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.035) 5px,rgba(0,0,0,0.035) 6px)",
                      backgroundColor:"rgba(0,0,0,0.03)" }} />;
                  }
                  const startPx = ((timeToMins(shiftInfo.startTime) - DAY_START*60) / 60) * HOUR_PX_H;
                  const endPx   = ((timeToMins(shiftInfo.endTime)   - DAY_START*60) / 60) * HOUR_PX_H;
                  const shadeStyle: React.CSSProperties = {
                    position:"absolute", top:0, bottom:0, pointerEvents:"none",
                    background:"repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.035) 5px,rgba(0,0,0,0.035) 6px)",
                    backgroundColor:"rgba(0,0,0,0.03)",
                  };
                  return (<>
                    {startPx > 0    && <div style={{ ...shadeStyle, left:0, width: startPx }} />}
                    {endPx < gridWidth && <div style={{ ...shadeStyle, left: endPx, width: gridWidth - endPx }} />}
                  </>);
                })()}
                {rowBkgs.map(b => {
                  const startMins = timeToMins(b.startTime) - DAY_START * 60;
                  const endMins   = timeToMins(b.endTime)   - DAY_START * 60;
                  const left  = (startMins / 60) * HOUR_PX_H;
                  const width = Math.max(((endMins - startMins) / 60) * HOUR_PX_H - 4, 24);
                  const c = STATUS_COLOR[b.status] ?? STATUS_COLOR.PENDING;
                  return (
                    <div key={b.id}
                      className={`absolute rounded-lg border cursor-pointer select-none transition-shadow hover:shadow-md ${c.bg} ${c.border}`}
                      style={{ left, width, top: 8, height: ROW_H - 16, zIndex: 5 }}
                      onClick={() => onClickBooking(b)}>
                      <div className={`px-2 py-1 text-xs leading-tight truncate ${c.text}`}>
                        <span className="font-semibold">
                          {b.customer.nickname
                            ? `${b.customer.name.split(" ")[0]} (${b.customer.nickname})`
                            : b.customer.name.split(" ")[0]}
                        </span>
                        <span className="opacity-70 ml-1">{b.startTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── List View ──────────────────────────────────────────── */
function ListView({ weekBookings, onClickBooking }: {
  weekBookings: BookingItem[];
  onClickBooking: (b: BookingItem) => void;
}) {
  // Group + sort by day once — recomputing on every parent render was wasteful.
  const { grouped, sortedDays } = useMemo(() => {
    const map: Record<string, BookingItem[]> = {};
    for (const b of weekBookings) {
      const day = b.date.slice(0, 10);
      (map[day] ??= []).push(b);
    }
    return { grouped: map, sortedDays: Object.keys(map).sort() };
  }, [weekBookings]);

  if (sortedDays.length === 0)
    return <div className="text-center py-16 text-gray-400">ไม่มีการจองในช่วงนี้</div>;

  return (
    <div className="space-y-6">
      {sortedDays.map(day => {
        const d = parseLocal(day);
        const di = dayIndex(day);
        return (
          <div key={day}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B1D24] flex flex-col items-center justify-center text-white leading-tight">
                <span className="text-[10px] opacity-80">{DAYS_EN[di]}</span>
                <span className="text-base font-bold">{d.getDate()}</span>
              </div>
              <div>
                <div className="font-semibold text-[#3B2A24]">
                  {DAYS_TH[di]} {d.getDate()} {MONTHS_TH[d.getMonth()]}
                </div>
                <div className="text-xs text-gray-400">{grouped[day].length} การจอง</div>
              </div>
            </div>
            <div className="space-y-2">
              {grouped[day].map(b => {
                const c = STATUS_COLOR[b.status] ?? STATUS_COLOR.PENDING;
                return (
                  <div key={b.id} onClick={() => onClickBooking(b)}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow ${c.bg} ${c.border}`}>
                    <div className="w-20 text-center flex-shrink-0">
                      <div className={`text-sm font-bold ${c.text}`}>{b.startTime}</div>
                      <div className="text-xs text-gray-400">–{b.endTime}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm truncate ${c.text}`}>
                        {b.customer.nickname
                          ? `${b.customer.name.split(" ")[0]} (${b.customer.nickname})`
                          : b.customer.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {b.service.nameTh || b.service.name} · {b.customer.phone}
                      </div>
                      {b.addons.length > 0 && (
                        <div className="text-xs truncate mt-0.5" style={{ color: "#8B1D24" }}>
                          + {b.addons.map(a => a.nameTh || a.name).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0 hidden sm:block w-24 truncate text-center">
                      {b.staff?.name ?? "—"}
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                    <div className={`flex-shrink-0 text-sm font-semibold ${c.text} hidden sm:block`}>
                      ฿{formatPrice(b.totalPrice)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ─── Main Component ─────────────────────────────────────── */
export default function CalendarView({
  weekBookings, staff, selectedDate, branches, activeBranchId, branchServices, addons,
}: Props) {
  const router = useRouter();
  const [view,          setView]         = useState<ViewMode>("list");
  const [period,        setPeriod]       = useState<PeriodType>("week");
  const [editItem,      setEditItem]     = useState<BookingItem | null>(null);
  const [addOpen,       setAddOpen]      = useState(false);
  const [blockOpen,     setBlockOpen]    = useState(false);
  const [staffShiftMap, setStaffShiftMap] = useState<StaffShiftMap>({});
  const [hasShifts,     setHasShifts]   = useState(false);
  const [blockedSlots,  setBlockedSlots] = useState<BlockedSlotItem[]>([]);

  // Fetch shifts + blocked slots whenever date or branch changes
  useEffect(() => {
    if (!activeBranchId) return;
    fetch(`/api/admin/branches/${activeBranchId}/shifts?from=${selectedDate}&to=${selectedDate}`)
      .then(r => r.json())
      .then((data: { staff: { id: string; shifts: { startTime: string; endTime: string }[] }[] }) => {
        const map: StaffShiftMap = {};
        let anyShifts = false;
        for (const s of data.staff ?? []) {
          const shift = s.shifts[0] ?? null;
          map[s.id] = shift;
          if (shift) anyShifts = true;
        }
        setStaffShiftMap(map);
        setHasShifts(anyShifts);
      })
      .catch(() => {});
  }, [selectedDate, activeBranchId]);

  function refreshBlocks() {
    if (!activeBranchId) return;
    fetch(`/api/admin/branches/${activeBranchId}/blocked-slots?date=${selectedDate}`)
      .then(r => r.json())
      .then((data: { slots: BlockedSlotItem[] }) => setBlockedSlots(data.slots ?? []))
      .catch(() => {});
  }
  useEffect(() => { refreshBlocks(); }, [selectedDate, activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize derived data — these were recomputed on every render (including
  // every status flip, every modal toggle). For a calendar with hundreds of
  // bookings the filter/reduce was wasted work.
  const weekDays = useMemo(() => {
    const monday = getWeekMonday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selectedDate]);

  const today = todayStr();

  function navigate(date: string, branch?: string) {
    router.push(`/admin/calendar?date=${date}&branchId=${branch ?? activeBranchId}`);
  }

  const dayBookings = useMemo(
    () => weekBookings.filter(b => b.date.slice(0, 10) === selectedDate),
    [weekBookings, selectedDate],
  );
  const totalForDay = useMemo(
    () => dayBookings.reduce((s, b) => s + b.totalPrice, 0),
    [dayBookings],
  );
  const totalForWeek = useMemo(
    () => weekBookings.reduce((s, b) => s + b.totalPrice, 0),
    [weekBookings],
  );

  const selDayIndex = dayIndex(selectedDate);

  return (
    <div className="flex flex-col gap-4 p-6 bg-[#FDF8F3] min-h-screen">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2A24]">ปฏิทิน</h1>
          <p className="text-xs text-gray-400">
            {DAYS_TH[selDayIndex]} {parseLocal(selectedDate).getDate()} {MONTHS_TH[parseLocal(selectedDate).getMonth()]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={activeBranchId} onChange={e => navigate(selectedDate, e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
            {branches.map(br => <option key={br.id} value={br.id}>{br.name}</option>)}
          </select>
          <button onClick={() => setBlockOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: "#374151", color: "white" }}>
            🚫 ปิดเวลา
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#8B1D24] text-white text-sm font-semibold hover:bg-[#7a1820] transition-colors">
            + จองใหม่
          </button>
        </div>
      </div>

      {/* ── Compact navigator ── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Period type pills */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(["day","week","month","year"] as PeriodType[]).map(p => {
            const labels: Record<PeriodType,string> = { day:"วัน", week:"สัปดาห์", month:"เดือน", year:"ปี" };
            return (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p ? "bg-white text-[#8B1D24] shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"
                }`}>
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Prev / Label / Next */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => navigate(today)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-[#8B1D24]/40 hover:text-[#8B1D24] transition-colors">
            วันนี้
          </button>
          <button onClick={() => navigate(shiftPeriod(selectedDate, period, -1))}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">‹</button>
          <span className="text-sm font-semibold text-[#3B2A24] min-w-[160px] text-center">
            {periodLabel(selectedDate, period, weekDays)}
          </span>
          <button onClick={() => navigate(shiftPeriod(selectedDate, period, 1))}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">›</button>
        </div>

        {/* Mini day pills — Day / Week mode */}
        {(period === "day" || period === "week") && (
          <div className="w-full flex gap-1 pt-1">
            {weekDays.map((day, i) => {
              const isSelected = day === selectedDate;
              const isToday    = day === today;
              const count = weekBookings.filter(b => b.date.slice(0, 10) === day).length;
              const d = parseLocal(day);
              return (
                <button key={day} onClick={() => navigate(day)}
                  className={`flex-1 flex flex-col items-center rounded-lg py-1.5 transition-colors text-xs ${
                    isSelected ? "bg-[#8B1D24] text-white" :
                    isToday    ? "bg-[#FDF8F3] text-[#8B1D24] border border-[#8B1D24]/30" :
                                 "hover:bg-gray-50 text-gray-500"
                  }`}>
                  <span className="font-medium text-[10px] opacity-70">{DAYS_EN[i]}</span>
                  <span className="font-bold">{d.getDate()}</span>
                  {count > 0
                    ? <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white/70" : "bg-[#8B1D24]"}`} />
                    : <span className="w-1 h-1 mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"การจองวันที่เลือก",  value: dayBookings.length,          unit:"รายการ" },
          { label:"รายได้วันที่เลือก",  value:`฿${formatPrice(totalForDay)}`,   unit:"" },
          { label:"การจองสัปดาห์",      value: weekBookings.length,         unit:"รายการ" },
          { label:"รายได้สัปดาห์",      value:`฿${formatPrice(totalForWeek)}`,  unit:"" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className="text-lg font-bold text-[#3B2A24]">
              {s.value}
              {s.unit && <span className="text-sm font-normal text-gray-500 ml-1">{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── View toggle ── */}
      <div className="flex items-center gap-2">
        {(["list","vertical"] as ViewMode[]).map(v => {
          const labels: Record<string,string> = {
            list:"☰ รายการ", vertical:"⬇ แนวตั้ง",
          };
          return (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                view === v ? "bg-[#8B1D24] text-white border-[#8B1D24]"
                           : "bg-white text-gray-600 border-gray-200 hover:border-[#8B1D24]/40"
              }`}>
              {labels[v]}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-gray-400">
          {dayBookings.length} การจองวันที่เลือก
        </span>
      </div>

      {/* ── Calendar body ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        {view === "vertical" && (
          <VerticalGantt
            dayBookings={dayBookings} staff={staff}
            selectedDate={selectedDate} onClickBooking={setEditItem}
            staffShiftMap={staffShiftMap} hasShifts={hasShifts}
            blockedSlots={blockedSlots}
          />
        )}
        {view === "list" && (
          <>
            {blockedSlots.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ช่วงเวลาที่ปิด</p>
                {blockedSlots.map(bl => (
                  <div key={bl.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                    <span className="text-sm text-gray-400">🚫</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700">{bl.startTime} – {bl.endTime}</span>
                      {bl.staff && <span className="ml-2 text-xs text-gray-500">({bl.staff.name})</span>}
                      {!bl.staff && <span className="ml-2 text-xs text-gray-500">(ทั้งสาขา)</span>}
                      {bl.reason && <span className="ml-2 text-xs text-gray-400">· {bl.reason}</span>}
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("ลบช่วงเวลาที่ปิดนี้?")) return;
                        await fetch(`/api/admin/blocked-slots/${bl.id}`, { method: "DELETE" });
                        refreshBlocks();
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded">
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ListView weekBookings={dayBookings} onClickBooking={setEditItem} />
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {editItem && (
        <EditModal
          booking={editItem} branchId={activeBranchId} branches={branches} staff={staff}
          onClose={() => setEditItem(null)}
          onSaved={() => router.refresh()}
        />
      )}
      {addOpen && (
        <AddBookingModal
          defaultDate={selectedDate} branchId={activeBranchId} staff={staff}
          branchServices={branchServices} addons={addons}
          onClose={() => setAddOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
      {blockOpen && (
        <BlockSlotModal
          defaultDate={selectedDate} branchId={activeBranchId} staff={staff}
          onClose={() => setBlockOpen(false)}
          onSaved={() => { router.refresh(); refreshBlocks(); }}
        />
      )}
    </div>
  );
}
