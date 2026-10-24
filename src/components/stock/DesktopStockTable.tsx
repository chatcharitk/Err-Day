"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Location, StockRow } from "@/lib/stock";
import { groupByCategory, NO_CATEGORY } from "@/lib/stock-categories";
import CategoryChips from "./CategoryChips";
import { BORDER, MUTED, PRIMARY, TEXT, LOW, LOW_BG, label } from "./theme";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/** Desktop: every product × place, with totals and stock value at cost. */
export default function DesktopStockTable({ locations, rows, base }: { locations: Location[]; rows: StockRow[]; base: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const isLow = (r: StockRow, l: string) => { const v = r.levels[l]; return !!v && ((v.min > 0 && v.qty <= v.min) || v.qty < 0); };
  const anyLow = (r: StockRow) => locations.some(l => isLow(r, l.id));
  const total = (r: StockRow) => locations.reduce((s, l) => s + (r.levels[l.id]?.qty ?? 0), 0);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => (!s || label(r).toLowerCase().includes(s))
      && (!cat || (r.category?.trim() || NO_CATEGORY) === cat) && (!lowOnly || anyLow(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rows, cat, lowOnly]);
  const groups = groupByCategory(shown);
  const value = shown.reduce((s, r) => s + (r.costSatang ?? 0) * Math.max(0, total(r)), 0);
  const lowCount = rows.filter(anyLow).length;
  const th = "px-3 py-2 text-xs font-medium text-right whitespace-nowrap";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-72" style={{ border: `1px solid ${BORDER}` }}>
          <Search size={15} style={{ color: MUTED }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า / แบรนด์ / เบอร์สี" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        {lowCount > 0 && (
          <button type="button" onClick={() => setLowOnly(v => !v)} className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: lowOnly ? LOW : LOW_BG, color: lowOnly ? "white" : LOW }}>ใกล้หมด {lowCount} รายการ</button>
        )}
        <span className="ml-auto text-sm" style={{ color: MUTED }}>
          {shown.length} รายการ{value > 0 ? <> · มูลค่าตามทุน <b style={{ color: TEXT }}>{baht(value)}</b></> : null}
        </span>
        <div className="w-full"><CategoryChips rows={rows} value={cat} onChange={setCat} /></div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm" style={{ color: MUTED }}>ยังไม่มีสินค้า — กด “เพิ่มสินค้า” เพื่อเริ่ม</p>
      ) : (
        <table className="w-full text-sm">
          <thead style={{ color: MUTED, background: "#FDF8F3" }}>
            <tr>
              <th className="px-4 py-2 text-xs font-medium text-left">สินค้า</th>
              <th className="px-3 py-2 text-xs font-medium text-left">หน่วย</th>
              {locations.map(l => <th key={l.id} className={th}>{l.short}</th>)}
              <th className={th}>รวม</th>
              <th className={th}>ทุน/หน่วย</th>
              <th className={`${th} pr-4`}>มูลค่า</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => [
              <tr key={`h-${g.category}`}><td colSpan={locations.length + 5} className="px-4 pt-4 pb-1 text-xs font-semibold" style={{ color: PRIMARY }}>{g.category} <span style={{ color: MUTED, fontWeight: 400 }}>({g.rows.length})</span></td></tr>,
              ...g.rows.map(r => {
                const t = total(r);
                return (
                  <tr key={r.id} className="hover:bg-[#FDF8F3]" style={{ borderTop: `1px solid ${BORDER}`, opacity: r.isActive ? 1 : 0.5 }}>
                    <td className="px-4 py-2"><Link href={`${base}/products/${r.id}`} className="hover:underline" style={{ color: TEXT }}>{label(r)}</Link></td>
                    <td className="px-3 py-2" style={{ color: MUTED }}>{r.unit}</td>
                    {locations.map(l => {
                      const low = isLow(r, l.id);
                      return (
                        <td key={l.id} className="px-3 py-2 text-right tabular-nums">
                          <span className="px-1.5 py-0.5 rounded" style={{ color: low ? LOW : (r.levels[l.id]?.qty ?? 0) ? TEXT : MUTED, background: low ? LOW_BG : "transparent", fontWeight: low ? 600 : 400 }}>
                            {r.levels[l.id]?.qty ?? 0}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: TEXT }}>{t}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: MUTED }}>{r.costSatang != null ? baht(r.costSatang) : "–"}</td>
                    <td className="px-3 py-2 pr-4 text-right tabular-nums" style={{ color: TEXT }}>{r.costSatang != null && t > 0 ? baht(r.costSatang * t) : "–"}</td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      )}
    </div>
  );
}
