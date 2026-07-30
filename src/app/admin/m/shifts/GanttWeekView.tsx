"use client";

/**
 * Weekly Gantt view for mobile shift editing — an alternative to the per-staff
 * day-list in MobileShiftsManager, showing all staff as lanes against a single
 * time axis per day so gaps in coverage are visible at a glance.
 *
 * Editing model (deliberately scoped — see MobileShiftsManager's view toggle):
 *   - Drag a bar's LEFT/RIGHT edge  → resize that end's time (same person, same day)
 *   - Drag a bar's MIDDLE           → slide the whole shift earlier/later (same duration)
 *   - Tap a bar, or an empty lane   → opens the existing time-picker sheet
 * Moving a shift to a different DAY or a different STAFF member is intentionally
 * NOT a drag gesture here — touch precision on a narrow screen makes an accidental
 * reassignment-by-drag too easy to trigger by mistake. Those changes still go
 * through the tap-to-edit sheet / the List view, same as before this feature.
 *
 * Time-axis drag only ever calls the existing bulk shifts API (delete the old
 * row, create the new one) — the exact same save path the tap-to-edit sheet
 * already uses, so there is no new persistence logic to trust.
 */

import { useRef, useState } from "react";

interface Staff { id: string; name: string }
interface Shift { id: string; date: string; startTime: string; endTime: string }

interface Props {
  weekDays:        Date[];                    // 7 Date objects, Monday..Sunday
  staff:           Staff[];
  shiftsByStaff:   Map<string, Shift[]>;
  branchOpenTime:  string;                    // "HH:mm"
  branchCloseTime: string;
  busy:            boolean;
  onTapCell:  (staff: Staff, date: Date, existing: Shift | null) => void;
  onDragSave: (shift: Shift, staffId: string, date: string, startTime: string, endTime: string) => Promise<void>;
}

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const GAP     = "#E4572E";
const GAP_BG  = "#FCE9E3";

const STAFF_COLORS = ["#C7862A", "#0E9483", "#8A4FA0", "#4C7A3E", "#2C6FB5", "#B23A6B"];

const DOW_TH = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const SNAP_MIN = 15;      // drag snaps to 15-minute grid
const MIN_DURATION = 30;  // shortest a shift can be resized to
const TAP_THRESHOLD_PX = 6;

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function toMin(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtMin(min: number): string { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)); }
function snap(min: number): number { return Math.round(min / SNAP_MIN) * SNAP_MIN; }

/** Contiguous branch-wide zero-coverage ranges within [openMin, closeMin), at 15-min resolution. */
function computeGaps(dayShifts: { start: number; end: number }[], openMin: number, closeMin: number): [number, number][] {
  const gaps: [number, number][] = [];
  let cur = openMin;
  while (cur < closeMin) {
    const covered = dayShifts.some(s => s.start <= cur && s.end > cur);
    if (!covered) {
      const gapStart = cur;
      while (cur < closeMin && !dayShifts.some(s => s.start <= cur && s.end > cur)) cur += SNAP_MIN;
      gaps.push([gapStart, cur]);
    } else {
      cur += SNAP_MIN;
    }
  }
  return gaps;
}

type DragMode = "move" | "resize-start" | "resize-end";
interface DragState {
  pointerId:  number;
  mode:       DragMode;
  shift:      Shift;
  staff:      Staff;
  date:       Date;
  origStart:  number;
  origEnd:    number;
  trackLeft:  number;   // px, from getBoundingClientRect
  trackWidth: number;
  startX:     number;
  moved:      boolean;
  previewStart: number;
  previewEnd:   number;
}

export default function GanttWeekView({
  weekDays, staff, shiftsByStaff, branchOpenTime, branchCloseTime, busy, onTapCell, onDragSave,
}: Props) {
  const openMin  = toMin(branchOpenTime);
  const closeMin = toMin(branchCloseTime);
  // `drag` (state) exists only to trigger the re-render that visually moves the bar.
  // `dragRef` is the authoritative, synchronously-updated source of truth read inside
  // the pointermove/pointerup handlers — reading from `drag` directly would close
  // over a stale value if a browser ever delivers pointer events faster than React
  // commits a render between them (observed on fast/coalesced touchmove bursts).
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const colorFor = (staffIdx: number) => STAFF_COLORS[staffIdx % STAFF_COLORS.length];

  function beginDrag(e: React.PointerEvent, mode: DragMode, s: Staff, date: Date, shift: Shift) {
    if (busy || saving) return;
    const trackEl = trackRefs.current.get(ymd(date));
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    // Pointer capture keeps move/up events routed here even if the finger drifts
    // off the element — but the browser can refuse it in edge cases (a pointerId
    // it no longer considers active, Safari quirks), and an uncaught throw here
    // would silently abort the gesture before dragRef is ever set. Fail soft:
    // without capture the drag still works as long as the finger stays over the
    // element, it just loses the "keeps tracking after leaving the element" perk.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* proceed without capture */
    }
    const origStart = toMin(shift.startTime);
    const origEnd   = toMin(shift.endTime);
    const next: DragState = {
      pointerId: e.pointerId, mode, shift, staff: s, date,
      origStart, origEnd,
      trackLeft: rect.left, trackWidth: rect.width,
      startX: e.clientX, moved: false,
      previewStart: origStart, previewEnd: origEnd,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerMove(e: React.PointerEvent) {
    const cur = dragRef.current;
    if (!cur || e.pointerId !== cur.pointerId) return;
    const dx = e.clientX - cur.startX;
    if (!cur.moved && Math.abs(dx) > TAP_THRESHOLD_PX) cur.moved = true;

    const pxPerMin = cur.trackWidth / (closeMin - openMin);
    const deltaMin = snap(dx / pxPerMin);

    let newStart = cur.origStart, newEnd = cur.origEnd;
    if (cur.mode === "move") {
      const duration = cur.origEnd - cur.origStart;
      newStart = clamp(cur.origStart + deltaMin, openMin, closeMin - duration);
      newEnd = newStart + duration;
    } else if (cur.mode === "resize-start") {
      newStart = clamp(cur.origStart + deltaMin, openMin, cur.origEnd - MIN_DURATION);
    } else {
      newEnd = clamp(cur.origEnd + deltaMin, cur.origStart + MIN_DURATION, closeMin);
    }
    cur.previewStart = newStart;
    cur.previewEnd = newEnd;
    setDrag({ ...cur });
  }

  async function onPointerUp(e: React.PointerEvent) {
    const finished = dragRef.current;
    if (!finished || e.pointerId !== finished.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!finished.moved) {
      // Plain tap — no drag distance — open the same sheet the List view uses.
      onTapCell(finished.staff, finished.date, finished.shift);
      return;
    }
    if (finished.previewStart === finished.origStart && finished.previewEnd === finished.origEnd) return;
    setSaving(true);
    try {
      await onDragSave(
        finished.shift, finished.staff.id, ymd(finished.date),
        fmtMin(finished.previewStart), fmtMin(finished.previewEnd),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pt-2 space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1">
        {staff.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
            <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: colorFor(i) }} />
            {s.name}
          </div>
        ))}
      </div>

      {weekDays.map((date, dayIdx) => {
        const ds = ymd(date);
        const isToday = ds === ymd(new Date());

        const dayShifts = staff.flatMap((s, staffIdx) => {
          const sh = (shiftsByStaff.get(s.id) ?? []).find(x => x.date === ds);
          if (!sh) return [];
          const isDragging = drag && drag.shift.id === sh.id;
          const start = isDragging ? drag!.previewStart : toMin(sh.startTime);
          const end   = isDragging ? drag!.previewEnd   : toMin(sh.endTime);
          return [{ staff: s, staffIdx, shift: sh, start, end, dragging: !!isDragging }];
        });
        const gaps = computeGaps(dayShifts.map(d => ({ start: d.start, end: d.end })), openMin, closeMin);
        const totalGapMin = gaps.reduce((sum, g) => sum + (g[1] - g[0]), 0);

        const pct = (min: number) => ((min - openMin) / (closeMin - openMin)) * 100;

        return (
          <div key={ds} className="rounded-2xl bg-white overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, background: "#FAF5F0" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold" style={{ color: isToday ? PRIMARY : TEXT }}>{DOW_TH[dayIdx]}</span>
                <span className="text-[11px]" style={{ color: MUTED }}>{date.getDate()}/{date.getMonth() + 1}</span>
              </div>
              {totalGapMin > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: GAP_BG, color: GAP }}>
                  ⚠ ว่างคน {Math.round((totalGapMin / 60) * 10) / 10} ชม.
                </span>
              )}
            </div>

            <div className="px-3.5 pt-2 pb-3">
              {/* Time axis */}
              <div className="relative h-4 mb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                {[openMin, openMin + Math.round((closeMin - openMin) / 2 / 60) * 60, closeMin].map((t, i) => (
                  <span key={i} className="absolute top-0 text-[9px]" style={{ left: `${pct(t)}%`, color: MUTED, transform: i === 2 ? "translateX(-100%)" : i === 0 ? "none" : "translateX(-50%)" }}>
                    {fmtMin(t)}
                  </span>
                ))}
              </div>

              {/* Lanes */}
              <div
                ref={el => { if (el) trackRefs.current.set(ds, el); }}
                className="relative"
                style={{ display: "flex", flexDirection: "column", gap: 3 }}
              >
                {staff.map((s, staffIdx) => {
                  const entry = dayShifts.find(d => d.staffIdx === staffIdx);
                  return (
                    <div key={s.id} className="relative h-8 rounded-lg" style={{
                      background: entry ? "transparent" : "repeating-linear-gradient(135deg, #F0E4D8 0 1px, transparent 1px 7px)",
                    }}>
                      {!entry && (
                        <button
                          onClick={() => onTapCell(s, date, null)}
                          className="absolute inset-0 flex items-center px-2 text-[10px]"
                          style={{ color: MUTED }}
                        >
                          {s.name} · แตะเพื่อเพิ่มกะ
                        </button>
                      )}
                      {entry && (
                        <div
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          className="absolute top-0 bottom-0 rounded-lg flex items-center overflow-hidden select-none"
                          style={{
                            left: `${pct(entry.start)}%`,
                            width: `${pct(entry.end) - pct(entry.start)}%`,
                            background: colorFor(staffIdx),
                            opacity: entry.dragging ? 0.92 : 1,
                            boxShadow: entry.dragging ? "0 3px 10px rgba(0,0,0,0.25)" : "none",
                            touchAction: "none",
                            zIndex: entry.dragging ? 5 : 1,
                          }}
                        >
                          {/* left resize handle */}
                          <div
                            onPointerDown={e => beginDrag(e, "resize-start", s, date, entry.shift)}
                            className="absolute left-0 top-0 bottom-0"
                            style={{ width: 16, touchAction: "none" }}
                          />
                          {/* move (body) */}
                          <div
                            onPointerDown={e => beginDrag(e, "move", s, date, entry.shift)}
                            className="flex-1 h-full flex items-center px-2 min-w-0"
                            style={{ touchAction: "none" }}
                          >
                            <span className="text-[10.5px] font-semibold text-white truncate">
                              {s.name} <span style={{ opacity: 0.85, fontWeight: 500 }}>{fmtMin(entry.start)}–{fmtMin(entry.end)}</span>
                            </span>
                          </div>
                          {/* right resize handle */}
                          <div
                            onPointerDown={e => beginDrag(e, "resize-end", s, date, entry.shift)}
                            className="absolute right-0 top-0 bottom-0"
                            style={{ width: 16, touchAction: "none" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Gap overlays */}
                {gaps.map((g, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${pct(g[0])}%`, width: `${pct(g[1]) - pct(g[0])}%`,
                      background: "repeating-linear-gradient(135deg, rgba(228,87,46,0.16) 0 5px, transparent 5px 10px)",
                      borderLeft: `2px solid ${GAP}`, borderRight: `2px solid ${GAP}`,
                      borderRadius: 4,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] px-1 leading-relaxed" style={{ color: MUTED }}>
        ลากขอบแถบเพื่อปรับเวลา · ลากตรงกลางเพื่อเลื่อนเวลาทั้งกะ · แตะเพื่อแก้ไขแบบละเอียด
        <br />การเปลี่ยนวันหรือเปลี่ยนช่าง ให้แตะเพื่อเปิดหน้าต่างแก้ไข
      </p>
    </div>
  );
}
