"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Send } from "lucide-react";
import { RESTOCK_GROUPS } from "@/lib/restock";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#F3EDE8";

/** Tap-to-tick version of the paper restock checklist. */
export default function RestockForm({ branches, defaultBranchId }: {
  branches: { id: string; name: string }[]; defaultBranchId: string | null;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState(["", ""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const toggle = (i: string) => setPicked(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const count = picked.size + extras.filter(e => e.trim()).length;

  async function send() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/restock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, items: [...picked], extras, note }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({})) as { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) { setMsg({ t: j?.error ?? "ส่งไม่สำเร็จ ลองอีกครั้ง", bad: true }); return; }
    setPicked(new Set()); setExtras(["", ""]); setNote("");
    setMsg({ t: "ส่งให้เจ้าของร้านแล้ว ✓" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {branches.length > 1 && (
        <div className="flex gap-2">
          {branches.map(b => (
            <button key={b.id} type="button" onClick={() => setBranchId(b.id)} className="flex-1 py-2 rounded-xl text-sm font-semibold"
              style={branchId === b.id ? { background: PRIMARY, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED, background: "white" }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {RESTOCK_GROUPS.map(g => (
        <section key={g.title} className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <p className="px-4 py-2 text-sm font-semibold" style={{ background: BG, color: PRIMARY }}>{g.title}</p>
          {g.items.map(i => {
            const on = picked.has(i);
            return (
              <button key={i} type="button" onClick={() => toggle(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ borderTop: `1px solid ${BORDER}` }} aria-pressed={on}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={on ? { background: PRIMARY } : { border: `1.5px solid ${BORDER}` }}>
                  {on && <Check size={15} color="white" />}
                </span>
                <span className="text-[15px]" style={{ color: TEXT, fontWeight: on ? 600 : 400 }}>{i}</span>
              </button>
            );
          })}
        </section>
      ))}

      <section className="bg-white rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${BORDER}` }}>
        <p className="text-sm font-semibold" style={{ color: PRIMARY }}>ของเพิ่มเติม</p>
        {extras.map((e, k) => (
          <input key={k} value={e} onChange={ev => setExtras(x => x.map((y, j) => (j === k ? ev.target.value : y)))}
            placeholder="พิมพ์ชื่อของ…" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
        ))}
        {extras.length < 10 && (
          <button type="button" onClick={() => setExtras(x => [...x, ""])} className="text-xs font-semibold" style={{ color: PRIMARY }}>+ เพิ่มบรรทัด</button>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="หมายเหตุ (ถ้ามี) เช่น ต้องใช้ภายในพรุ่งนี้"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${BORDER}`, color: TEXT }} />
      </section>

      {msg && <p className="text-sm text-center" style={{ color: msg.bad ? "#B42318" : "#166534" }}>{msg.t}</p>}

      <button type="button" disabled={busy || count === 0} onClick={send}
        className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: PRIMARY }}>
        <Send size={16} /> {busy ? "กำลังส่ง…" : count ? `ส่งให้เจ้าของร้าน (${count} รายการ)` : "เลือกของที่ต้องเติม"}
      </button>
    </div>
  );
}
