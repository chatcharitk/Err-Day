"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, X, Loader2 } from "lucide-react";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

interface Shift { id: string; date: string; startTime: string; endTime: string }

interface Props {
  staff:         { id: string; name: string; branchName: string };
  initialShifts: Shift[];
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateTh(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

export default function StaffShifts({ staff, initialShifts }: Props) {
  const router = useRouter();
  const [shifts, setShifts] = useState(initialShifts);
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate]           = useState(todayStr());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime,   setEndTime]   = useState("20:00");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  // Group shifts by date
  const byDate = shifts.reduce((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {} as Record<string, Shift[]>);

  const addShift = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/shifts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, startTime, endTime }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "เพิ่มกะไม่สำเร็จ"); return; }
      setShifts(prev => [...prev, { id: data.id, date, startTime, endTime }].sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
      ));
      setShowAdd(false);
    } finally { setBusy(false); }
  };

  const deleteShift = async (shiftId: string) => {
    if (!confirm("ลบกะนี้?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/shifts/${shiftId}`, { method: "DELETE" });
      if (!res.ok) return;
      setShifts(prev => prev.filter(s => s.id !== shiftId));
    } finally { setBusy(false); }
  };

  return (
    <main className="pb-20">
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: TEXT }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-medium truncate" style={{ color: TEXT }}>{staff.name}</h1>
            <p className="text-[11px]" style={{ color: MUTED }}>{staff.branchName} · กะ 30 วันข้างหน้า</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 h-9 rounded-full text-sm font-medium text-white"
            style={{ background: PRIMARY }}
          >
            <Plus size={15} /> เพิ่มกะ
          </button>
        </div>
      </header>

      {/* Add shift form */}
      {showAdd && (
        <section className="px-4 pt-3">
          <div className="rounded-xl border-2 p-3 space-y-2" style={{ borderColor: PRIMARY, background: "#FFF8F4" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: PRIMARY }}>เพิ่มกะใหม่</p>
              <button onClick={() => { setShowAdd(false); setErr(""); }} style={{ color: MUTED }}><X size={14} /></button>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>วันที่</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: BORDER, background: "white" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>เริ่ม</label>
                <input
                  type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: BORDER, background: "white" }}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>เลิก</label>
                <input
                  type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: BORDER, background: "white" }}
                />
              </div>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button
              onClick={addShift}
              disabled={busy}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </section>
      )}

      <section className="px-4 pt-3">
        {Object.keys(byDate).length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: BORDER, color: MUTED }}>
            <p className="text-sm font-medium">ยังไม่มีกะใน 30 วันข้างหน้า</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(byDate).map(([d, list]) => (
              <div key={d}>
                <p className="text-xs font-medium mb-1.5" style={{ color: TEXT }}>{fmtDateTh(d)}</p>
                <ul className="space-y-1.5">
                  {list.map(s => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "white", border: `1px solid ${BORDER}` }}>
                      <span className="text-sm" style={{ color: TEXT }}>{s.startTime}–{s.endTime}</span>
                      <button
                        onClick={() => deleteShift(s.id)}
                        disabled={busy}
                        className="p-1 disabled:opacity-50"
                        style={{ color: "#991B1B" }}
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
