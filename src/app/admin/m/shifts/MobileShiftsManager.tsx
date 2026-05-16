"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Loader2, X, Check,
  Wand2, Copy, Eraser, MoreHorizontal,
} from "lucide-react";

interface Branch { id: string; name: string }
interface Staff  { id: string; name: string }
interface Shift  { id: string; date: string; startTime: string; endTime: string }

interface Props {
  branches:         Branch[];
  activeBranchId:   string;
  branchOpenTime:   string;  // "HH:mm" — used as default shift start
  branchCloseTime:  string;
  staff:            Staff[];
  initialWeek:      string | null;  // "YYYY-MM-DD" of Monday
}

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

const DOW_TH_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

// ── Date helpers (local, not UTC) ────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}
function mondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = c.getDay();              // 0 = Sun, 1 = Mon, …
  const diff = dow === 0 ? -6 : 1 - dow;
  c.setDate(c.getDate() + diff);
  c.setHours(0, 0, 0, 0);
  return c;
}
function fmtMonDay(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// ── Top-level component ──────────────────────────────────────────────────────

export default function MobileShiftsManager({
  branches, activeBranchId, branchOpenTime, branchCloseTime, staff, initialWeek,
}: Props) {
  const router = useRouter();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    initialWeek ? mondayOf(parseYmd(initialWeek)) : mondayOf(new Date()),
  );
  // Stable primitive identity for dependency arrays (Date references change
  // every render even when the day is the same).
  const weekStartMs = weekStart.getTime();
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekStartMs],
  );
  const weekEnd  = addDays(weekStart, 6);
  const weekRangeLabel = `${fmtMonDay(weekStart)} – ${fmtMonDay(weekEnd)}`;

  const [shiftsByStaff, setShiftsByStaff] = useState<Map<string, Shift[]>>(new Map());
  const [loading,       setLoading]       = useState(true);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showTools,        setShowTools]        = useState(false);
  const [editCell,         setEditCell]         = useState<{ staff: Staff; date: Date } | null>(null);
  const [staffMenu,        setStaffMenu]        = useState<Staff | null>(null);
  const [actionBusy,       setActionBusy]       = useState(false);
  const [toast,            setToast]            = useState<string>("");

  // Fetch the week's shifts whenever week / branch changes
  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/branches/${activeBranchId}/shifts?from=${ymd(weekStart)}&to=${ymd(weekEnd)}`);
      if (!res.ok) return;
      const data: { staff: { id: string; shifts: { id: string; date: string; startTime: string; endTime: string }[] }[] } = await res.json();
      const map = new Map<string, Shift[]>();
      for (const s of data.staff ?? []) {
        map.set(s.id, s.shifts.map(sh => ({
          id:        sh.id,
          date:      sh.date.slice(0, 10),
          startTime: sh.startTime,
          endTime:   sh.endTime,
        })));
      }
      setShiftsByStaff(map);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, weekStartMs]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadWeek(); }, [loadWeek]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function switchBranch(id: string) {
    setShowBranchPicker(false);
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", id);
    router.replace(url.pathname + url.search);
  }
  function shiftWeek(deltaDays: number) {
    setWeekStart(prev => addDays(prev, deltaDays));
  }
  function goToday() {
    setWeekStart(mondayOf(new Date()));
  }

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  // All routed through POST /api/admin/branches/[id]/shifts/bulk

  async function bulkCall(args: {
    create?: { staffId: string; date: string; startTime: string; endTime: string }[];
    delete?: string[];
  }, successMsg: string) {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/branches/${activeBranchId}/shifts/bulk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(args),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast(`เกิดข้อผิดพลาด: ${data.error ?? res.status}`);
        return false;
      }
      setToast(successMsg);
      await loadWeek();
      return true;
    } finally {
      setActionBusy(false);
    }
  }

  /** Apply default shift (branch open/close) to every empty day for every staff this week. */
  async function applyDefaultToWeek() {
    const create: { staffId: string; date: string; startTime: string; endTime: string }[] = [];
    for (const s of staff) {
      const existing = new Set((shiftsByStaff.get(s.id) ?? []).map(x => x.date));
      for (const d of weekDays) {
        const ds = ymd(d);
        if (!existing.has(ds)) {
          create.push({ staffId: s.id, date: ds, startTime: branchOpenTime, endTime: branchCloseTime });
        }
      }
    }
    if (create.length === 0) { setToast("ทุกช่องมีกะอยู่แล้ว"); return; }
    setShowTools(false);
    await bulkCall({ create }, `เพิ่ม ${create.length} กะ`);
  }

  /** Clear ALL shifts in this week (for every staff at this branch). */
  async function clearWeek() {
    if (!confirm(`ลบกะทั้งหมดในสัปดาห์ ${weekRangeLabel}?`)) return;
    const ids: string[] = [];
    for (const s of staff) for (const x of shiftsByStaff.get(s.id) ?? []) ids.push(x.id);
    if (ids.length === 0) { setToast("ไม่มีกะให้ลบ"); return; }
    setShowTools(false);
    await bulkCall({ delete: ids }, `ลบ ${ids.length} กะ`);
  }

  /** Copy this week's shifts to the next week (same times, +7 days). Skips dupes. */
  async function copyToNextWeek() {
    const create: { staffId: string; date: string; startTime: string; endTime: string }[] = [];
    for (const s of staff) {
      for (const x of shiftsByStaff.get(s.id) ?? []) {
        const next = addDays(parseYmd(x.date), 7);
        create.push({ staffId: s.id, date: ymd(next), startTime: x.startTime, endTime: x.endTime });
      }
    }
    if (create.length === 0) { setToast("สัปดาห์นี้ไม่มีกะให้คัดลอก"); return; }
    setShowTools(false);
    const ok = await bulkCall({ create }, `คัดลอก ${create.length} กะไปสัปดาห์หน้า`);
    if (ok) setWeekStart(prev => addDays(prev, 7));
  }

  /** Per-staff: copy their week to next, replacing what's there. */
  async function copyStaffWeek(s: Staff) {
    const xs = shiftsByStaff.get(s.id) ?? [];
    if (xs.length === 0) { setToast("ไม่มีกะให้คัดลอก"); setStaffMenu(null); return; }
    const create = xs.map(x => ({
      staffId:   s.id,
      date:      ymd(addDays(parseYmd(x.date), 7)),
      startTime: x.startTime,
      endTime:   x.endTime,
    }));
    setStaffMenu(null);
    await bulkCall({ create }, `คัดลอก ${create.length} กะไปสัปดาห์หน้า`);
  }

  /** Per-staff: clear this week's shifts. */
  async function clearStaffWeek(s: Staff) {
    const xs = shiftsByStaff.get(s.id) ?? [];
    if (xs.length === 0) { setToast("ไม่มีกะให้ลบ"); setStaffMenu(null); return; }
    if (!confirm(`ลบกะของ ${s.name} ในสัปดาห์นี้?`)) { setStaffMenu(null); return; }
    setStaffMenu(null);
    await bulkCall({ delete: xs.map(x => x.id) }, `ลบ ${xs.length} กะ`);
  }

  /** Per-staff: fill empty days with default shift. */
  async function fillStaffWeek(s: Staff) {
    const existing = new Set((shiftsByStaff.get(s.id) ?? []).map(x => x.date));
    const create: { staffId: string; date: string; startTime: string; endTime: string }[] = [];
    for (const d of weekDays) {
      const ds = ymd(d);
      if (!existing.has(ds)) {
        create.push({ staffId: s.id, date: ds, startTime: branchOpenTime, endTime: branchCloseTime });
      }
    }
    setStaffMenu(null);
    if (create.length === 0) { setToast("สัปดาห์นี้เต็มแล้ว"); return; }
    await bulkCall({ create }, `เพิ่ม ${create.length} กะ`);
  }

  /** Single-cell edit: replace whatever's on (staff, date) with a single new shift, or clear it. */
  async function saveCell(staffId: string, date: string, opts: { startTime: string; endTime: string } | null) {
    const existing = (shiftsByStaff.get(staffId) ?? []).filter(s => s.date === date);
    const del = existing.map(s => s.id);
    const create = opts ? [{ staffId, date, startTime: opts.startTime, endTime: opts.endTime }] : [];
    await bulkCall({ delete: del, create }, opts ? "บันทึกกะแล้ว" : "ลบกะแล้ว");
    setEditCell(null);
  }

  return (
    <main className="pb-24 min-h-screen" style={{ background: BG }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Shifts</p>
            <h1 className="text-sm font-medium" style={{ color: TEXT }}>ตารางงาน</h1>
          </div>
          <button
            onClick={() => setShowTools(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ color: PRIMARY, background: "#FFF8F4", border: `1px solid ${BORDER}` }}
            aria-label="เครื่องมือ"
          >
            <Wand2 size={15} />
          </button>
        </div>
      </header>

      {/* Branch + week navigator */}
      <section className="px-4 pt-3 pb-2 space-y-2">
        <button
          onClick={() => setShowBranchPicker(true)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm bg-white"
          style={{ border: `1px solid ${BORDER}`, color: TEXT }}
        >
          <span className="truncate font-medium">{branches.find(b => b.id === activeBranchId)?.name ?? "เลือกสาขา"}</span>
          <ChevronDown size={14} style={{ color: MUTED }} />
        </button>

        <div className="flex items-center gap-1.5">
          <button onClick={() => shiftWeek(-7)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white"
            style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl py-2" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-sm font-medium" style={{ color: TEXT }}>{weekRangeLabel}</p>
          </div>
          <button onClick={() => shiftWeek(7)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white"
            style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="px-3 h-9 rounded-xl text-xs font-medium bg-white"
            style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}>
            วันนี้
          </button>
        </div>
      </section>

      {/* Staff weekly cards */}
      <section className="px-4 pt-2 space-y-3">
        {loading ? (
          <div className="rounded-xl bg-white p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
            <Loader2 size={14} className="inline animate-spin mr-1" /> กำลังโหลด...
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
            ยังไม่มีช่างที่สาขานี้
          </div>
        ) : (
          staff.map(s => {
            const shifts = shiftsByStaff.get(s.id) ?? [];
            const byDate = new Map(shifts.map(x => [x.date, x]));
            const workingDays = shifts.length;
            return (
              <div key={s.id} className="rounded-2xl bg-white overflow-hidden" style={{ border: `1.5px solid ${BORDER}` }}>
                <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, background: "#FAF5F0" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{s.name}</p>
                    <p className="text-[10px]" style={{ color: workingDays > 0 ? "#15803D" : MUTED }}>
                      {workingDays === 0 ? "หยุดทั้งสัปดาห์" : `ทำงาน ${workingDays}/7 วัน`}
                    </p>
                  </div>
                  <button onClick={() => setStaffMenu(s)} className="p-2 rounded-lg" style={{ color: MUTED }}>
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <ul className="divide-y" style={{ borderColor: BORDER }}>
                  {weekDays.map((d, i) => {
                    const ds  = ymd(d);
                    const sh  = byDate.get(ds);
                    const isToday = ds === ymd(new Date());
                    return (
                      <li key={ds}>
                        <button
                          onClick={() => setEditCell({ staff: s, date: d })}
                          className="w-full flex items-center px-3.5 py-2.5 hover:bg-stone-50 transition-colors"
                          style={{ borderColor: BORDER }}
                        >
                          <div className="w-14 text-left">
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: isToday ? PRIMARY : MUTED, fontWeight: isToday ? 600 : 400 }}>
                              {DOW_TH_SHORT[i]}
                            </p>
                            <p className="text-sm font-medium" style={{ color: isToday ? PRIMARY : TEXT }}>{d.getDate()}</p>
                          </div>
                          <div className="flex-1 text-left">
                            {sh ? (
                              <span className="inline-block text-sm font-medium px-2.5 py-0.5 rounded-full"
                                style={{ background: "#F0FDF4", color: "#15803D" }}>
                                {sh.startTime}–{sh.endTime}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: MUTED }}>หยุด · แตะเพื่อเพิ่มกะ</span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {/* ── Branch picker sheet ──────────────────────────────────────────── */}
      {showBranchPicker && (
        <Sheet onClose={() => setShowBranchPicker(false)} title="เลือกสาขา">
          <ul className="p-3">
            {branches.map(b => (
              <li key={b.id}>
                <button onClick={() => switchBranch(b.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: b.id === activeBranchId ? "#FFF8F4" : "transparent", color: TEXT }}>
                  <span className="text-sm">{b.name}</span>
                  {b.id === activeBranchId && <Check size={16} style={{ color: PRIMARY }} />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {/* ── Tools sheet (week-level bulk ops) ───────────────────────────── */}
      {showTools && (
        <Sheet onClose={() => setShowTools(false)} title="เครื่องมือลัด">
          <div className="p-3 space-y-2">
            <ActionRow
              icon={<Wand2 size={16} />}
              title="ตั้งค่าเริ่มต้นทั้งสัปดาห์"
              subtitle={`เติมกะ ${branchOpenTime}–${branchCloseTime} ในวันที่ยังหยุด (ทุกช่าง)`}
              onClick={applyDefaultToWeek}
              disabled={actionBusy}
            />
            <ActionRow
              icon={<Copy size={16} />}
              title="คัดลอกไปสัปดาห์หน้า"
              subtitle="คัดลอกกะของสัปดาห์นี้ไปยังสัปดาห์ถัดไป"
              onClick={copyToNextWeek}
              disabled={actionBusy}
            />
            <ActionRow
              icon={<Eraser size={16} />}
              title="ล้างสัปดาห์นี้"
              subtitle="ลบกะทุกช่างในสัปดาห์นี้"
              onClick={clearWeek}
              disabled={actionBusy}
              danger
            />
          </div>
        </Sheet>
      )}

      {/* ── Per-staff actions sheet ─────────────────────────────────────── */}
      {staffMenu && (
        <Sheet onClose={() => setStaffMenu(null)} title={staffMenu.name}>
          <div className="p-3 space-y-2">
            <ActionRow
              icon={<Wand2 size={16} />}
              title="เติมกะเริ่มต้นทั้งสัปดาห์"
              subtitle={`${branchOpenTime}–${branchCloseTime} ในวันที่ยังหยุด`}
              onClick={() => fillStaffWeek(staffMenu)}
              disabled={actionBusy}
            />
            <ActionRow
              icon={<Copy size={16} />}
              title="คัดลอกไปสัปดาห์หน้า"
              subtitle="คัดลอกกะของคนนี้ไปสัปดาห์ถัดไป"
              onClick={() => copyStaffWeek(staffMenu)}
              disabled={actionBusy}
            />
            <ActionRow
              icon={<Eraser size={16} />}
              title="ล้างสัปดาห์นี้"
              subtitle="ลบกะของคนนี้ในสัปดาห์นี้"
              onClick={() => clearStaffWeek(staffMenu)}
              disabled={actionBusy}
              danger
            />
          </div>
        </Sheet>
      )}

      {/* ── Cell editor sheet ───────────────────────────────────────────── */}
      {editCell && (
        <CellEditor
          staff={editCell.staff}
          date={editCell.date}
          existing={(shiftsByStaff.get(editCell.staff.id) ?? []).filter(s => s.date === ymd(editCell.date))[0] ?? null}
          defaultStart={branchOpenTime}
          defaultEnd={branchCloseTime}
          onCancel={() => setEditCell(null)}
          onSave={(opts) => saveCell(editCell.staff.id, ymd(editCell.date), opts)}
          busy={actionBusy}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm text-white z-[60]"
          style={{ background: TEXT, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}
    </main>
  );
}

// ── Shared subcomponents ─────────────────────────────────────────────────────

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="font-medium" style={{ color: TEXT }}>{title}</p>
          <button onClick={onClose} className="p-1" style={{ color: MUTED }}><X size={18} /></button>
        </div>
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}

function ActionRow({ icon, title, subtitle, onClick, disabled, danger }: {
  icon: React.ReactNode; title: string; subtitle: string;
  onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left disabled:opacity-50"
      style={{ background: danger ? "#FEF2F2" : "#FFF8F4", border: `1px solid ${danger ? "#FECACA" : BORDER}` }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "white", color: danger ? "#B91C1C" : PRIMARY, border: `1px solid ${danger ? "#FECACA" : BORDER}` }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: danger ? "#B91C1C" : TEXT }}>{title}</p>
        <p className="text-[11px]" style={{ color: MUTED }}>{subtitle}</p>
      </div>
    </button>
  );
}

function CellEditor({
  staff, date, existing, defaultStart, defaultEnd,
  onCancel, onSave, busy,
}: {
  staff:     { id: string; name: string };
  date:      Date;
  existing:  Shift | null;
  defaultStart: string;
  defaultEnd:   string;
  onCancel: () => void;
  onSave:   (opts: { startTime: string; endTime: string } | null) => void | Promise<void>;
  busy:     boolean;
}) {
  const [start, setStart] = useState(existing?.startTime ?? defaultStart);
  const [end,   setEnd]   = useState(existing?.endTime   ?? defaultEnd);
  const [err,   setErr]   = useState("");

  const presets: { label: string; start: string; end: string }[] = [
    { label: "เริ่มต้น", start: defaultStart, end: defaultEnd },
    { label: "เช้า",     start: "08:00",      end: "16:00" },
    { label: "บ่าย",     start: "13:00",      end: "21:00" },
  ];

  function submit() {
    if (end <= start) { setErr("เวลาเลิกต้องหลังเวลาเริ่ม"); return; }
    void onSave({ startTime: start, endTime: end });
  }

  const dateLabel = date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <Sheet title={staff.name} onClose={onCancel}>
      <div className="p-5 space-y-4">
        <p className="text-xs" style={{ color: MUTED }}>{dateLabel}</p>

        {/* Quick presets */}
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>เลือกกะที่ใช้บ่อย</p>
          <div className="grid grid-cols-3 gap-2">
            {presets.map(p => {
              const selected = p.start === start && p.end === end;
              return (
                <button key={p.label}
                  onClick={() => { setStart(p.start); setEnd(p.end); setErr(""); }}
                  className="py-2 rounded-xl text-xs"
                  style={{
                    background: selected ? PRIMARY : "white",
                    color:      selected ? "white" : TEXT,
                    border:     `1px solid ${selected ? PRIMARY : BORDER}`,
                  }}>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-[10px] opacity-80">{p.start}–{p.end}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time pickers */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>เริ่ม</label>
            <input type="time" value={start} onChange={e => { setStart(e.target.value); setErr(""); }}
              className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>เลิก</label>
            <input type="time" value={end} onChange={e => { setEnd(e.target.value); setErr(""); }}
              className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: BORDER, color: TEXT }} />
          </div>
        </div>

        {err && <p className="text-xs" style={{ color: "#B91C1C" }}>{err}</p>}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => void onSave(null)} disabled={busy || !existing}
            className="py-2.5 rounded-xl text-sm font-medium disabled:opacity-30"
            style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
            ตั้งเป็นวันหยุด
          </button>
          <button onClick={submit} disabled={busy}
            className="py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: PRIMARY }}>
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
