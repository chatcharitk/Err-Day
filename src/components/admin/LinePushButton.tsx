"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

/**
 * Desktop "ส่งเข้ากลุ่ม LINE" button — same endpoints the phone app uses to
 * push today's / tomorrow's schedule into the branch's LINE group.
 *   kind "bookings" → /api/admin/notify/bookings (ตารางจอง)
 *   kind "shifts"   → /api/admin/notify/shifts   (ตารางงาน)
 */
export default function LinePushButton({ branchId, kind }: { branchId: string; kind: "bookings" | "shifts" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"today" | "tomorrow" | null>(null);
  const [toast, setToast] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const what = kind === "bookings" ? "ตารางจอง" : "ตารางงาน";
  const unit = kind === "bookings" ? "คิว" : "คน";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function push(day: "today" | "tomorrow") {
    if (busy) return;
    setBusy(day);
    try {
      const res = await fetch(`/api/admin/notify/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, day }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setToast(`ส่งไม่สำเร็จ: ${data.error ?? res.status}`); return; }
      setOpen(false);
      setToast(data.count > 0 ? `ส่ง${what}เข้ากลุ่มแล้ว (${data.count} ${unit})` : `ส่งแล้ว — วันนั้นยังไม่มี${what}`);
    } catch {
      setToast("เกิดข้อผิดพลาด — ลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors"
        style={{ background: "#ECFDF3", color: "#05A847", borderColor: "#A7F3D0" }}
        title={`ส่ง${what}เข้ากลุ่ม LINE ของสาขา`}>
        <Send size={14} /> ส่งเข้ากลุ่ม LINE
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg p-2 z-50">
          <p className="text-xs text-gray-500 px-2 pb-1.5">ส่ง{what}ของวันไหน?</p>
          {(["today", "tomorrow"] as const).map(d => (
            <button key={d} onClick={() => push(d)} disabled={!!busy}
              className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {busy === d ? "กำลังส่ง…" : d === "today" ? "วันนี้" : "พรุ่งนี้"}
            </button>
          ))}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg"
          style={{ background: "#3B2A24", zIndex: 100000 }}>{toast}</div>
      )}
    </div>
  );
}
