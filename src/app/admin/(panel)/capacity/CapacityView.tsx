"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save, Info, CheckCircle2, AlertTriangle, XCircle, Power, Users, Calendar } from "lucide-react";

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
        <SettingsForm key={branch?.id} branch={branch} />
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
    <section className="rounded-2xl p-5 bg-white h-fit" style={{ border: `1.5px solid ${BORDER}` }}>
      <h2 className="font-medium text-sm mb-4" style={{ color: TEXT }}>ตั้งค่าความจุ — {branch?.name}</h2>

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
        disabled={saving || !branch}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: saving ? MUTED : PRIMARY }}
      >
        <Save size={14} />
        {saving ? "กำลังบันทึก..." : "บันทึก"}
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
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1.5px solid ${BORDER}` }}>
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
