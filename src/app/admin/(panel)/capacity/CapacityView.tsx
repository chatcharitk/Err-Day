"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save, Info, CheckCircle2, AlertTriangle, XCircle, Power, Users, Calendar, Plus, Trash2 } from "lucide-react";

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

const STATUS_STYLE: Record<HourRow["status"], { bg: string; color: string; label: string; icon: typeof CheckCircle2 }> = {
  open:  { bg: "#F0FDF4", color: "#15803D", label: "ว่าง",     icon: CheckCircle2 },
  tight: { bg: "#FEF3C7", color: "#B45309", label: "ใกล้เต็ม", icon: AlertTriangle },
  full:  { bg: "#FED7AA", color: "#9A3412", label: "เต็ม",     icon: AlertTriangle },
  over:  { bg: "#FEE2E2", color: "#B91C1C", label: "เกินคิว",  icon: XCircle },
};

// ── Top-level component ──────────────────────────────────────────────────────

export default function CapacityView({ branches, activeBranchId, selectedDate }: Props) {
  const branch = branches.find(b => b.id === activeBranchId) ?? branches[0];
  // `key` forces SettingsForm + DailyBreakdown to remount when branch/date change.
  // This is the cleanest way to keep their internal state in sync with props,
  // without an effect that calls setState (which lint flags).
  return (
    <div className="px-6 py-8 max-w-7xl">
      <Header />
      <BranchDateBar branches={branches} activeBranchId={activeBranchId} selectedDate={selectedDate} />
      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <div id="capacity-settings" className="scroll-mt-4 space-y-4">
          <SettingsForm key={branch?.id} branch={branch} />
          {branch && <OverridesPanel branchId={branch.id} />}
        </div>
        <DailyBreakdown key={`${activeBranchId}-${selectedDate}`} branchId={activeBranchId} selectedDate={selectedDate} />
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Capacity</p>
      <h1 className="text-2xl font-medium" style={{ color: TEXT }}>จัดการความจุการจอง</h1>
      <p className="text-sm mt-1" style={{ color: MUTED }}>
        ควบคุมจำนวนคิวต่อสาขาเพื่อไม่ให้ลูกค้าจองเกินจำนวนช่างที่ทำงาน
      </p>
    </div>
  );
}

function BranchDateBar({ branches, activeBranchId, selectedDate }: Props) {
  const router = useRouter();
  function switchBranch(id: string) {
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
  return (
    <div className="flex gap-3 flex-wrap items-end mb-6">
      <div>
        <label className="text-xs uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>สาขา</label>
        <div className="relative">
          <select
            value={activeBranchId}
            onChange={e => switchBranch(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 text-sm rounded-xl border min-w-[200px]"
            style={{ borderColor: BORDER, color: TEXT, background: "white" }}
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-3.5 pointer-events-none" color={MUTED} />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>วันที่</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => changeDate(e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border"
          style={{ borderColor: BORDER, color: TEXT, background: "white" }}
        />
      </div>
    </div>
  );
}

function SettingsForm({ branch }: { branch?: Branch }) {
  const router = useRouter();
  const [onlineCap,      setOnlineCap]      = useState<string>(branch?.onlineCap == null ? "" : String(branch.onlineCap));
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(branch?.bookingEnabled ?? true);
  const [saving,         setSaving]         = useState(false);
  const [justSaved,      setJustSaved]      = useState(false);

  // Hide "saved" indicator after 3s
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(t);
  }, [justSaved]);

  // Track dirty state so the Save button is highlighted only when there are changes
  const currentCapStr = branch?.onlineCap == null ? "" : String(branch.onlineCap);
  const isDirty = onlineCap !== currentCapStr || bookingEnabled !== (branch?.bookingEnabled ?? true);

  async function handleSave() {
    if (!branch) return;
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
      setJustSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl p-5 bg-white h-fit shadow-sm" style={{ border: `1.5px solid ${BORDER}` }}>
      <div className="mb-4 pb-3" style={{ borderBottom: `1px dashed ${BORDER}` }}>
        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: PRIMARY }}>
          ⚙ ตั้งค่าการจอง (แก้ไขที่นี่)
        </p>
        <h2 className="font-semibold text-sm mt-1" style={{ color: TEXT }}>{branch?.name}</h2>
      </div>

      {/* Online cap input */}
      <div className="mb-5">
        <label className="block text-xs mb-1.5 font-medium" style={{ color: MUTED }}>
          จำนวนสูงสุดที่ลูกค้าจองออนไลน์ได้พร้อมกัน
        </label>
        <input
          type="number"
          min={0}
          value={onlineCap}
          onChange={e => setOnlineCap(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="ไม่จำกัด — ใช้จำนวนช่าง"
          className="w-full px-3 py-2.5 text-sm rounded-xl border"
          style={{ borderColor: BORDER, color: TEXT }}
        />
        <div className="mt-2 flex gap-2 text-xs flex-wrap">
          <button onClick={() => setOnlineCap("")}
            className="px-2.5 py-1 rounded-lg border" style={{ borderColor: BORDER, color: MUTED }}>
            ไม่จำกัด
          </button>
          {[2, 3, 4, 5, 6, 8].map(n => (
            <button key={n} onClick={() => setOnlineCap(String(n))}
              className="px-2.5 py-1 rounded-lg border" style={{ borderColor: BORDER, color: MUTED }}>
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: MUTED }}>
          <Info size={11} className="inline mr-1" />
          {onlineCap === ""
            ? "ลูกค้าออนไลน์สามารถจองได้เท่ากับจำนวนช่างที่ทำงาน"
            : onlineCap === "0"
              ? "🔒 ปิดรับจองออนไลน์ — แอดมินยังสร้างนัดได้"
              : `จำกัด ${onlineCap} คิวพร้อมกัน — กันคิวให้ลูกค้า walk-in หรือป้องกันแน่นเกินไป`}
        </p>
      </div>

      {/* Booking enabled toggle */}
      <div className="mb-5">
        <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-xl"
          style={{ background: bookingEnabled ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${bookingEnabled ? "#BBF7D0" : "#FECACA"}` }}>
          <div className="flex items-center gap-2">
            <Power size={14} style={{ color: bookingEnabled ? "#15803D" : "#B91C1C" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: bookingEnabled ? "#15803D" : "#B91C1C" }}>
                {bookingEnabled ? "เปิดรับจองออนไลน์" : "ปิดรับจองออนไลน์"}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {bookingEnabled ? "ลูกค้าเห็นสาขานี้ในหน้าจอง" : "ซ่อนจากลูกค้า — admin ยังสร้างได้"}
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
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !branch || !isDirty}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
        style={{
          background: PRIMARY,
          opacity:    saving ? 0.5 : isDirty ? 1 : 0.5,
        }}
      >
        <Save size={14} />
        {saving ? "กำลังบันทึก..." : isDirty ? "บันทึกการเปลี่ยนแปลง" : "บันทึก"}
      </button>
      {justSaved && (
        <p className="text-xs mt-2 text-center" style={{ color: "#15803D" }}>
          ✓ บันทึกแล้ว
        </p>
      )}
    </section>
  );
}

function DailyBreakdown({ branchId, selectedDate }: { branchId: string; selectedDate: string }) {
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

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <section className="rounded-2xl bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
      <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom: `1.5px solid ${BORDER}` }}>
        <div>
          <h2 className="font-medium text-sm" style={{ color: TEXT }}>
            <Calendar size={13} className="inline mr-1.5" />
            {dateLabel}
          </h2>
          {data && (
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              {data.summary.totalBookings} การจอง · พีค {data.summary.peakBookings} คิวพร้อมกัน
              {data.summary.overHours > 0 && (
                <span className="ml-2 font-semibold" style={{ color: "#B91C1C" }}>
                  🔴 เกินคิว {data.summary.overHours} ชั่วโมง
                </span>
              )}
              {data.summary.overHours === 0 && data.summary.tightHours > 0 && (
                <span className="ml-2 font-semibold" style={{ color: "#B45309" }}>
                  ⚠ ใกล้เต็ม/เต็ม {data.summary.tightHours} ชั่วโมง
                </span>
              )}
            </p>
          )}
        </div>
        <a
          href="#capacity-settings"
          className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{ background: "#FFF8F4", color: PRIMARY, border: `1px solid ${BORDER}` }}
        >
          ⚙ แก้ไขความจุ
        </a>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm" style={{ color: MUTED }}>กำลังโหลด...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="p-10 text-center text-sm" style={{ color: MUTED }}>ไม่มีข้อมูล</div>
      ) : !data.hasShifts ? (
        <div className="p-6 m-5 rounded-xl text-sm" style={{ background: "#FFF8E8", border: "1px solid #FCD34D", color: "#92400E" }}>
          <AlertTriangle size={14} className="inline mr-1.5" />
          ยังไม่ได้ตั้งกะการทำงานสำหรับวันนี้ — ระบบใช้ &ldquo;ช่างที่ทำงานทั้งหมด&rdquo; แทน
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F9F0EA" }}>
              {["เวลา", "ช่างทำงาน", "จองแล้ว", "ความจุ", "ว่างออนไลน์", "สถานะ"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const st = STATUS_STYLE[r.status];
              const Icon = st.icon;
              const pct = r.onlineCap === 0 ? 0 : Math.min(100, Math.round((r.bookings / r.onlineCap) * 100));
              return (
                <tr key={r.hour} style={{
                  background: i % 2 === 0 ? "white" : "#FDFAF8",
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.hour}</p>
                    <p className="text-[10px]" style={{ color: MUTED }}>{r.endHour}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm" style={{ color: TEXT }}>
                      <Users size={11} style={{ color: MUTED }} />
                      {r.staffOnShift}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.bookings}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm" style={{ color: TEXT }}>{r.onlineCap}</p>
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F4E8DE" }}>
                        <div className="h-full transition-all" style={{
                          width: `${pct}%`,
                          background: r.status === "over" ? "#DC2626"
                                   : r.status === "full" ? "#EA580C"
                                   : r.status === "tight" ? "#F59E0B"
                                   :                       "#16A34A",
                        }} />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: r.status === "over" ? "#B91C1C" : MUTED }}>
                        {r.available}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: st.bg, color: st.color }}>
                      <Icon size={11} />
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Overrides panel ──────────────────────────────────────────────────────────

interface Override {
  id:        string;
  date:      string | null;   // "YYYY-MM-DD"
  dayOfWeek: number | null;   // 0-6
  startTime: string;
  endTime:   string;
  capacity:  number;
  note:      string | null;
}

const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function OverridesPanel({ branchId }: { branchId: string }) {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <section className="rounded-2xl p-5 bg-white shadow-sm" style={{ border: `1.5px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px dashed ${BORDER}` }}>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: PRIMARY }}>
            🕒 กฎความจุรายชั่วโมง
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
            ใช้แทนค่าเริ่มต้นในช่วงเวลาที่ระบุ (วันเฉพาะมาก่อนวันประจำสัปดาห์)
          </p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: adding ? "#FEF2F2" : "#FFF8F4", color: PRIMARY, border: `1px solid ${BORDER}` }}
        >
          {adding ? <><XCircle size={12} /> ยกเลิก</> : <><Plus size={12} /> เพิ่ม</>}
        </button>
      </div>

      {adding && (
        <AddOverrideForm
          branchId={branchId}
          onDone={async () => { setAdding(false); await load(); router.refresh(); }}
        />
      )}

      {loading ? (
        <p className="text-xs text-center py-4" style={{ color: MUTED }}>กำลังโหลด...</p>
      ) : overrides.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: MUTED }}>
          ยังไม่มีกฎ — ใช้ค่าเริ่มต้นของสาขา
        </p>
      ) : (
        <ul className="space-y-2">
          {overrides.map(o => (
            <li key={o.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "#FAF5F0", border: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: TEXT }}>
                  {o.date
                    ? `📅 ${new Date(o.date + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`
                    : `🔁 ทุก ${DOW_TH[o.dayOfWeek!]}`}
                  <span className="mx-1.5" style={{ color: MUTED }}>·</span>
                  {o.startTime}–{o.endTime}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                  ความจุ <span className="font-semibold" style={{ color: o.capacity === 0 ? "#B91C1C" : TEXT }}>
                    {o.capacity === 0 ? "🔒 ปิด" : `${o.capacity} คิว`}
                  </span>
                  {o.note && <span> — {o.note}</span>}
                </p>
              </div>
              <button onClick={() => deleteOne(o.id)} className="p-1.5 rounded-lg" style={{ color: "#B91C1C" }}>
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddOverrideForm({ branchId, onDone }: { branchId: string; onDone: () => void | Promise<void> }) {
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

  // Time-slot options (15-min granularity, 08:00 - 21:00)
  const timeOptions: string[] = [];
  for (let m = 8 * 60; m <= 21 * 60; m += 15) {
    timeOptions.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }

  return (
    <div className="rounded-xl p-3 mb-3 space-y-3" style={{ background: "#FFFBF5", border: `1px solid ${BORDER}` }}>
      {/* Scope tabs */}
      <div className="flex gap-1.5 text-xs">
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

      {/* Scope value */}
      {scope === "date" ? (
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
        </div>
      ) : (
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>วันในสัปดาห์</label>
          <div className="grid grid-cols-7 gap-1">
            {DOW_TH.map((d, i) => (
              <button key={i} onClick={() => setDayOfWeek(i)}
                className="py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: dayOfWeek === i ? PRIMARY : "white",
                  color:      dayOfWeek === i ? "white" : TEXT,
                  border:     `1px solid ${dayOfWeek === i ? PRIMARY : BORDER}`,
                }}>{d}</button>
            ))}
          </div>
        </div>
      )}

      {/* Time window */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>เริ่ม</label>
          <select value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded-lg bg-white" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>สิ้นสุด</label>
          <select value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded-lg bg-white" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            {timeOptions.filter(t => t > startTime).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>ความจุ (0 = ปิด)</label>
        <input type="number" inputMode="numeric" min={0} value={capacity}
          onChange={e => setCapacity(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
      </div>

      {/* Note */}
      <div>
        <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: MUTED }}>หมายเหตุ (ไม่บังคับ)</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="เช่น ช่วงพักเที่ยง / วันหยุดพิเศษ"
          className="w-full px-2.5 py-1.5 text-sm rounded-lg" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
      </div>

      {err && <p className="text-xs" style={{ color: "#B91C1C" }}>{err}</p>}

      <button onClick={submit} disabled={saving}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: PRIMARY }}>
        {saving ? "กำลังบันทึก..." : "เพิ่มกฎ"}
      </button>
    </div>
  );
}
