"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";

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
  serviceId: string;
  service: { name: string; nameTh: string; category: string };
  customer: { id: string; name: string; phone: string };
  staff: { id: string; name: string } | null;
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
interface Props {
  weekBookings: BookingItem[];
  staff: StaffItem[];
  selectedDate: string;   // "YYYY-MM-DD"
  branches: BranchItem[];
  activeBranchId: string;
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

/* ─── Portal — escapes <main overflow-auto> stacking context ─ */
function Modal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
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
  dayBookings, staff, selectedDate, onClickBooking, staffShiftMap, hasShifts,
}: {
  dayBookings:  BookingItem[];
  staff:        StaffItem[];
  selectedDate: string;
  onClickBooking: (b: BookingItem) => void;
  staffShiftMap:  StaffShiftMap;
  hasShifts:      boolean;
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
                      <div className="font-semibold truncate">{b.customer.name}</div>
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
                        <span className="font-semibold">{b.customer.name}</span>
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
  const grouped: Record<string, BookingItem[]> = {};
  for (const b of weekBookings) {
    const day = b.date.slice(0, 10);
    (grouped[day] ??= []).push(b);
  }
  const sortedDays = Object.keys(grouped).sort();

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
                        {b.customer.name}
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

/* ─── Shared service + time fields ──────────────────────── */
function ServiceTimeFields({
  services, serviceId, startTime, endTime,
  onServiceChange, onStartChange, onEndChange,
}: {
  services: ServiceOption[];
  serviceId: string;
  startTime: string;
  endTime: string;
  onServiceChange: (id: string) => void;
  onStartChange: (t: string) => void;
  onEndChange: (t: string) => void;
}) {
  const timeSlots = makeTimeSlots(30);
  const endSlots  = timeSlots.filter(t => timeToMins(t) > timeToMins(startTime));

  return (
    <>
      <div>
        <label className="text-xs text-gray-500 block mb-1">บริการ</label>
        <select value={serviceId} onChange={e => onServiceChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
          {services.length === 0 && <option value="">กำลังโหลด...</option>}
          {services.map(s => (
            <option key={s.id} value={s.id}>
              {s.service.nameTh || s.service.name} — ฿{formatPrice(s.price)} ({s.duration} นาที)
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">เวลาเริ่ม</label>
          <select value={startTime} onChange={e => onStartChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">เวลาสิ้นสุด</label>
          <select value={endTime} onChange={e => onEndChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
            {endSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

/* ─── Edit / Checkout Modal ──────────────────────────────── */
function EditModal({
  booking, branchId, staff, onClose, onSaved,
}: {
  booking: BookingItem;
  branchId: string;
  staff: StaffItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [services,      setServices]      = useState<ServiceOption[]>([]);
  // serviceId here = BranchService.id (different from booking.serviceId = Service.id)
  const [bsId,          setBsId]          = useState("");
  const [startTime,     setStartTime]     = useState(booking.startTime);
  const [endTime,       setEndTime]       = useState(booking.endTime);
  const [price,         setPrice]         = useState(booking.totalPrice);
  const [selectedStaff, setSelectedStaff] = useState(booking.staff?.id ?? "");
  const [notes,         setNotes]         = useState(booking.notes ?? "");
  const [saving,        setSaving]        = useState(false);
  const [checkedOut,    setCheckedOut]    = useState(booking.status === "COMPLETED");
  const [currentStatus, setCurrentStatus] = useState(booking.status);

  const c = STATUS_COLOR[currentStatus] ?? STATUS_COLOR.PENDING;

  useEffect(() => {
    fetch(`/api/services?branchId=${branchId}`)
      .then(r => r.json())
      .then((data: ServiceOption[]) => {
        setServices(data);
        // Match by Service.id (booking.serviceId is the Service.id, not BranchService.id)
        const match = data.find(s => s.service.id === booking.serviceId);
        if (match) {
          setBsId(match.id);
          setPrice(match.price);
        } else if (data.length > 0) {
          setBsId(data[0].id);
        }
      });
  }, [branchId, booking.serviceId]);

  function handleServiceChange(id: string) {
    setBsId(id);
    const svc = services.find(s => s.id === id);
    if (svc) {
      setEndTime(addMinutes(startTime, svc.duration));
      setPrice(svc.price);
    }
  }

  function handleStartChange(t: string) {
    setStartTime(t);
    const svc = services.find(s => s.id === bsId);
    if (svc) setEndTime(addMinutes(t, svc.duration));
  }

  async function patchStatus(status: string) {
    setSaving(true);
    await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    setCurrentStatus(status);
    if (status === "COMPLETED") setCheckedOut(true);
    onSaved();
  }

  async function save() {
    setSaving(true);
    const selectedSvc = services.find(s => s.id === bsId);
    await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(selectedSvc ? { serviceId: selectedSvc.service.id } : {}),
        startTime,
        endTime,
        totalPrice: price,
        staffId: selectedStaff || null,
        notes: notes || null,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal>
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`px-5 py-4 ${c.bg} border-b ${c.border} flex-shrink-0`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-sm text-gray-800 flex items-center gap-2 flex-wrap">
                <Link
                  href={`/admin/customers?id=${booking.customer.id}`}
                  className="hover:underline"
                  style={{ color: "#8B1D24" }}
                  title="ดูข้อมูลลูกค้า"
                >
                  {booking.customer.name}
                </Link>
                <span className="text-gray-400 font-normal">·</span>
                <span className="font-normal text-xs text-gray-600">{booking.customer.phone}</span>
                <Link
                  href={`/admin/customers?id=${booking.customer.id}`}
                  className="text-xs px-2 py-0.5 rounded-full font-medium hover:bg-blue-100 transition-colors"
                  style={{ color: "#2563EB", border: "1px solid #BFDBFE", background: "#EFF6FF" }}
                >
                  ดูข้อมูลลูกค้า →
                </Link>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(() => {
                  const d = parseLocal(booking.date.slice(0, 10));
                  const di = dayIndex(booking.date.slice(0, 10));
                  return `${DAYS_TH[di]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]}`;
                })()}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Price + status */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-[#3B2A24]">฿{formatPrice(price)}</span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${c.bg} ${c.text} ${c.border}`}>
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              {STATUS_LABEL[currentStatus] ?? currentStatus}
            </span>
          </div>

          {booking.addons.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "#FFF8F4", border: "1px solid #E8D8CC" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8B1D24" }}>
                บริการเสริม / Add-Ons
              </p>
              {booking.addons.map((a) => (
                <div key={a.id} className="flex justify-between text-xs" style={{ color: "#5C4A42" }}>
                  <span>{a.nameTh || a.name}</span>
                  <span className="font-medium">+฿{formatPrice(a.price)}</span>
                </div>
              ))}
            </div>
          )}

          {checkedOut && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-green-700 font-medium text-sm">
              ✓ ชำระเงินแล้ว — เสร็จสิ้น
            </div>
          )}

          {/* Status buttons */}
          {!checkedOut && (
            <div>
              <p className="text-xs text-gray-400 mb-2">เปลี่ยนสถานะ</p>
              <div className="flex flex-wrap gap-2">
                {currentStatus !== "CONFIRMED" && (
                  <button onClick={() => patchStatus("CONFIRMED")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium hover:bg-blue-100 disabled:opacity-50">
                    ✓ ยืนยัน
                  </button>
                )}
                {currentStatus !== "NO_SHOW" && (
                  <button onClick={() => patchStatus("NO_SHOW")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                    ไม่มา
                  </button>
                )}
                {currentStatus !== "CANCELLED" && (
                  <button onClick={() => patchStatus("CANCELLED")} disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                    ยกเลิก
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Service + time */}
          <ServiceTimeFields
            services={services}
            serviceId={bsId}
            startTime={startTime}
            endTime={endTime}
            onServiceChange={handleServiceChange}
            onStartChange={handleStartChange}
            onEndChange={setEndTime}
          />

          {/* Staff */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">พนักงาน</label>
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
              <option value="">ไม่ระบุ</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">หมายเหตุ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30"
              placeholder="หมายเหตุ..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 flex-shrink-0">
          {!checkedOut && (
            <button
              onClick={() => router.push(`/admin/pos?bookingId=${booking.id}&branchId=${branchId}`)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50">
              💳 เช็คเอาท์
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#8B1D24] text-white font-semibold text-sm hover:bg-[#7a1820] disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
    </Modal>
  );
}

/* ─── Add Booking Modal ──────────────────────────────────── */
function AddBookingModal({
  defaultDate, branchId, staff, onClose, onSaved,
}: {
  defaultDate: string;
  branchId: string;
  staff: StaffItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [services,  setServices]  = useState<ServiceOption[]>([]);
  const [date,      setDate]      = useState(defaultDate);
  const [bsId,      setBsId]      = useState("");
  const [staffId,   setStaffId]   = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime,   setEndTime]   = useState("11:00");
  const [customer,  setCustomer]  = useState<CustomerValue>({ id: null, name: "", phone: "" });
  const [notesVal,  setNotesVal]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const name  = customer.name;
  const phone = customer.phone;

  useEffect(() => {
    fetch(`/api/services?branchId=${branchId}`)
      .then(r => r.json())
      .then((data: ServiceOption[]) => {
        setServices(data);
        if (data.length > 0) {
          setBsId(data[0].id);
          setEndTime(addMinutes("10:00", data[0].duration));
        }
      });
  }, [branchId]);

  function handleServiceChange(id: string) {
    setBsId(id);
    const svc = services.find(s => s.id === id);
    if (svc) setEndTime(addMinutes(startTime, svc.duration));
  }

  function handleStartChange(t: string) {
    setStartTime(t);
    const svc = services.find(s => s.id === bsId);
    if (svc) setEndTime(addMinutes(t, svc.duration));
  }

  const selectedSvc = services.find(s => s.id === bsId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !phone.trim() || !bsId) {
      setError("กรุณากรอกชื่อ เบอร์โทร และบริการ");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        serviceId: selectedSvc?.service.id ?? bsId,
        staffId: staffId || null,
        date,
        startTime,
        endTime,
        totalPrice: selectedSvc?.price ?? 0,
        name: name.trim(),
        phone: phone.trim(),
        notes: notesVal || null,
        skipConflictCheck: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal>
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-[#8B1D24] text-white flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-base">+ จองใหม่</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3 overflow-y-auto">
          {/* Date */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30" />
          </div>

          {/* Service + time */}
          <ServiceTimeFields
            services={services} serviceId={bsId} startTime={startTime} endTime={endTime}
            onServiceChange={handleServiceChange}
            onStartChange={handleStartChange}
            onEndChange={setEndTime}
          />

          {/* Staff */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">พนักงาน</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30">
              <option value="">ไม่ระบุ</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">ลูกค้า *</label>
            <CustomerSearch value={customer} onChange={setCustomer} requirePhoneOnCreate />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">หมายเหตุ</label>
            <input value={notesVal} onChange={e => setNotesVal(e.target.value)}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D24]/30" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#8B1D24] text-white font-semibold text-sm hover:bg-[#7a1820] disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "✓ บันทึกการจอง"}
          </button>
        </form>
      </div>
    </div>
    </Modal>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function CalendarView({
  weekBookings, staff, selectedDate, branches, activeBranchId,
}: Props) {
  const router = useRouter();
  const [view,         setView]         = useState<ViewMode>("list");
  const [period,       setPeriod]       = useState<PeriodType>("week");
  const [editItem,     setEditItem]     = useState<BookingItem | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [staffShiftMap, setStaffShiftMap] = useState<StaffShiftMap>({});
  const [hasShifts,    setHasShifts]    = useState(false);

  // Fetch shifts for the selected date whenever date or branch changes
  useEffect(() => {
    if (!activeBranchId) return;
    fetch(`/api/admin/branches/${activeBranchId}/shifts?from=${selectedDate}&to=${selectedDate}`)
      .then(r => r.json())
      .then((data: { staff: { id: string; shifts: { startTime: string; endTime: string }[] }[] }) => {
        const map: StaffShiftMap = {};
        let anyShifts = false;
        for (const s of data.staff ?? []) {
          const shift = s.shifts[0] ?? null; // at most 1 shift per staff per day
          map[s.id] = shift;
          if (shift) anyShifts = true;
        }
        setStaffShiftMap(map);
        setHasShifts(anyShifts);
      })
      .catch(() => {});
  }, [selectedDate, activeBranchId]);

  const monday   = getWeekMonday(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today    = todayStr();

  function navigate(date: string, branch?: string) {
    router.push(`/admin/calendar?date=${date}&branchId=${branch ?? activeBranchId}`);
  }

  const dayBookings  = weekBookings.filter(b => b.date.slice(0, 10) === selectedDate);
  const totalForDay  = dayBookings.reduce((s, b) => s + b.totalPrice, 0);
  const totalForWeek = weekBookings.reduce((s, b) => s + b.totalPrice, 0);

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
          />
        )}
        {view === "list" && (
          <ListView weekBookings={dayBookings} onClickBooking={setEditItem} />
        )}
      </div>

      {/* ── Modals ── */}
      {editItem && (
        <EditModal
          booking={editItem} branchId={activeBranchId} staff={staff}
          onClose={() => setEditItem(null)}
          onSaved={() => router.refresh()}
        />
      )}
      {addOpen && (
        <AddBookingModal
          defaultDate={selectedDate} branchId={activeBranchId} staff={staff}
          onClose={() => setAddOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
