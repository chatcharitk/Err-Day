"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Copy, Loader2 } from "lucide-react";

interface Branch { id: string; name: string }

interface Shift  { id: string; date: string; startTime: string; endTime: string }

interface StaffWithShifts {
  id:        string;
  name:      string;
  avatarUrl: string | null;
  shifts:    Shift[];
}

const DAY_LABELS_TH = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESETS: Array<{ label: string; start: string; end: string }> = [
  { label: "10:00 — 18:00", start: "10:00", end: "18:00" },
  { label: "11:00 — 19:00", start: "11:00", end: "19:00" },
  { label: "12:00 — 20:00", start: "12:00", end: "20:00" },
  { label: "10:00 — 14:00", start: "10:00", end: "14:00" },
  { label: "14:00 — 20:00", start: "14:00", end: "20:00" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns the Monday (00:00 local) of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // 0=Sun, 1=Mon, ... — we want week starting Monday
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function sameDay(a: string, b: Date): boolean {
  return a.slice(0, 10) === ymd(b);
}

function formatRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear  = start.getFullYear() === end.getFullYear();
  const fmtMonth = (d: Date) => d.toLocaleDateString("th-TH", { month: "short" });
  if (sameYear && sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${fmtMonth(start)} ${start.getFullYear() + 543}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${fmtMonth(start)} – ${end.getDate()} ${fmtMonth(end)} ${start.getFullYear() + 543}`;
  }
  return `${ymd(start)} – ${ymd(end)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftsManager({ branches }: { branches: Branch[] }) {
  const [branchId,  setBranchId]  = useState(branches[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [staff,     setStaff]     = useState<StaffWithShifts[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [editing,   setEditing]   = useState<{ staffId: string; staffName: string; date: Date; existing: Shift | null } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const url = `/api/admin/branches/${branchId}/shifts?from=${ymd(weekStart)}&to=${ymd(weekEnd)}`;
      const res = await fetch(url);
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branchId, weekStart, weekEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const goToToday = () => setWeekStart(startOfWeek(new Date()));
  const prevWeek  = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek  = () => setWeekStart(addDays(weekStart, 7));

  // Find a staff member's shift on a given date (or null)
  const getShift = (s: StaffWithShifts, day: Date): Shift | null =>
    s.shifts.find((sh) => sameDay(sh.date, day)) ?? null;

  // Apply most-recent shift template to all 7 days for this staff (only fills empty days)
  const applyToWeek = async (s: StaffWithShifts) => {
    const template = s.shifts[0];
    if (!template) return;
    setLoading(true);
    try {
      for (const day of days) {
        if (getShift(s, day)) continue; // skip days that already have a shift
        await fetch(`/api/admin/staff/${s.id}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: ymd(day),
            startTime: template.startTime,
            endTime: template.endTime,
          }),
        });
      }
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8" style={{ background: "#FDF8F3" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-medium" style={{ color: "#3B2A24" }}>ตารางงาน</h1>
            <p className="text-sm" style={{ color: "#A08070" }}>Staff Shifts — กำหนดชั่วโมงทำงานของพนักงานในแต่ละวัน</p>
          </div>
          {loading && <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8B1D24" }} />}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 my-6">
          {/* Branch picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-widest" style={{ color: "#A08070" }}>สาขา</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg bg-white"
              style={{ border: "1.5px solid #E8D8CC", color: "#3B2A24" }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={prevWeek}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: "#6B5245", border: "1.5px solid #E8D8CC", background: "white" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: "#6B5245", border: "1.5px solid #E8D8CC", background: "white" }}
            >
              สัปดาห์นี้
            </button>
            <button
              onClick={nextWeek}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: "#6B5245", border: "1.5px solid #E8D8CC", background: "white" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-base font-medium mb-4" style={{ color: "#3B2A24" }}>
          {formatRangeLabel(weekStart, weekEnd)}
        </p>

        {/* Grid */}
        {staff.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white" style={{ border: "1.5px solid #E8D8CC" }}>
            <p className="text-sm" style={{ color: "#A08070" }}>
              {loading ? "กำลังโหลด..." : "ไม่มีพนักงานในสาขานี้"}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1.5px solid #E8D8CC" }}>
            {/* Day header */}
            <div className="grid" style={{ gridTemplateColumns: "200px repeat(7, 1fr) 110px" }}>
              <div className="px-4 py-3 text-xs uppercase tracking-widest" style={{ color: "#A08070", borderBottom: "1px solid #F0E4D8" }}>
                พนักงาน
              </div>
              {days.map((d, i) => {
                const isToday = ymd(d) === ymd(new Date());
                return (
                  <div
                    key={i}
                    className="px-2 py-3 text-center"
                    style={{ borderBottom: "1px solid #F0E4D8", borderLeft: "1px solid #F0E4D8" }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "#A08070" }}>
                      {DAY_LABELS_TH[i]} <span className="opacity-60">{DAY_LABELS_EN[i]}</span>
                    </p>
                    <p className="text-sm font-medium mt-0.5"
                      style={{ color: isToday ? "#8B1D24" : "#3B2A24" }}>
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}
              <div className="px-2 py-3 text-xs uppercase tracking-widest text-center"
                style={{ color: "#A08070", borderBottom: "1px solid #F0E4D8", borderLeft: "1px solid #F0E4D8" }}>
                การกระทำ
              </div>
            </div>

            {/* Staff rows */}
            {staff.map((s, rowIdx) => (
              <div
                key={s.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "200px repeat(7, 1fr) 110px",
                  borderBottom: rowIdx < staff.length - 1 ? "1px solid #F0E4D8" : undefined,
                }}
              >
                {/* Staff cell */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: "#F0E4D8", color: "#5C4A42" }}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: "#3B2A24" }}>{s.name}</p>
                </div>

                {/* Day cells */}
                {days.map((day, i) => {
                  const shift = getShift(s, day);
                  return (
                    <div
                      key={i}
                      className="p-1.5"
                      style={{ borderLeft: "1px solid #F0E4D8" }}
                    >
                      <button
                        onClick={() => setEditing({ staffId: s.id, staffName: s.name, date: day, existing: shift })}
                        className="w-full py-2 rounded-md text-xs transition-colors"
                        style={
                          shift
                            ? { background: "#FFF0E8", color: "#8B1D24", border: "1px solid #F4D5C8", fontWeight: 500 }
                            : { background: "#FAF5F0", color: "#C4B0A4", border: "1px dashed #E8D8CC" }
                        }
                      >
                        {shift ? `${shift.startTime}–${shift.endTime}` : "OFF"}
                      </button>
                    </div>
                  );
                })}

                {/* Action cell */}
                <div className="p-1.5 flex items-center justify-center" style={{ borderLeft: "1px solid #F0E4D8" }}>
                  <button
                    onClick={() => applyToWeek(s)}
                    disabled={s.shifts.length === 0 || loading}
                    title="ใช้กะล่าสุดกับวันที่ยังว่างทั้งสัปดาห์"
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md transition-colors disabled:opacity-40"
                    style={{ color: "#6B5245", border: "1px solid #E8D8CC", background: "white" }}
                  >
                    <Copy className="w-3 h-3" />
                    ทั้งสัปดาห์
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: "#A08070" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block"
              style={{ background: "#FFF0E8", border: "1px solid #F4D5C8" }} />
            วันทำงาน (กดเพื่อแก้ไข)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block"
              style={{ background: "#FAF5F0", border: "1px dashed #E8D8CC" }} />
            วันหยุด (กดเพื่อเพิ่มกะ)
          </span>
        </div>

        <p className="text-xs mt-3" style={{ color: "#A08070" }}>
          หมายเหตุ: ก่อนกำหนดกะใดๆ ระบบจะถือว่าพนักงานที่ <code>active</code> ทุกคนพร้อมให้บริการ
          (legacy mode) เมื่อกำหนดกะของวันใดแล้ว ระบบจะใช้เฉพาะคนที่อยู่ในกะเท่านั้น
        </p>
      </div>

      {editing && (
        <ShiftEditor
          staffId={editing.staffId}
          staffName={editing.staffName}
          date={editing.date}
          existing={editing.existing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchData(); }}
        />
      )}
    </main>
  );
}

// ── Shift editor modal ────────────────────────────────────────────────────────

function ShiftEditor({
  staffId, staffName, date, existing, onClose, onSaved,
}: {
  staffId:   string;
  staffName: string;
  date:      Date;
  existing:  Shift | null;
  onClose:   () => void;
  onSaved:   () => void;
}) {
  const [startTime, setStartTime] = useState(existing?.startTime ?? "10:00");
  const [endTime,   setEndTime]   = useState(existing?.endTime   ?? "18:00");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const dateLabel = date.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long",
  });

  const handleSave = async () => {
    if (startTime >= endTime) {
      setError("เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (existing) {
        const res = await fetch(`/api/admin/staff/${staffId}/shifts/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime, endTime }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      } else {
        const res = await fetch(`/api/admin/staff/${staffId}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: ymd(date), startTime, endTime }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm("ลบกะนี้?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/shifts/${existing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("ไม่สามารถลบได้");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F0E4D8" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#3B2A24" }}>{staffName}</h3>
            <p className="text-xs" style={{ color: "#A08070" }}>{dateLabel}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100">
            <X className="w-5 h-5" style={{ color: "#6B5245" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Quick presets */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#A08070" }}>กะมาตรฐาน</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setStartTime(p.start); setEndTime(p.end); }}
                  className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
                  style={{
                    border: "1px solid #E8D8CC",
                    background: startTime === p.start && endTime === p.end ? "#FFF0E8" : "white",
                    color: "#5C4A42",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest" style={{ color: "#A08070" }}>เริ่ม</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: "1.5px solid #E8D8CC", color: "#3B2A24" }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest" style={{ color: "#A08070" }}>สิ้นสุด</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: "1.5px solid #E8D8CC", color: "#3B2A24" }}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm p-2 rounded-md" style={{ color: "#991B1B", background: "#FEE2E2" }}>
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid #F0E4D8" }}>
          {existing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors disabled:opacity-50"
              style={{ borderColor: "#FECACA", color: "#DC2626", background: "white" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              ลบ
            </button>
          )}
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2"
            style={{ borderColor: "#D6BCAE", color: "#6B5245" }}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#8B1D24" }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {existing ? "บันทึก" : "เพิ่มกะ"}
          </button>
        </div>
      </div>
    </div>
  );
}
