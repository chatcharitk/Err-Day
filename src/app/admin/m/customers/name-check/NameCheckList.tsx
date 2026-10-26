"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Phone } from "lucide-react";
import type { NameCheckItem } from "@/lib/customer-name-check";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const OK      = "#166534";

/**
 * One card per customer whose name needs a person: the suggestion is filled in,
 * staff fix it if needed and tap บันทึก, or tap "ถูกแล้ว" to keep it as is.
 */
export default function NameCheckList({ items }: { items: NameCheckItem[] }) {
  const [done, setDone] = useState<Record<string, "save" | "ok">>({});
  const left = items.filter(i => !done[i.id]).length;

  return (
    <main className="pb-16" style={{ background: "#FDF8F3", minHeight: "100vh" }}>
      <header className="sticky top-0 z-20 bg-white px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <Link href="/admin/m/customers" className="p-1" style={{ color: MUTED }} aria-label="กลับ"><ArrowLeft size={18} /></Link>
        <h1 className="text-base font-medium flex-1" style={{ color: TEXT }}>ตรวจชื่อลูกค้า</h1>
        <span className="text-sm" style={{ color: left ? PRIMARY : OK }}>{left ? `เหลือ ${left}` : "ครบแล้ว ✓"}</span>
      </header>
      <p className="px-4 pt-3 text-xs leading-relaxed" style={{ color: MUTED }}>
        ชื่อเล่น = เฉพาะชื่อเล่น (เช่น บิว) · ชื่อจริง = ชื่อ + นามสกุล (ถ้าไม่รู้ ใส่ชื่อเล่นซ้ำได้) · ในรายการจองจะแสดงเป็น “บิว · ศุภิสรา”
      </p>
      <div className="px-4 pt-3 space-y-3">
        {items.map(i => <Card key={i.id} item={i} state={done[i.id]} onDone={a => setDone(d => ({ ...d, [i.id]: a }))} />)}
        {!items.length && <p className="text-center py-12 text-sm" style={{ color: MUTED }}>ไม่มีรายชื่อที่ต้องตรวจแล้ว 🎉</p>}
      </div>
    </main>
  );
}

function Card({ item, state, onDone }: { item: NameCheckItem; state?: "save" | "ok"; onDone: (a: "save" | "ok") => void }) {
  const [nickname, setNickname] = useState(item.fix.nickname ?? "");
  const [name, setName] = useState(item.fix.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(action: "save" | "ok") {
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/customers/name-check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action, nickname, name, note: item.fix.note }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { const j = await res?.json().catch(() => ({})) as { error?: string } | undefined; setErr(j?.error ?? "บันทึกไม่สำเร็จ"); return; }
    onDone(action);
  }

  if (state) {
    return (
      <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm" style={{ background: "#F0FDF4", color: OK }}>
        <Check size={15} /> {state === "ok" ? `${item.nickname ?? item.name} — ใช้ชื่อเดิม` : `${nickname || name}${nickname && name && name !== nickname ? ` · ${name.split(" ")[0]}` : ""} — บันทึกแล้ว`}
      </div>
    );
  }
  const preview = nickname && name && name !== nickname ? `${nickname} · ${name.split(/\s+/)[0]}` : (nickname || name);
  const field = "w-full px-3 py-2 rounded-lg text-sm outline-none bg-white";
  return (
    <div className="rounded-xl bg-white p-3 space-y-2.5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="text-xs space-y-0.5" style={{ color: MUTED }}>
        <p>ตอนนี้: ชื่อเล่น <b style={{ color: TEXT }}>{item.nickname || "—"}</b> · ชื่อ <b style={{ color: TEXT }}>{item.name}</b></p>
        <p className="flex flex-wrap gap-x-2">
          <span className="inline-flex items-center gap-1"><Phone size={10} />{item.phone}</span>
          {item.visits > 0 && <span>{item.visits} ครั้ง{item.lastBranch ? ` · ${item.lastBranch}` : ""}</span>}
          {item.lineDisplayName && <span>LINE: {item.lineDisplayName}</span>}
        </p>
        <p style={{ color: "#9A3412" }}>{item.fix.reason}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]" style={{ color: MUTED }}>ชื่อเล่น
          <input id={`nick-${item.id}`} className={field} style={{ border: `1px solid ${BORDER}`, color: TEXT }} value={nickname} onChange={e => setNickname(e.target.value)} />
        </label>
        <label className="text-[11px]" style={{ color: MUTED }}>ชื่อจริง นามสกุล
          <input id={`name-${item.id}`} className={field} style={{ border: `1px solid ${BORDER}`, color: TEXT }} value={name} onChange={e => setName(e.target.value)} />
        </label>
      </div>
      {item.fix.note && <p className="text-[11px]" style={{ color: MUTED }}>ย้ายไปหมายเหตุ: {item.fix.note}</p>}
      <p className="text-xs" style={{ color: MUTED }}>จะแสดงเป็น: <b style={{ color: TEXT }}>{preview || "—"}</b></p>
      {err && <p className="text-xs" style={{ color: "#B91C1C" }}>{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => send("save")} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: PRIMARY }}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" disabled={busy} onClick={() => send("ok")} className="px-3 py-2 rounded-lg text-sm disabled:opacity-50" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
          ชื่อเดิมถูกแล้ว
        </button>
      </div>
    </div>
  );
}
