"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BORDER, MUTED, PRIMARY, TEXT, LOW } from "./theme";
import { STOCK_CATEGORIES } from "@/lib/stock-categories";

export type ProductFormValue = {
  id?: string; name: string; brand: string; size: string; unit: string; packUnit: string; packSize: string;
  category: string; costBaht: string; usage: string; serviceId: string; minQty: string; notes: string; isActive: boolean;
};

const UNITS = ["ขวด", "หลอด", "กระปุก", "ชิ้น", "ซอง", "กล่อง", "แพ็ค"];
const USAGES = [["USE", "ใช้ในร้าน"], ["SALE", "ขายลูกค้า"], ["BOTH", "ใช้ + ขาย"]] as const;

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-1" style={{ color: MUTED }}>{children}</p>;
}

/** Add / edit a product. Only the name is required. */
export default function ProductForm({ initial, retailOptions, doneHref, categories = [] }: {
  /** Custom categories already used by other products. */
  categories?: string[];
  initial: ProductFormValue;
  /** Retail POS items (หมวด สินค้า) this product can be linked to. */
  retailOptions: { id: string; name: string }[];
  doneHref: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV(s => ({ ...s, [k]: val }));
  const sells = v.usage !== "USE";

  async function save() {
    if (!v.name.trim()) { setErr("กรุณาใส่ชื่อสินค้า"); return; }
    setBusy(true); setErr(null);
    const body = { ...v, serviceId: sells ? v.serviceId : "", packSize: v.packUnit.trim() ? v.packSize || "1" : "1" };
    const res = await fetch(v.id ? `/api/admin/stock/products/${v.id}` : "/api/admin/stock/products", {
      method: v.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const j = await res?.json().catch(() => ({})) as { error?: string; product?: { id: string } } | undefined;
    if (!res?.ok) { setErr(j?.error || "บันทึกไม่สำเร็จ"); return; }
    router.push(doneHref.replace("{id}", j?.product?.id ?? ""));
    router.refresh();
  }

  const field = "w-full px-3 py-2 rounded-lg text-sm outline-none bg-white";
  const box = { border: `1px solid ${BORDER}`, color: TEXT };

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <Label>ชื่อสินค้า *</Label>
        <input className={field} style={box} value={v.name} onChange={e => set("name", e.target.value)} placeholder="เช่น แชมพู Love Smoothing" />
      </div>
      <div>
        <Label>หมวด</Label>
        <div className="flex flex-wrap gap-2">
          {[...STOCK_CATEGORIES, ...categories.filter(c => !(STOCK_CATEGORIES as readonly string[]).includes(c))].map(c => (
            <button key={c} type="button" onClick={() => set("category", v.category === c ? "" : c)} className="px-3 py-1.5 rounded-full text-sm"
              style={v.category === c ? { background: PRIMARY, color: "white" } : box}>{c}</button>
          ))}
          <input className="px-3 py-1.5 rounded-full text-sm w-32 outline-none" style={box} placeholder="+ หมวดใหม่"
            value={[...STOCK_CATEGORIES, ...categories].includes(v.category) ? "" : v.category}
            onChange={e => set("category", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>แบรนด์</Label><input className={field} style={box} value={v.brand} onChange={e => set("brand", e.target.value)} placeholder="Davines" /></div>
        <div><Label>ขนาด</Label><input className={field} style={box} value={v.size} onChange={e => set("size", e.target.value)} placeholder="250 ml" /></div>
      </div>
      <div>
        <Label>นับเป็นหน่วย</Label>
        <div className="flex flex-wrap gap-2">
          {UNITS.map(u => (
            <button key={u} type="button" onClick={() => set("unit", u)} className="px-3 py-1.5 rounded-full text-sm"
              style={v.unit === u ? { background: PRIMARY, color: "white" } : box}>{u}</button>
          ))}
          {!UNITS.includes(v.unit) && <input className="px-3 py-1.5 rounded-full text-sm w-24 outline-none" style={box} value={v.unit} onChange={e => set("unit", e.target.value)} />}
        </div>
      </div>
      <div>
        <Label>ซื้อเป็นแพ็ค? (ไม่บังคับ) เช่น 1 กล่อง = 12 {v.unit}</Label>
        <div className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
          1 <input className="px-3 py-2 rounded-lg w-24 outline-none" style={box} value={v.packUnit} onChange={e => set("packUnit", e.target.value)} placeholder="กล่อง" />
          = <input inputMode="numeric" className="px-3 py-2 rounded-lg w-16 outline-none text-center" style={box} value={v.packSize} onChange={e => set("packSize", e.target.value.replace(/[^0-9]/g, ""))} placeholder="12" />
          {v.unit}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ราคาทุน / {v.unit} (บาท)</Label><input inputMode="decimal" className={field} style={box} value={v.costBaht} onChange={e => set("costBaht", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" /></div>
        <div><Label>แจ้งเตือนเมื่อเหลือ ≤ (ต่อสาขา)</Label><input inputMode="numeric" className={field} style={box} value={v.minQty} onChange={e => set("minQty", e.target.value.replace(/[^0-9]/g, ""))} placeholder="0 = ไม่เตือน" /></div>
      </div>
      <div>
        <Label>ใช้ทำอะไร</Label>
        <div className="grid grid-cols-3 gap-2">
          {USAGES.map(([k, t]) => (
            <button key={k} type="button" onClick={() => set("usage", k)} className="py-2 rounded-lg text-sm"
              style={v.usage === k ? { background: PRIMARY, color: "white" } : box}>{t}</button>
          ))}
        </div>
      </div>
      {sells && (
        <div>
          <Label>สินค้าขายที่ POS (ขายแล้วตัดสต็อกอัตโนมัติ)</Label>
          <select className={field} style={box} value={v.serviceId} onChange={e => set("serviceId", e.target.value)}>
            <option value="">— ยังไม่ผูก —</option>
            {retailOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <p className="text-[11px] mt-1" style={{ color: MUTED }}>ถ้ายังไม่มีในรายการ ให้เพิ่มที่ บริการ → หมวด “สินค้า” ก่อน (ตั้งราคาขายต่อสาขาที่นั่น)</p>
        </div>
      )}
      <div><Label>หมายเหตุ</Label><input className={field} style={box} value={v.notes} onChange={e => set("notes", e.target.value)} placeholder="เช่น ซื้อจาก…" /></div>
      {v.id && (
        <label className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
          <input type="checkbox" checked={v.isActive} onChange={e => set("isActive", e.target.checked)} /> ยังใช้อยู่ (ปิดเพื่อซ่อนจากรายการ)
        </label>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 -mb-4">
        <div className="bg-white px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          {err && <p className="text-xs mb-2" style={{ color: LOW }}>{err}</p>}
          <button type="button" disabled={busy} onClick={save} className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
