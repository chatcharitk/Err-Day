"use client";

import { useState } from "react";
import { Modal, makeTimeSlots, timeToMins, addMinutes, type StaffItem } from "./_shared";

export default function BlockSlotModal({
  defaultDate, branchId, staff, onClose, onSaved,
}: {
  defaultDate: string;
  branchId:    string;
  staff:       StaffItem[];
  onClose:     () => void;
  onSaved:     () => void;
}) {
  const timeSlots = makeTimeSlots(15);
  const [date,      setDate]      = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime,   setEndTime]   = useState("10:00");
  const [staffId,   setStaffId]   = useState<string>("");
  const [reason,    setReason]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const endSlots = timeSlots.filter(t => timeToMins(t) > timeToMins(startTime));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!endTime || timeToMins(endTime) <= timeToMins(startTime)) {
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
    onSaved();
    onClose();
  }

  return (
    <Modal>
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: "#374151" }}>
          <h2 className="font-bold text-base text-white">🚫 ปิดช่วงเวลา</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">เวลาเริ่ม</label>
              <select value={startTime} onChange={e => { setStartTime(e.target.value); if (timeToMins(e.target.value) >= timeToMins(endTime)) setEndTime(addMinutes(e.target.value, 60)); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">เวลาสิ้นสุด</label>
              <select value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                {endSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">ปิดสำหรับ</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setStaffId("")}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={staffId === "" ? { background: "#374151", color: "white", borderColor: "#374151" }
                                      : { background: "white",   color: "#374151", borderColor: "#D1D5DB" }}>
                ทั้งสาขา
              </button>
              {staff.map(s => (
                <button key={s.id} type="button" onClick={() => setStaffId(s.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={staffId === s.id ? { background: "#374151", color: "white", borderColor: "#374151" }
                                          : { background: "white",   color: "#374151", borderColor: "#D1D5DB" }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">เหตุผล (ไม่บังคับ)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="เช่น พักกลางวัน, อบรม, ปิดปรับปรุง…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 transition-colors"
            style={{ background: "#374151" }}>
            {saving ? "กำลังบันทึก..." : "🚫 ปิดช่วงเวลานี้"}
          </button>
        </form>
      </div>
    </div>
    </Modal>
  );
}
