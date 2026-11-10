"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import MultiImageUpload from "@/components/MultiImageUpload";

/**
 * Payment-slip images for one booking, for the desktop quick-edit popups
 * (calendar, sales history). Same storage + PATCH the phone booking page uses;
 * attaching a slip stamps paidAt server-side, reported through onPaid.
 */
export default function BookingSlips({ bookingId, onPaid }: {
  bookingId: string;
  onPaid?: (paidAtIso: string) => void;
}) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [err,  setErr]  = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((b: { receiptUrls?: string[]; receiptUrl?: string | null }) => {
        if (cancelled) return;
        setUrls(b.receiptUrls?.length ? b.receiptUrls : b.receiptUrl ? [b.receiptUrl] : []);
      })
      .catch(() => { if (!cancelled) { setUrls([]); setErr("โหลดสลิปไม่สำเร็จ"); } });
    return () => { cancelled = true; };
  }, [bookingId]);

  async function save(next: string[]) {
    setErr("");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptUrls: next }),
    });
    if (!res.ok) { setErr("บันทึกสลิปไม่สำเร็จ — ลองอีกครั้ง"); return; }
    const updated = await res.json().catch(() => null);
    setUrls(next);
    if (updated?.paidAt) onPaid?.(updated.paidAt);
  }

  if (urls === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <Loader2 size={14} className="animate-spin" /> กำลังโหลดสลิป…
      </div>
    );
  }
  return (
    <div>
      <MultiImageUpload
        kind="receipt"
        ref={bookingId}
        value={urls}
        label="สลิปโอนเงิน (รูปภาพ)"
        addLabel={urls.length === 0 ? "แนบสลิป" : "แนบสลิปเพิ่ม"}
        onChange={save}
      />
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
