"use client";

import { useState } from "react";
import { Link2, Loader2, Copy, Check } from "lucide-react";

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";

/**
 * Admin control to link a customer's LINE account. When the customer isn't
 * linked yet, it mints a one-tap link (POST /api/admin/customers/[id]/link-token)
 * and copies it so staff can send it to the customer. Opening that link in LINE
 * links their account and auto-sends their membership card.
 */
export default function LineLinkButton({
  customerId,
  linked,
}: {
  customerId: string;
  linked: boolean;
}) {
  const [busy,   setBusy]   = useState(false);
  const [url,    setUrl]    = useState("");
  const [copied, setCopied] = useState(false);
  const [err,    setErr]    = useState("");

  if (linked) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
        style={{ background: "#F0FDF4", color: "#166534" }}
      >
        <Check size={12} /> เชื่อม LINE แล้ว
      </span>
    );
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked — staff can long-press the field to copy */ }
  }

  async function generate() {
    setBusy(true); setErr("");
    try {
      const res  = await fetch(`/api/admin/customers/${customerId}/link-token`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setUrl(data.url);
      copy(data.url);
    } catch {
      setErr("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!url) {
    return (
      <div>
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          ส่งลิงก์เชื่อม LINE
        </button>
        {err && <p className="text-xs mt-1" style={{ color: "#DC2626" }}>{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg outline-none"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "#FAFAFA" }}
        />
        <button
          onClick={() => copy(url)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0 text-white"
          style={{ background: PRIMARY }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
      <p className="text-[11px]" style={{ color: MUTED }}>
        ส่งลิงก์นี้ให้ลูกค้าทาง LINE/SMS — เมื่อเปิดในแอป LINE บัญชีจะถูกเชื่อมและระบบจะส่งรายละเอียดสมาชิกให้อัตโนมัติ
      </p>
    </div>
  );
}
