"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban } from "lucide-react";

const PRIMARY = "#8B1D24";
const GRAY    = "#374151";

interface StaffItem { id: string; name: string }

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function makeTimeSlots(step = 15): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 21; h++)
    for (let m = 0; m < 60; m += step)
      slots.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  return slots;
}
const ALL_SLOTS = makeTimeSlots(15);

function BlockForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const branchId     = searchParams.get("branchId") ?? "";
  const initDate     = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const [date,      setDate]      = useState(initDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime,   setEndTime]   = useState("10:00");
  const [staffId,   setStaffId]   = useState("");
  const [reason,    setReason]    = useState("");
  const [staff,     setStaff]     = useState<StaffItem[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const endSlots = ALL_SLOTS.filter(t => timeToMins(t) > timeToMins(startTime));

  const loadStaff = useCallback(() => {
    if (!branchId) return;
    fetch(`/api/admin/staff?branchId=${branchId}`)
      .then(r => r.json())
      .then((d: { staff?: StaffItem[] }) => setStaff(d.staff ?? []))
      .catch(() => {});
  }, [branchId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (timeToMins(endTime) <= timeToMins(startTime)) {
      setError("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/branches/${branchId}/blocked-slots`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ date, startTime, endTime, staffId: staffId || null, reason: reason.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    router.push(`/admin/m?branchId=${branchId}&date=${date}`);
  }

  return (
    <main className="min-h-screen" style={{ background: "#FDF8F3" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: GRAY, borderColor: "#4B5563" }}>
        <button onClick={() => router.back()} className="text-white/70 hover:text-white p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 font-bold text-white text-base">🚫 ปิดช่วงเวลา</h1>
      </div>

      <form onSubmit={submit} className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Date */}
        <div>
          <label className="text-xs text-gray-500 block mb-1 font-medium">วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none bg-white" />
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1 font-medium">เวลาเริ่ม</label>
            <select value={startTime}
              onChange={e => { setStartTime(e.target.value); if (timeToMins(e.target.value) >= timeToMins(endTime)) setEndTime(ALL_SLOTS.find(t => timeToMins(t) > timeToMins(e.target.value)) ?? endTime); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none bg-white">
              {ALL_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1 font-medium">เวลาสิ้นสุด</label>
            <select value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none bg-white">
              {endSlots.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Staff selector */}
        <div>
          <label className="text-xs text-gray-500 block mb-2 font-medium">ปิดสำหรับ</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStaffId("")}
              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
              style={staffId === "" ? { background: GRAY, color: "white", borderColor: GRAY }
                                   : { background: "white", color: "#374151", borderColor: "#D1D5DB" }}>
              ทั้งสาขา
            </button>
            {staff.map(s => (
              <button key={s.id} type="button" onClick={() => setStaffId(s.id)}
                className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                style={staffId === s.id ? { background: GRAY, color: "white", borderColor: GRAY }
                                        : { background: "white", color: "#374151", borderColor: "#D1D5DB" }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="text-xs text-gray-500 block mb-1 font-medium">เหตุผล (ไม่บังคับ)</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="เช่น พักกลางวัน, อบรม, ปิดปรับปรุง…"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none bg-white" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
          style={{ background: GRAY }}>
          {saving ? "กำลังบันทึก..." : "🚫 ปิดช่วงเวลานี้"}
        </button>
      </form>
    </main>
  );
}

export default function MobileBlockPage() {
  return (
    <Suspense>
      <BlockForm />
    </Suspense>
  );
}
