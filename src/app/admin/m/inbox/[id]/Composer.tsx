"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, RefreshCw, Loader2, Sparkles, Wand2, CalendarCheck } from "lucide-react";
import type { BookingProposal } from "@/lib/inbox-booking";

interface Draft {
  id: string; status: string; note: string | null; error: string | null; bubbles: string[];
  booking: BookingProposal | null; bookingId: string | null;
}

const thaiDay = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" });
const KIND_LABEL = { linked: "ลูกค้าในระบบ (LINE นี้)", existing: "ลูกค้าเดิม (เจอจากเบอร์) — เช็คว่าเป็นคนเดียวกัน", new: "ลูกค้าใหม่ — จะสร้างให้ตอนจอง" } as const;

const TEXT = "#3B2A24", MUTED = "#A08070", BORDER = "#E8D8CC", LINE_GREEN = "#06C755";
const QUICK = ["สั้นลง", "สุภาพขึ้น", "เสนอ 2–3 เวลาที่ว่าง", "ไม่ต้องทักทาย", "ส่งลิงก์จองคิว"];

/** Bubbles are separated by a blank line in the text box. */
const toBubbles = (text: string) => text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

/**
 * Reply box: starts from the AI draft, editable, sent only when the owner taps
 * Send (and confirms). "แก้ด้วย AI" rewrites the draft from a short instruction.
 */
export default function Composer({ threadId, customerName, draft }: { threadId: string; customerName: string; draft: Draft | null }) {
  const router = useRouter();
  const ready = draft && (draft.status === "READY" || draft.status === "EDITED" || draft.status === "USED") ? draft : null;
  const [text, setText] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "send" | "draft">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [instruction, setInstruction] = useState("");
  const [showRewrite, setShowRewrite] = useState(false);

  // A draft not yet loaded fills an empty box by itself; it never overwrites typing.
  const fresh = draft?.status === "READY" && draft.id !== loadedId ? draft : null;
  const usingFresh = text === "" && !!fresh;
  const value = usingFresh ? fresh.bubbles.join("\n\n") : text;
  const sourceDraftId = usingFresh ? fresh.id : loadedId;

  const pending = busy === "draft" || draft?.status === "PENDING";
  const bubbles = toBubbles(value);

  async function requestDraft(instr?: string) {
    setBusy("draft"); setErr(""); setMsg("");
    try {
      const res = await fetch(`/api/admin/inbox/${threadId}/draft`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instr ? { instruction: instr, previous: bubbles } : {}),
      });
      if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "ร่างไม่สำเร็จ");
      setText(""); setLoadedId(null); setShowRewrite(false); setInstruction("");
      router.refresh();
    } finally { setBusy(""); }
  }

  const proposal = draft?.booking && !draft.bookingId ? draft.booking : null;

  async function send(withBooking: boolean) {
    if (bubbles.length === 0) return;
    if (bubbles.length > 5) { setErr("ส่งได้ครั้งละไม่เกิน 5 ข้อความ — รวมบางข้อความเข้าด้วยกัน"); return; }
    const p = withBooking ? proposal : null;
    const question = p
      ? `จองคิว ${p.customer.name} · ${p.serviceName}\n${thaiDay(p.date)} ${p.startTime}–${p.endTime} · ${p.branchName}\nแล้วส่ง ${bubbles.length} ข้อความทาง LINE?`
      : `ส่ง ${bubbles.length} ข้อความถึง ${customerName} ทาง LINE?`;
    if (!window.confirm(question)) return;
    setBusy("send"); setErr(""); setMsg("");
    try {
      if (p && draft) {
        const br = await fetch(`/api/admin/inbox/${threadId}/book`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: draft.id }),
        });
        const bd = await br.json().catch(() => ({}));
        if (!br.ok) { setErr(`ยังไม่ได้จองและยังไม่ได้ส่ง: ${bd.error ?? "จองไม่สำเร็จ"}`); return; }
      }
      const res = await fetch(`/api/admin/inbox/${threadId}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bubbles, draftId: sourceDraftId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "ส่งไม่สำเร็จ"); return; }
      setText(""); setLoadedId(draft?.id ?? null);
      setMsg(`${p ? "จองแล้ว + " : ""}${d.via === "reply" ? "ส่งแล้ว ✓ (ตอบกลับฟรี ไม่กินโควตา)" : "ส่งแล้ว ✓"}`);
      router.refresh();
    } finally { setBusy(""); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} style={{ color: "#166534" }} />
        <p className="text-xs font-semibold flex-1" style={{ color: "#166534" }}>
          {pending ? "AI กำลังร่างคำตอบ…" : draft?.status === "FAILED" ? "AI ร่างไม่สำเร็จ" : ready ? "ร่างจาก AI — แก้ได้ก่อนส่ง" : "พิมพ์คำตอบ"}
        </p>
        <button type="button" onClick={() => setShowRewrite(v => !v)} disabled={pending || bubbles.length === 0}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-40" style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}>
          <Wand2 size={12} /> แก้ด้วย AI
        </button>
        <button type="button" onClick={() => void requestDraft()} disabled={pending}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-40" style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }}>
          {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} ร่างใหม่
        </button>
      </div>

      {showRewrite && (
        <div className="rounded-xl p-2 space-y-1.5" style={{ background: "#F6FBF7", border: "1px solid #BBE5C8" }}>
          <div className="flex flex-wrap gap-1">
            {QUICK.map(q => (
              <button key={q} type="button" onClick={() => void requestDraft(q)} disabled={pending}
                className="text-[11px] px-2 py-1 rounded-full disabled:opacity-40" style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}>{q}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="หรือพิมพ์คำสั่ง เช่น บอกว่าวันนี้คิวเต็ม เสนอพรุ่งนี้แทน"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs" style={{ border: `1px solid ${BORDER}` }}
              onKeyDown={e => { if (e.key === "Enter" && instruction.trim()) void requestDraft(instruction); }} />
            <button type="button" disabled={!instruction.trim() || pending} onClick={() => void requestDraft(instruction)}
              className="px-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40" style={{ background: "#166534" }}>แก้</button>
          </div>
        </div>
      )}

      {draft?.status === "FAILED" && !pending && <p className="text-[11px]" style={{ color: "#B91C1C" }}>{draft.error}</p>}
      {ready?.note && ready.note !== "-" && !pending && <p className="text-[11px] px-1" style={{ color: "#92400E" }}>📝 {ready.note}</p>}

      {draft?.booking && (
        <div className="rounded-xl p-2.5 text-xs" style={{ background: draft.bookingId ? "#F0FDF4" : "#FFF7ED", border: `1px solid ${draft.bookingId ? "#BBE5C8" : "#FDBA74"}`, color: TEXT }}>
          <p className="font-semibold flex items-center gap-1.5 mb-1" style={{ color: draft.bookingId ? "#166534" : "#9A3412" }}>
            <CalendarCheck size={14} /> {draft.bookingId ? "จองแล้ว" : "AI เตรียมการจองไว้ — จะจองเมื่อกด \"จอง + ส่ง\""}
          </p>
          <p>{draft.booking.serviceName} · {draft.booking.branchName}</p>
          <p className="font-semibold">{thaiDay(draft.booking.date)} {draft.booking.startTime}–{draft.booking.endTime} · ฿{(draft.booking.priceSatang / 100).toLocaleString("th-TH")}</p>
          <p>{draft.booking.customer.name} · {draft.booking.customer.phone}</p>
          <p className="text-[10px]" style={{ color: MUTED }}>{KIND_LABEL[draft.booking.customer.kind]}</p>
          {draft.bookingId && <Link href={`/admin/m/${draft.bookingId}`} className="text-[11px] underline" style={{ color: "#166534" }}>ดูการจอง</Link>}
        </div>
      )}

      {fresh && !usingFresh && (
        <button type="button" onClick={() => { setText(fresh.bubbles.join("\n\n")); setLoadedId(fresh.id); }}
          className="w-full text-[11px] py-1.5 rounded-lg" style={{ background: "#F6FBF7", border: "1px solid #BBE5C8", color: "#166534" }}>
          ✨ มีร่างใหม่จาก AI — แตะเพื่อใช้แทนข้อความที่พิมพ์อยู่
        </button>
      )}
      <textarea value={value} onChange={e => { if (usingFresh) setLoadedId(fresh.id); setText(e.target.value); }}
        rows={Math.min(8, Math.max(3, value.split("\n").length + 1))}
        placeholder={pending ? "รอร่างจาก AI สักครู่… หรือพิมพ์เองได้เลย" : "พิมพ์คำตอบ — เว้นบรรทัดว่าง 1 บรรทัด = แยกเป็นข้อความใหม่"}
        className="w-full px-3 py-2 rounded-xl text-sm" style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "white" }} />

      <div className="flex items-center gap-2">
        <p className="text-[10px] flex-1" style={{ color: MUTED }}>{bubbles.length > 0 ? `${bubbles.length} ข้อความ · เว้นบรรทัดว่าง = แยกข้อความ` : " "}</p>
        <button type="button" onClick={() => void send(!!proposal)} disabled={busy !== "" || bubbles.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: proposal ? "#C2410C" : LINE_GREEN }}>
          {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : proposal ? <CalendarCheck size={15} /> : <Send size={15} />} {proposal ? "จอง + ส่ง" : "ส่ง"}
        </button>
      </div>
      {proposal && (
        <button type="button" onClick={() => void send(false)} disabled={busy !== "" || bubbles.length === 0}
          className="w-full text-[11px] underline disabled:opacity-40" style={{ color: MUTED }}>ส่งข้อความอย่างเดียว (ยังไม่จอง)</button>
      )}
      {msg && <p className="text-[11px] text-center" style={{ color: "#166534" }}>{msg}</p>}
      {err && <p className="text-[11px] text-center" style={{ color: "#B91C1C" }}>{err}</p>}
    </div>
  );
}
