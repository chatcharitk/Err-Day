"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export interface RosterStaff {
  id:     string;
  name:   string;
  /** "YYYY-MM-DD" → that day's shifts (a staff member can have two). */
  byDate: Record<string, { start: string; end: string }[]>;
}

/** "10:00" → "10", "10:30" → "10:30" — keeps the chips short. */
function shortTime(t: string): string {
  return t.endsWith(":00") ? String(Number(t.slice(0, 2))) : t;
}
const range = (s: { start: string; end: string }) => `${shortTime(s.start)}–${shortTime(s.end)}`;

/**
 * Small "who is working" card for the booking-queue page: the selected day's
 * crew with hours and queue count, and a tap-open week grid so a customer
 * asking "Saturday — who's in?" can be answered without leaving the page.
 */
export default function StaffRoster({
  staff, days, selectedDate, todayDate, queueByName, onPickDate,
}: {
  staff:        RosterStaff[];
  /** The 7 dates the date strip shows. */
  days:         string[];
  selectedDate: string;
  todayDate:    string;
  /** staff name → number of (non-cancelled) bookings on the selected day. */
  queueByName:  Record<string, number>;
  onPickDate:   (date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const anyShift = staff.some((s) => days.some((d) => (s.byDate[d]?.length ?? 0) > 0));
  const working  = staff.filter((s) => (s.byDate[selectedDate]?.length ?? 0) > 0);
  const off      = staff.filter((s) => (s.byDate[selectedDate]?.length ?? 0) === 0);

  if (staff.length === 0) return null;

  return (
    <section className="px-4 pb-2">
      <div className="rounded-2xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
          <p className="text-sm font-semibold" style={{ color: TEXT }}>
            ช่างเข้างาน
            {anyShift && <span className="font-normal" style={{ color: MUTED }}> · {working.length} คน</span>}
          </p>
          {anyShift && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-0.5 text-xs font-medium py-1 pl-2"
              style={{ color: PRIMARY }}
            >
              ทั้งสัปดาห์ {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {!anyShift ? (
          <p className="px-3.5 pb-3 text-xs" style={{ color: MUTED }}>
            ยังไม่ได้ลงตารางงานช่วงนี้ ·{" "}
            <Link href="/admin/m/shifts" className="underline" style={{ color: PRIMARY }}>ลงตารางงาน</Link>
          </p>
        ) : (
          <>
            <div className="px-3.5 pb-2.5">
              {working.length === 0 ? (
                <p className="text-xs" style={{ color: MUTED }}>วันนี้ไม่มีช่างเข้างาน</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {working.map((s) => {
                    const q = queueByName[s.name] ?? 0;
                    return (
                      <span key={s.id} className="rounded-lg px-2 py-1 text-xs leading-tight"
                            style={{ background: "#FFF8F4", border: `1px solid ${BORDER}`, color: TEXT }}>
                        <span className="font-semibold">{s.name}</span>{" "}
                        <span style={{ color: MUTED }}>{s.byDate[selectedDate].map(range).join(", ")}</span>
                        {q > 0 && <span className="font-medium" style={{ color: PRIMARY }}> · {q} คิว</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              {off.length > 0 && working.length > 0 && (
                <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
                  หยุด: {off.map((s) => s.name).join(", ")}
                </p>
              )}
            </div>

            {open && (
              <div className="px-2 pb-3 overflow-x-auto" style={{ borderTop: `1px solid ${BORDER}` }}>
                <table className="w-full text-center border-separate" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className="w-14" />
                      {days.map((d) => {
                        const [y, m, dd] = d.split("-").map(Number);
                        const sel = d === selectedDate;
                        return (
                          <th key={d} className="pt-2 pb-1 font-normal">
                            <button
                              onClick={() => onPickDate(d)}
                              className="w-full rounded-lg py-1 leading-tight"
                              style={{ background: sel ? PRIMARY : "transparent", color: sel ? "white" : TEXT }}
                            >
                              <span className="block text-[10px] opacity-70">{DOW_TH[new Date(y, m - 1, dd).getDay()]}</span>
                              <span className="block text-sm font-semibold">{dd}</span>
                              {d === todayDate && <span className="block text-[8px] leading-none opacity-70">วันนี้</span>}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td className="text-left text-xs font-medium pl-1.5 pr-1 py-1 truncate max-w-[56px]"
                            style={{ color: TEXT, borderTop: `1px solid ${BORDER}` }}>
                          {s.name}
                        </td>
                        {days.map((d) => {
                          const list = s.byDate[d] ?? [];
                          return (
                            <td key={d} className="py-1 px-0.5 align-middle"
                                style={{ borderTop: `1px solid ${BORDER}`, background: d === selectedDate ? "#FFF8F4" : "transparent" }}>
                              {list.length === 0 ? (
                                <span className="text-xs" style={{ color: BORDER }}>–</span>
                              ) : list.map((x, i) => (
                                <span key={i} className="block text-[10px] leading-tight font-medium whitespace-nowrap" style={{ color: TEXT }}>
                                  {range(x)}
                                </span>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-right text-[11px] pt-1.5 pr-1">
                  <Link href="/admin/m/shifts" className="underline" style={{ color: MUTED }}>แก้ตารางงาน</Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
