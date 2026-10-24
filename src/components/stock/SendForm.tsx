"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Minus, Plus, Truck } from "lucide-react";
import type { Location, StockRow } from "@/lib/stock";
import { BORDER, MUTED, PRIMARY, TEXT, LOW, label, postStock } from "./theme";

/** Admin: send stock from one place (usually home) to a branch. */
export default function SendForm({ locations, rows, defaultFrom, defaultTo }: {
  locations: Location[]; rows: StockRow[]; defaultFrom: string; defaultTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chosen = Object.entries(qty).filter(([, n]) => n > 0);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => !s || label(r).toLowerCase().includes(s))
      .sort((a, b) => (b.levels[from]?.qty ?? 0) - (a.levels[from]?.qty ?? 0));
  }, [q, rows, from]);
  const name = (id: string) => locations.find(l => l.id === id)?.short ?? id;

  function bump(id: string, d: number) { setQty(s => ({ ...s, [id]: Math.max(0, (s[id] ?? 0) + d) })); }

  async function send() {
    if (from === to) { setErr("ต้นทางกับปลายทางต้องต่างกัน"); return; }
    if (!confirm(`ส่ง ${chosen.length} รายการ จาก ${name(from)} ไป ${name(to)}?`)) return;
    setBusy(true); setErr(null);
    const r = await postStock({ action: "transfer", from, to, note, items: chosen.map(([productId, n]) => ({ productId, qty: n })) });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push("/admin/m/stock");
    router.refresh();
  }

  const chip = (on: boolean) => on ? { background: PRIMARY, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED };

  return (
    <div className="pb-28">
      <div className="px-4 pt-3 space-y-2">
        <p className="text-xs" style={{ color: MUTED }}>จาก</p>
        <div className="flex flex-wrap gap-2">
          {locations.map(l => <button key={l.id} type="button" onClick={() => { setFrom(l.id); if (to === l.id) setTo(locations.find(x => x.id !== l.id)?.id ?? to); }} className="px-3 py-1.5 rounded-full text-sm" style={chip(from === l.id)}>{l.short}</button>)}
        </div>
        <p className="text-xs pt-1" style={{ color: MUTED }}>ไปที่</p>
        <div className="flex flex-wrap gap-2">
          {locations.filter(l => l.id !== from).map(l => <button key={l.id} type="button" onClick={() => setTo(l.id)} className="px-3 py-1.5 rounded-full text-sm" style={chip(to === l.id)}>{l.short}</button>)}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2" style={{ border: `1px solid ${BORDER}` }}>
          <Search size={15} style={{ color: MUTED }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
      </div>
      <ul className="mt-2">
        {shown.map(r => {
          const n = qty[r.id] ?? 0;
          const have = r.levels[from]?.qty ?? 0;
          return (
            <li key={r.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: TEXT }}>{label(r)}</p>
                <p className="text-[11px]" style={{ color: n > have ? LOW : MUTED }}>{name(from)} มี {have} · {name(to)} มี {r.levels[to]?.qty ?? 0} {r.unit}</p>
              </div>
              <button type="button" onClick={() => bump(r.id, -1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="ลด"><Minus size={14} /></button>
              <span className="w-7 text-center font-semibold" style={{ color: n ? PRIMARY : MUTED }}>{n}</span>
              <button type="button" onClick={() => bump(r.id, 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="เพิ่ม"><Plus size={14} /></button>
            </li>
          );
        })}
      </ul>
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-md mx-auto bg-white px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ)" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${BORDER}` }} />
          {err && <p className="text-xs" style={{ color: LOW }}>{err}</p>}
          <button type="button" disabled={busy || chosen.length === 0} onClick={send} className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: PRIMARY }}>
            <Truck size={17} /> {busy ? "กำลังบันทึก…" : `ส่งของ ${chosen.length} รายการ ไป ${name(to)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
