"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronDown, Save, CheckCircle2, AlertTriangle, XCircle,
  Power, Users, Calendar, Info, Settings as SettingsIcon, X, Check, Plus, Trash2,
} from "lucide-react";

interface Branch {
  id:             string;
  name:           string;
  onlineCap:      number | null;
  bookingEnabled: boolean;
}
interface HourRow {
  hour:         string;
  endHour:      string;
  staffOnShift: number;
  bookings:     number;
  onlineCap:    number;
  available:    number;
  status:       "open" | "tight" | "full" | "over";
}
interface CapacityData {
  rows:      HourRow[];
  hasShifts: boolean;
  summary:   { totalBookings: number; peakBookings: number; overHours: number; tightHours: number };
}
interface Props {
  branches:       Branch[];
  activeBranchId: string;
  selectedDate:   string;
}

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

const STATUS_STYLE: Record<HourRow["status"], { bg: string; color: string; label: string; icon: typeof CheckCircle2 }> = {
  open:  { bg: "#F0FDF4", color: "#15803D", label: "ว่าง",     icon: CheckCircle2 },
  tight: { bg: "#FEF3C7", color: "#B45309", label: "ใกล้เต็ม", icon: AlertTriangle },
  full:  { bg: "#FED7AA", color: "#9A3412", label: "เต็ม",     icon: AlertTriangle },
  over:  { bg: "#FEE2E2", color: "#B91C1C", label: "เกินคิว",  icon: XCircle },
};

export default function MobileCapacity({ branches, activeBranchId, selectedDate }: Props) {
  const branch = branches.find(b => b.id === activeBranchId) ?? branches[0];
  const router = useRouter();

  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);

  function switchBranch(id: string) {
    setShowBranchPicker(false);
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", id);
    url.searchParams.set("date", selectedDate);
    router.replace(url.pathname + url.search);
  }

  function changeDate(date: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("branchId", activeBranchId);
    url.searchParams.set("date", date);
    router.replace(url.pathname + url.search);
  }

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <main className="pb-24 min-h-screen" style={{ background: BG }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push("/admin/m")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Capacity</p>
            <h1 className="text-sm font-medium" style={{ color: TEXT }}>ความจุการจอง</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ color: PRIMARY, background: "#FFF8F4", border: `1px solid ${BORDER}` }}
            aria-label="ตั้งค่า"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* Branch + date row */}
      <section className="px-4 py-3 flex gap-2">
        <button
          onClick={() => setShowBranchPicker(true)}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm bg-white"
          style={{ border: `1px solid ${BORDER}`, color: TEXT }}
        >
          <span className="truncate font-medium">{branch?.name ?? "เลือกสาขา"}</span>
          <ChevronDown size={14} style={{ color: MUTED }} />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => changeDate(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl bg-white"
          style={{ border: `1px solid ${BORDER}`, color: TEXT }}
        />
      </section>

      {/* Day breakdown — remounts on branch/date change so internal state resets */}
      <DayBreakdown
        key={`${activeBranchId}-${selectedDate}`}
        branch={branch}
        branchId={activeBranchId}
        selectedDate={selectedDate}
        dateLabel={dateLabel}
      />

      {/* Branch picker sheet */}
      {showBranchPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowBranchPicker(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="font-medium" style={{ color: TEXT }}>เลือกสาขา</p>
              <button onClick={() => setShowBranchPicker(false)} className="p-1" style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
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
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Settings sheet — remounts on open so it pulls fresh branch values */}
      {showSettings && branch && (
        <SettingsSheet
          key={branch.id}
          branch={branch}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}

// ── Day Breakdown ────────────────────────────────────────────────────────────

interface DayBreakdownProps {
  branch?:      Branch;
  branchId:     string;
  selectedDate: string;
  dateLabel:    string;
}

function DayBreakdown({ branch, branchId, selectedDate, dateLabel }: DayBreakdownProps) {
  const [data,    setData]    = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/capacity?branchId=${branchId}&date=${selectedDate}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, selectedDate]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <>
      {/* Quick status card */}
      <section className="px-4">
        <div className="rounded-2xl p-3.5 bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: TEXT }}>
              <Calendar size={11} className="inline mr-1" />
              {dateLabel}
            </p>
            <div className="flex items-center gap-1">
              {branch?.bookingEnabled ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#F0FDF4", color: "#15803D" }}>
                  เปิดจอง
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  ปิดจอง
                </span>
              )}
            </div>
          </div>
          {data && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px]" style={{ color: MUTED }}>การจอง</p>
                <p className="text-base font-bold" style={{ color: TEXT }}>{data.summary.totalBookings}</p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: MUTED }}>พีคพร้อมกัน</p>
                <p className="text-base font-bold" style={{ color: TEXT }}>{data.summary.peakBookings}</p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: MUTED }}>ชม.วิกฤต</p>
                <p className="text-base font-bold" style={{
                  color: data.summary.overHours > 0 ? "#B91C1C"
                       : data.summary.tightHours > 0 ? "#B45309"
                       : "#15803D",
                }}>
                  {data.summary.overHours > 0 ? `${data.summary.overHours} เกินคิว` : data.summary.tightHours > 0 ? data.summary.tightHours : "—"}
                </p>
              </div>
            </div>
          )}
          {branch?.onlineCap != null && (
            <p className="text-[10px] mt-2.5" style={{ color: MUTED }}>
              <Info size={9} className="inline mr-0.5" />
              {branch.onlineCap === 0
                ? "ออนไลน์: ปิดรับ"
                : `ออนไลน์ไม่เกิน ${branch.onlineCap} คิวพร้อมกัน`}
            </p>
          )}
        </div>
      </section>

      {/* Hourly cards */}
      <section className="px-4 pt-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: MUTED }}>ตารางความจุรายชั่วโมง</p>
        {loading ? (
          <div className="rounded-xl bg-white p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
            กำลังโหลด...
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
            ไม่มีข้อมูล
          </div>
        ) : !data.hasShifts ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: "#FFF8E8", border: "1px solid #FCD34D", color: "#92400E" }}>
            <AlertTriangle size={13} className="inline mr-1" />
            ยังไม่ตั้งกะการทำงาน — ใช้จำนวนช่างทั้งหมดแทน
          </div>
        ) : (
          data.rows.map(r => {
            const st = STATUS_STYLE[r.status];
            const Icon = st.icon;
            const pct = r.onlineCap === 0 ? 0 : Math.min(100, Math.round((r.bookings / r.onlineCap) * 100));
            return (
              <div key={r.hour} className="rounded-xl bg-white p-3" style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: TEXT }}>{r.hour}</p>
                    <p className="text-[10px]" style={{ color: MUTED }}>— {r.endHour}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: st.bg, color: st.color }}>
                    <Icon size={10} />
                    {st.label}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <p className="text-[9px]" style={{ color: MUTED }}>ช่าง</p>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>
                      <Users size={10} className="inline mr-0.5" style={{ color: MUTED }} />
                      {r.staffOnShift}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: MUTED }}>จองแล้ว</p>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.bookings}</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: MUTED }}>ความจุ</p>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.onlineCap}</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: MUTED }}>ว่าง</p>
                    <p className="text-sm font-semibold" style={{ color: r.status === "over" ? "#B91C1C" : TEXT }}>{r.available}</p>
                  </div>
                </div>

                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F4E8DE" }}>
                  <div className="h-full transition-all" style={{
                    width: `${pct}%`,
                    background: r.status === "over" ? "#DC2626"
                             : r.status === "full" ? "#EA580C"
                             : r.status === "tight" ? "#F59E0B"
                             :                       "#16A34A",
                  }} />
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

// ── Settings Sheet ───────────────────────────────────────────────────────────

function SettingsSheet({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const router = useRouter();
  const [onlineCap,      setOnlineCap]      = useState<string>(branch.onlineCap == null ? "" : String(branch.onlineCap));
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(branch.bookingEnabled);
  const [saving,         setSaving]         = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/admin/branches/${branch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onlineCap:      onlineCap === "" ? null : Number(onlineCap),
          bookingEnabled,
        }),
      });
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md bg-white rounded-t-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="font-medium" style={{ color: TEXT }}>ตั้งค่าความจุ — {branch.name}</p>
          <button onClick={() => !saving && onClose()} className="p-1" style={{ color: MUTED }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Online cap */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
              จำนวนสูงสุดที่ลูกค้าจองออนไลน์ได้พร้อมกัน
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={onlineCap}
              onChange={e => setOnlineCap(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="ไม่จำกัด — ใช้จำนวนช่าง"
              className="w-full px-3 py-2.5 text-sm rounded-xl border"
              style={{ borderColor: BORDER, color: TEXT }}
            />
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <button onClick={() => setOnlineCap("")}
                className="px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
                ไม่จำกัด
              </button>
              {[2, 3, 4, 5, 6, 8].map(n => (
                <button key={n} onClick={() => setOnlineCap(String(n))}
                  className="px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: MUTED }}>
              {onlineCap === ""
                ? "ลูกค้าออนไลน์จองได้เท่าจำนวนช่างที่ทำงาน"
                : onlineCap === "0"
                  ? "🔒 ปิดรับจองออนไลน์"
                  : `จำกัด ${onlineCap} คิวพร้อมกัน — กันคิวให้ลูกค้า walk-in`}
            </p>
          </div>

          {/* Booking enabled */}
          <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-xl"
            style={{ background: bookingEnabled ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${bookingEnabled ? "#BBF7D0" : "#FECACA"}` }}>
            <div className="flex items-center gap-2 flex-1">
              <Power size={14} style={{ color: bookingEnabled ? "#15803D" : "#B91C1C" }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: bookingEnabled ? "#15803D" : "#B91C1C" }}>
                  {bookingEnabled ? "เปิดรับจองออนไลน์" : "ปิดรับจองออนไลน์"}
                </p>
                <p className="text-[10px]" style={{ color: MUTED }}>
                  {bookingEnabled ? "ลูกค้าเห็นสาขานี้" : "ซ่อนจากลูกค้า"}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={bookingEnabled}
              onChange={e => setBookingEnabled(e.target.checked)}
              className="w-5 h-5"
              style={{ accentColor: PRIMARY }}
            />
          </label>

          {/* Per-hour overrides */}
          <OverridesSection branchId={branch.id} />
        </div>

        <div className="p-4 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: PRIMARY }}>
            <Save size={14} />
            {saving ? "กำลังบันทึก..." : "บันทึกค่าเริ่มต้น"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Per-hour Overrides (inside settings sheet) ───────────────────────────────

interface Override {
  id:        string;
  date:      string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime:   string;
  capacity:  number;
  note:      string | null;
}

const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function OverridesSection({ branchId }: { branchId: string }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/branches/${branchId}/capacity-overrides`);
      if (res.ok) setOverrides(await res.json());
    } finally { setLoading(false); }
  }, [branchId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function deleteOne(id: string) {
    if (!confirm("ลบกฎนี้?")) return;
    await fetch(`/api/admin/branches/${branchId}/capacity-overrides/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="rounded-xl p-3" style={{ background: "#FAF5F0", border: `1px dashed ${BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: PRIMARY }}>
            🕒 กฎความจุรายชั่วโมง
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
            ใช้แทนค่าเริ่มต้นในช่วงเวลาที่ระบุ
          </p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
          style={{ background: adding ? "#FEF2F2" : "white", color: PRIMARY, border: `1px solid ${BORDER}` }}
        >
          {adding ? "ยกเลิก" : <><Plus size={11} /> เพิ่ม</>}
        </button>
      </div>

      {adding && (
        <MobileAddOverrideForm
          branchId={branchId}
          onDone={async () => { setAdding(false); await load(); }}
        />
      )}

      {loading ? (
        <p className="text-[11px] text-center py-2" style={{ color: MUTED }}>กำลังโหลด...</p>
      ) : overrides.length === 0 && !adding ? (
        <p className="text-[11px] text-center py-2" style={{ color: MUTED }}>ยังไม่มีกฎ</p>
      ) : (
        <ul className="space-y-1.5">
          {overrides.map(o => (
            <li key={o.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: TEXT }}>
                  {o.date
                    ? `📅 ${new Date(o.date + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`
                    : `🔁 ทุก${DOW_TH[o.dayOfWeek!]}`}
                  <span className="mx-1" style={{ color: MUTED }}>·</span>
                  {o.startTime}–{o.endTime}
                  <span className="mx-1" style={{ color: MUTED }}>·</span>
                  <span style={{ color: o.capacity === 0 ? "#B91C1C" : PRIMARY }}>
                    {o.capacity === 0 ? "🔒 ปิด" : `${o.capacity} คิว`}
                  </span>
                </p>
                {o.note && <p className="text-[10px]" style={{ color: MUTED }}>{o.note}</p>}
              </div>
              <button onClick={() => deleteOne(o.id)} className="p-1" style={{ color: "#B91C1C" }}>
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MobileAddOverrideForm({ branchId, onDone }: { branchId: string; onDone: () => void | Promise<void> }) {
  const [scope,     setScope]     = useState<"date" | "dayOfWeek">("date");
  const [date,      setDate]      = useState<string>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime,   setEndTime]   = useState<string>("13:00");
  const [capacity,  setCapacity]  = useState<string>("2");
  const [note,      setNote]      = useState<string>("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string>("");

  const timeOptions: string[] = [];
  for (let m = 8 * 60; m <= 21 * 60; m += 15) {
    timeOptions.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }

  async function submit() {
    setErr("");
    if (endTime <= startTime) { setErr("เวลาสิ้นสุดต้องหลังเวลาเริ่ม"); return; }
    if (capacity === "" || Number(capacity) < 0) { setErr("ความจุต้องเป็นจำนวนเต็มไม่ติดลบ"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/branches/${branchId}/capacity-overrides`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:      scope === "date"      ? date      : undefined,
          dayOfWeek: scope === "dayOfWeek" ? dayOfWeek : undefined,
          startTime, endTime,
          capacity:  Number(capacity),
          note:      note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      await onDone();
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg p-2.5 mb-2 space-y-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex gap-1.5 text-[11px]">
        <button onClick={() => setScope("date")}
          className="flex-1 py-1.5 rounded-lg font-medium"
          style={{
            background: scope === "date" ? PRIMARY : "white",
            color:      scope === "date" ? "white" : MUTED,
            border:     `1px solid ${scope === "date" ? PRIMARY : BORDER}`,
          }}>วันเฉพาะ</button>
        <button onClick={() => setScope("dayOfWeek")}
          className="flex-1 py-1.5 rounded-lg font-medium"
          style={{
            background: scope === "dayOfWeek" ? PRIMARY : "white",
            color:      scope === "dayOfWeek" ? "white" : MUTED,
            border:     `1px solid ${scope === "dayOfWeek" ? PRIMARY : BORDER}`,
          }}>ทุกสัปดาห์</button>
      </div>

      {scope === "date" ? (
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {DOW_TH.map((d, i) => (
            <button key={i} onClick={() => setDayOfWeek(i)}
              className="py-1.5 rounded-lg text-[11px] font-medium"
              style={{
                background: dayOfWeek === i ? PRIMARY : "white",
                color:      dayOfWeek === i ? "white" : TEXT,
                border:     `1px solid ${dayOfWeek === i ? PRIMARY : BORDER}`,
              }}>{d}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <select value={startTime} onChange={e => setStartTime(e.target.value)}
          className="px-2 py-1.5 text-[11px] rounded-lg bg-white" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
          {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={endTime} onChange={e => setEndTime(e.target.value)}
          className="px-2 py-1.5 text-[11px] rounded-lg bg-white" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
          {timeOptions.filter(t => t > startTime).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" inputMode="numeric" min={0} value={capacity}
          onChange={e => setCapacity(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="คิว"
          className="px-2 py-1.5 text-[11px] rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
      </div>

      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="หมายเหตุ (ไม่บังคับ)"
        className="w-full px-2.5 py-1.5 text-[11px] rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />

      {err && <p className="text-[10px]" style={{ color: "#B91C1C" }}>{err}</p>}

      <button onClick={submit} disabled={saving}
        className="w-full py-2 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50"
        style={{ background: PRIMARY }}>
        {saving ? "กำลังบันทึก..." : "เพิ่มกฎ"}
      </button>
    </div>
  );
}
