"use client";
import { useState } from "react";

const REASON: Record<string, string> = {
  no_line_link:  "ยังไม่เชื่อมไลน์",
  no_membership: "ไม่มีสมาชิก",
  pending:       "สมาชิกยังไม่เปิดใช้",
};

/** Send the membership LINE card by hand (when the automatic one failed). */
export default function MembershipNotifyButton({ customerId, small }: { customerId: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const send = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("ส่งการ์ดสมาชิกเข้าไลน์ลูกค้าตอนนี้?")) return;
    setState("busy");
    try {
      const res = await fetch(`/api/admin/membership/customers/${customerId}/notify`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.status === "SENT") { setState("ok"); setMsg("ส่งแล้ว ✓"); }
      else { setState("err"); setMsg(REASON[j.reason] ?? "ส่งไม่สำเร็จ"); }
    } catch { setState("err"); setMsg("ส่งไม่สำเร็จ"); }
  };
  if (state === "ok" || state === "err") {
    return (
      <span onClick={e => { e.preventDefault(); e.stopPropagation(); setState("idle"); }}
        className="text-[11px] font-semibold cursor-pointer" style={{ color: state === "ok" ? "#15803D" : "#B91C1C" }}>
        {msg}
      </span>
    );
  }
  return (
    <button type="button" onClick={send} disabled={state === "busy"}
      className={`${small ? "px-2 py-1" : "px-3 py-1.5"} rounded-lg text-[11px] font-semibold disabled:opacity-50 whitespace-nowrap`}
      style={{ border: "1px solid #E8D8CC", color: "#8B1D24", background: "#fff" }}
      title="ส่งการ์ดสมาชิกเข้าไลน์ลูกค้า (ใช้เมื่อระบบส่งอัตโนมัติไม่สำเร็จ)">
      {state === "busy" ? "กำลังส่ง…" : "📩 ส่งไลน์"}
    </button>
  );
}
