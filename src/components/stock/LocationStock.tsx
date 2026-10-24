"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Minus, Plus } from "lucide-react";
import type { StockRow } from "@/lib/stock";
import { BORDER, MUTED, PRIMARY, TEXT, LOW, LOW_BG, label, postStock } from "./theme";

/**
 * Stock at one place, with the quick "เบิกของ" sheet: tap a product → choose
 * how many → เบิกใช้ (opened for service) or เสีย/หมดอายุ (with a reason).
 */
export default function LocationStock({ location, rows }: { location: string; rows: StockRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [pick, setPick] = useState<StockRow | null>(null);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"use" | "damage">("use");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isLow = (r: StockRow) => { const l = r.levels[location]; return !!l && l.min > 0 && l.qty <= l.min; };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => (!s || label(r).toLowerCase().includes(s)) && (!lowOnly || isLow(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rows, lowOnly, location]);
  const lowCount = rows.filter(isLow).length;

  function open(r: StockRow) { setPick(r); setQty(1); setMode("use"); setNote(""); setErr(null); }

  async function submit() {
    if (!pick) return;
    if (mode === "damage" && !note.trim()) { setErr("กรุณาใส่เหตุผล"); return; }
    setBusy(true); setErr(null);
    const r = await postStock({ action: mode, location, productId: pick.id, qty, note: note || undefined });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setToast(`${mode === "use" ? "เบิก" : "บันทึกของเสีย"} ${label(pick)} ${qty} ${pick.unit} แล้ว`);
    setPick(null);
    router.refresh();
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div>
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
          <Search size={15} style={{ color: MUTED }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้าเพื่อเบิก" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        {lowCount > 0 && (
          <button type="button" onClick={() => setLowOnly(v => !v)} className="text-xs px-3 py-1 rounded-full"
            style={{ background: lowOnly ? LOW : LOW_BG, color: lowOnly ? "white" : LOW }}>
            ใกล้หมด {lowCount} รายการ
          </button>
        )}
      </div>

      {rows.length === 0 && <p className="px-4 py-8 text-center text-sm" style={{ color: MUTED }}>ยังไม่มีสินค้าในระบบ</p>}

      <ul className="bg-white">
        {shown.map(r => {
          const l = r.levels[location];
          const low = isLow(r);
          return (
            <li key={r.id}>
              <button type="button" onClick={() => open(r)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="flex-1 text-sm leading-snug" style={{ color: TEXT }}>{label(r)}</span>
                <span className="text-sm font-semibold px-2 py-0.5 rounded-md" style={{ color: low || (l?.qty ?? 0) < 0 ? LOW : TEXT, background: low ? LOW_BG : "transparent" }}>
                  {l?.qty ?? 0}
                </span>
                <span className="text-xs w-9" style={{ color: MUTED }}>{r.unit}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {toast && (
        <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center px-4">
          <p className="text-sm text-white px-4 py-2 rounded-full shadow" style={{ background: "#166534" }}>{toast}</p>
        </div>
      )}

      {pick && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => !busy && setPick(null)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="font-medium" style={{ color: TEXT }}>{label(pick)}</p>
                <p className="text-xs" style={{ color: MUTED }}>เหลือ {pick.levels[location]?.qty ?? 0} {pick.unit}</p>
              </div>
              <button type="button" onClick={() => setPick(null)} className="p-1" style={{ color: MUTED }} aria-label="ปิด"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {(["use", "damage"] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)} className="py-2 rounded-lg text-sm"
                  style={{ border: `1px solid ${mode === m ? PRIMARY : BORDER}`, color: mode === m ? PRIMARY : TEXT, background: mode === m ? "#FFF7F5" : "white" }}>
                  {m === "use" ? "เบิกใช้" : "เสีย / หมดอายุ"}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-5 mt-5">
              <button type="button" onClick={() => setQty(n => Math.max(1, n - 1))} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}` }} aria-label="ลด"><Minus size={18} /></button>
              <p className="text-3xl font-semibold w-16 text-center" style={{ color: TEXT }}>{qty}</p>
              <button type="button" onClick={() => setQty(n => Math.min(99, n + 1))} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: `1px solid ${BORDER}` }} aria-label="เพิ่ม"><Plus size={18} /></button>
            </div>
            <p className="text-center text-xs mt-1" style={{ color: MUTED }}>{pick.unit}</p>

            <input value={note} onChange={e => setNote(e.target.value)} placeholder={mode === "damage" ? "เหตุผล (จำเป็น) เช่น ขวดแตก, หมดอายุ" : "หมายเหตุ (ไม่บังคับ)"}
              className="w-full mt-4 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${BORDER}` }} />
            {err && <p className="text-xs mt-2" style={{ color: LOW }}>{err}</p>}
            <button type="button" disabled={busy} onClick={submit} className="w-full mt-4 py-3 rounded-xl text-white font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
              {busy ? "กำลังบันทึก…" : mode === "use" ? `เบิก ${qty} ${pick.unit}` : `บันทึกของเสีย ${qty} ${pick.unit}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
