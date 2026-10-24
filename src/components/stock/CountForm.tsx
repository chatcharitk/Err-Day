"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, Plus, Minus } from "lucide-react";
import type { StockRow } from "@/lib/stock";
import { BORDER, MUTED, PRIMARY, TEXT, LOW, OK, label, postStock } from "./theme";

/**
 * Shelf count for one location. Staff type what is on the shelf; blank rows
 * are left unchanged. Shows the difference vs. the app's number as they type.
 */
export default function CountForm({ location, locationName, rows, doneHref, addProductHref }: {
  location: string; locationName: string; rows: StockRow[]; doneHref: string; addProductHref?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => label(r).toLowerCase().includes(s)) : rows;
  }, [q, rows]);
  const filled = Object.entries(vals).filter(([, v]) => v.trim() !== "");

  function bump(id: string, d: number) {
    setVals(v => {
      const cur = v[id]?.trim() ? Number(v[id]) : (rows.find(r => r.id === id)?.levels[location]?.qty ?? 0);
      return { ...v, [id]: String(Math.max(0, (Number.isFinite(cur) ? cur : 0) + d)) };
    });
  }

  async function save() {
    setErr(null);
    const lines = filled.map(([productId, v]) => ({ productId, counted: Number(v) }));
    if (lines.some(l => !Number.isInteger(l.counted) || l.counted < 0)) { setErr("จำนวนต้องเป็นเลขจำนวนเต็ม 0 ขึ้นไป"); return; }
    if (!confirm(`บันทึกการนับ ${lines.length} รายการ ที่ ${locationName}?`)) return;
    setBusy(true);
    const r = await postStock({ action: "count", location, lines });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push(doneHref);
    router.refresh();
  }

  return (
    <div className="pb-28">
      <div className="px-4 pt-3 pb-2 space-y-2">
        <p className="text-xs" style={{ color: MUTED }}>
          นับของที่ <b style={{ color: TEXT }}>{locationName}</b> แล้วกรอกจำนวนจริงบนชั้น (เต็มหน่วย เช่น ขวด/หลอด) · ช่องที่เว้นว่างจะไม่เปลี่ยน
        </p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
          <Search size={15} style={{ color: MUTED }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
      </div>

      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm" style={{ color: MUTED }}>ยังไม่มีสินค้าในระบบ</p>
      )}

      <ul>
        {shown.map(r => {
          const cur = r.levels[location]?.qty ?? 0;
          const v = vals[r.id] ?? "";
          const n = v.trim() === "" ? null : Number(v);
          const diff = n != null && Number.isFinite(n) ? n - cur : null;
          return (
            <li key={r.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug" style={{ color: TEXT }}>{label(r)}</p>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  ในระบบ {cur} {r.unit}
                  {diff != null && diff !== 0 && (
                    <b className="ml-1.5" style={{ color: diff < 0 ? LOW : OK }}>{diff > 0 ? `+${diff}` : diff}</b>
                  )}
                </p>
              </div>
              <button type="button" onClick={() => bump(r.id, -1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="ลด"><Minus size={14} /></button>
              <input
                inputMode="numeric" value={v} placeholder="–"
                onChange={e => setVals(s => ({ ...s, [r.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                className="w-14 text-center text-base py-1.5 rounded-lg outline-none"
                style={{ border: `1px solid ${v ? PRIMARY : BORDER}`, color: TEXT }}
              />
              <button type="button" onClick={() => bump(r.id, 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="เพิ่ม"><Plus size={14} /></button>
            </li>
          );
        })}
      </ul>

      {addProductHref && (
        <div className="px-4 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <a href={addProductHref} className="text-sm font-medium" style={{ color: PRIMARY }}>+ ไม่เจอสินค้า? เพิ่มสินค้าใหม่</a>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-md mx-auto bg-white px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          {err && <p className="text-xs mb-2" style={{ color: LOW }}>{err}</p>}
          <button type="button" disabled={busy || filled.length === 0} onClick={save}
            className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: PRIMARY }}>
            <Check size={17} /> {busy ? "กำลังบันทึก…" : `บันทึกการนับ (${filled.length} รายการ)`}
          </button>
        </div>
      </div>
    </div>
  );
}
