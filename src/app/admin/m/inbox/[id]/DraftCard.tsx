"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Loader2, Sparkles } from "lucide-react";

interface Draft {
  id: string; status: string; note: string | null; error: string | null;
  bubbles: string[]; createdAt: string;
}

const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC";

/** The AI's suggested reply. Part 1: copy it into LINE OA Manager (no Send yet). */
export default function DraftCard({ threadId, draft }: { threadId: string; draft: Draft | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | "all" | null>(null);
  const [err, setErr] = useState("");

  async function copy(text: string, which: number | "all") {
    try { await navigator.clipboard.writeText(text); setCopied(which); window.setTimeout(() => setCopied(null), 1500); }
    catch { setErr("คัดลอกไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอกเอง"); }
  }

  async function regenerate() {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/admin/inbox/${threadId}/draft`, { method: "POST" });
      if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "ร่างใหม่ไม่สำเร็จ");
      router.refresh();
    } finally { setBusy(false); }
  }

  const pending = busy || draft?.status === "PENDING";
  return (
    <div className="rounded-2xl p-3" style={{ background: "#F6FBF7", border: "1px solid #BBE5C8" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} style={{ color: "#166534" }} />
        <p className="text-xs font-semibold flex-1" style={{ color: "#166534" }}>ร่างคำตอบจาก AI</p>
        <button type="button" onClick={() => void regenerate()} disabled={pending}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-50" style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}>
          {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} ร่างใหม่
        </button>
      </div>

      {pending && <p className="text-xs py-2" style={{ color: MUTED }}>กำลังร่างคำตอบ… (ประมาณ 10–20 วินาที)</p>}
      {!pending && !draft && <p className="text-xs py-2" style={{ color: MUTED }}>ยังไม่มีร่าง — กด &quot;ร่างใหม่&quot;</p>}
      {!pending && draft?.status === "FAILED" && <p className="text-xs py-2" style={{ color: "#B91C1C" }}>ร่างไม่สำเร็จ: {draft.error}</p>}
      {!pending && draft && draft.status !== "FAILED" && (
        <>
          {draft.bubbles.length === 0
            ? <p className="text-xs py-1" style={{ color: MUTED }}>AI คิดว่าข้อความนี้ไม่ต้องตอบ</p>
            : <div className="space-y-1.5">
                {draft.bubbles.map((b, i) => (
                  <button key={i} type="button" onClick={() => void copy(b, i)}
                    className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}>
                    <span className="flex-1 whitespace-pre-wrap">{b}</span>
                    {copied === i ? <Check size={14} style={{ color: "#166534" }} /> : <Copy size={14} style={{ color: MUTED }} />}
                  </button>
                ))}
              </div>}
          {draft.note && draft.note !== "-" && <p className="text-[11px] mt-2 px-1" style={{ color: "#92400E" }}>📝 {draft.note}</p>}
          {draft.bubbles.length > 0 && (
            <button type="button" onClick={() => void copy(draft.bubbles.join("\n"), "all")}
              className="mt-2 w-full py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "#06C755" }}>
              {copied === "all" ? <Check size={15} /> : <Copy size={15} />} {copied === "all" ? "คัดลอกแล้ว — วางใน LINE OA ได้เลย" : "คัดลอกทั้งหมด"}
            </button>
          )}
          {draft.status === "STALE" && <p className="text-[10px] mt-1 text-center" style={{ color: MUTED }}>ร่างนี้เก่าแล้ว — มีข้อความใหม่หรือกำลังร่างใหม่</p>}
        </>
      )}
      {err && <p className="text-[11px] mt-1" style={{ color: "#B91C1C" }}>{err}</p>}
      <p className="text-[10px] mt-2 text-center" style={{ color: MUTED }}>ช่วงทดลอง: ยังไม่มีปุ่มส่ง — แตะข้อความเพื่อคัดลอกทีละอัน แล้วไปวางใน LINE OA</p>
    </div>
  );
}
