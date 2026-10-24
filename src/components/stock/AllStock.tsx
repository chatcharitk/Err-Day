"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Location, StockRow } from "@/lib/stock";
import { BORDER, MUTED, TEXT, LOW, LOW_BG, label } from "./theme";
import CategoryChips, { GroupHeader } from "./CategoryChips";
import { groupByCategory, NO_CATEGORY } from "@/lib/stock-categories";

/** Every product × every place; low stock in red. Tap a product for its page. */
export default function AllStock({ locations, rows, base = "/admin/m/stock" }: { locations: Location[]; rows: StockRow[]; base?: string }) {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const isLow = (r: StockRow, l: string) => { const v = r.levels[l]; return !!v && ((v.min > 0 && v.qty <= v.min) || v.qty < 0); };
  const anyLow = (r: StockRow) => locations.some(l => isLow(r, l.id));
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => (!s || label(r).toLowerCase().includes(s)) && (!lowOnly || anyLow(r)) && (!cat || (r.category?.trim() || NO_CATEGORY) === cat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rows, lowOnly, cat]);
  const lowCount = rows.filter(anyLow).length;
  const cols = `minmax(0,1fr) repeat(${locations.length}, 2.6rem)`;

  return (
    <div>
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
          <Search size={15} style={{ color: MUTED }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        <CategoryChips rows={rows} value={cat} onChange={setCat} />
        {lowCount > 0 && (
          <button type="button" onClick={() => setLowOnly(v => !v)} className="text-xs px-3 py-1 rounded-full"
            style={{ background: lowOnly ? LOW : LOW_BG, color: lowOnly ? "white" : LOW }}>
            ใกล้หมด {lowCount} รายการ
          </button>
        )}
      </div>
      <div className="grid px-4 py-1.5 text-[11px] sticky top-[53px] bg-white z-[5]" style={{ gridTemplateColumns: cols, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
        <span>สินค้า</span>
        {locations.map(l => <span key={l.id} className="text-center truncate">{l.short}</span>)}
      </div>
      {rows.length === 0 && <p className="px-4 py-8 text-center text-sm" style={{ color: MUTED }}>ยังไม่มีสินค้า — กด “เพิ่มสินค้า” เพื่อเริ่ม</p>}
      <ul>
        {groupByCategory(shown).map(g => [
          <GroupHeader key={`h-${g.category}`} title={g.category} />,
          ...g.rows.map(r => (
          <li key={r.id}>
            <Link href={`${base}/products/${r.id}`} className="grid items-center px-4 py-2.5" style={{ gridTemplateColumns: cols, borderBottom: `1px solid ${BORDER}`, opacity: r.isActive ? 1 : 0.5 }}>
              <span className="text-sm leading-snug pr-2" style={{ color: TEXT }}>{label(r)} <span className="text-[11px]" style={{ color: MUTED }}>({r.unit})</span></span>
              {locations.map(l => {
                const low = isLow(r, l.id);
                return (
                  <span key={l.id} className="text-center text-sm mx-0.5 rounded" style={{ color: low ? LOW : TEXT, background: low ? LOW_BG : "transparent", fontWeight: low ? 600 : 400 }}>
                    {r.levels[l.id]?.qty ?? 0}
                  </span>
                );
              })}
            </Link>
          </li>
        ))])}
      </ul>
    </div>
  );
}
