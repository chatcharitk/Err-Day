"use client";
import { useState } from "react";

/** Re-send the voucher LINE card to one customer (from the coupons page list). */
export default function VoucherNotifyButton({ pkgId, sent, linked }: { pkgId: string; sent: boolean; linked: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  if (!linked) return <span className="text-[11px]" style={{ color: "#A08070" }}>ยังไม่เชื่อมไลน์</span>;
  const send = async () => {
    if (sent && !confirm("ส่งข้อความบัตรนี้ให้ลูกค้าอีกครั้ง?")) return;
    setState("busy");
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}/notify`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.status === "SENT") { setState("ok"); setMsg("ส่งแล้ว ✓"); }
      else { setState("err"); setMsg(j.reason === "no_line_link" ? "ยังไม่เชื่อมไลน์" : "ส่งไม่สำเร็จ"); }
    } catch { setState("err"); setMsg("ส่งไม่สำเร็จ"); }
  };
  if (state === "ok" || state === "err") {
    return <span className="text-[11px] font-semibold" style={{ color: state === "ok" ? "#15803D" : "#B91C1C" }}>{msg}</span>;
  }
  return (
    <button onClick={send} disabled={state === "busy"} className="text-[11px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
      style={{ border: "1px solid #E8D8CC", color: sent ? "#A08070" : "#8B1D24", background: "#fff" }}>
      {state === "busy" ? "กำลังส่ง…" : sent ? "ส่งไลน์อีกครั้ง" : "📩 ส่งไลน์"}
    </button>
  );
}
