"use client";

import { useState } from "react";
import { MessageSquareWarning, Check } from "lucide-react";

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

/** "แจ้งหัวหน้า" — sends the owner a note about one day's pay. */
export default function ReportButton({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/staff/pay-query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, message: msg }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "ส่งไม่สำเร็จ"); return; }
      setDone(true); setOpen(false); setMsg("");
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); } finally { setBusy(false); }
  }

  if (done) return <p className="text-xs flex items-center gap-1 mt-2" style={{ color: "#166534" }}><Check size={13} /> ส่งให้หัวหน้าตรวจแล้ว</p>;
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
      style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}>
      <MessageSquareWarning size={13} /> แจ้งหัวหน้าให้ตรวจวันนี้
    </button>
  );
  return (
    <div className="mt-2 space-y-2">
      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} maxLength={500} autoFocus
        placeholder="เช่น ลูกค้าคุณเอ 14:00 ทำสีด้วย แต่ค่ามือยังไม่ขึ้น"
        className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${BORDER}` }} />
      {err && <p className="text-xs" style={{ color: "#B91C1C" }}>{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void send()} disabled={busy || msg.trim().length < 3}
          className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: PRIMARY }}>
          {busy ? "กำลังส่ง..." : "ส่งให้หัวหน้า"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>ยกเลิก</button>
      </div>
    </div>
  );
}
