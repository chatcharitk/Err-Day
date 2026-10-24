"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/lib/stock";
import { STOCK_CATEGORIES } from "@/lib/stock-categories";
import { BORDER, MUTED, PRIMARY, TEXT, LOW } from "./theme";

const UNITS = ["หลอด", "ขวด", "กระปุก", "ชิ้น", "ซอง", "ถุง", "กล่อง"];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-1" style={{ color: MUTED }}>{children}</p>;
}

/** One line per product, optional "= จำนวน" to record the count at a place in the same step. */
function parse(text: string) {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*=\s*(\d+)\s*$/);
    return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: l, qty: null as number | null };
  }).filter(i => i.name);
}

export default function BulkAddForm({ locations, categories, defaultCategory, base = "/admin/m/stock" }: { locations: Location[]; categories: string[]; defaultCategory: string; base?: string }) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState("หลอด");
  const [usage, setUsage] = useState("USE");
  const [text, setText] = useState("");
  const [location, setLocation] = useState(locations[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const items = parse(text);
  const withQty = items.filter(i => i.qty != null).length;
  const allCats = [...STOCK_CATEGORIES, ...categories.filter(c => !(STOCK_CATEGORIES as readonly string[]).includes(c))];
  const box = { border: `1px solid ${BORDER}`, color: TEXT };
  const chip = (on: boolean) => on ? { background: PRIMARY, color: "white" } : box;

  async function save() {
    if (!items.length) { setErr("ยังไม่ได้ใส่ชื่อสินค้า"); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/stock/products/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, brand, size, unit, usage, items, location: withQty ? location : null }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({})) as { error?: string; created?: number; reused?: number; counted?: number } | undefined;
    setBusy(false);
    if (!res?.ok) { setErr(j?.error || "บันทึกไม่สำเร็จ"); return; }
    alert(`เพิ่มใหม่ ${j?.created ?? 0} รายการ${j?.reused ? ` · มีอยู่แล้ว ${j.reused}` : ""}${j?.counted ? ` · บันทึกจำนวน ${j.counted} รายการ` : ""}`);
    router.push(withQty ? `${base}?loc=${location}` : base);
    router.refresh();
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-xs" style={{ color: MUTED }}>สำหรับของที่มีหลายรายการเหมือนกัน เช่น สีย้อมผมแต่ละเบอร์ — ตั้งค่าร่วมด้านบน แล้วพิมพ์ชื่อบรรทัดละ 1 รายการ</p>
      <div>
        <Label>หมวด</Label>
        <div className="flex flex-wrap gap-2">
          {allCats.map(c => <button key={c} type="button" onClick={() => setCategory(c)} className="px-3 py-1.5 rounded-full text-sm" style={chip(category === c)}>{c}</button>)}
          <input className="px-3 py-1.5 rounded-full text-sm w-32 outline-none" style={box} placeholder="+ หมวดใหม่"
            value={allCats.includes(category) ? "" : category} onChange={e => setCategory(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>แบรนด์</Label><input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={box} value={brand} onChange={e => setBrand(e.target.value)} placeholder="NIGAO" /></div>
        <div><Label>ขนาด</Label><input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={box} value={size} onChange={e => setSize(e.target.value)} placeholder="100 ml" /></div>
      </div>
      <div>
        <Label>นับเป็นหน่วย</Label>
        <div className="flex flex-wrap gap-2">
          {UNITS.map(u => <button key={u} type="button" onClick={() => setUnit(u)} className="px-3 py-1.5 rounded-full text-sm" style={chip(unit === u)}>{u}</button>)}
        </div>
      </div>
      <div>
        <Label>ใช้ทำอะไร</Label>
        <div className="grid grid-cols-3 gap-2">
          {([["USE", "ใช้ในร้าน"], ["SALE", "ขายลูกค้า"], ["BOTH", "ใช้ + ขาย"]] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setUsage(k)} className="py-2 rounded-lg text-sm" style={chip(usage === k)}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <Label>ชื่อสินค้า บรรทัดละ 1 รายการ · ใส่ “= จำนวน” ต่อท้ายถ้าต้องการบันทึกจำนวนด้วย</Label>
        <textarea rows={9} className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={box} value={text} onChange={e => setText(e.target.value)}
          placeholder={"7/0 = 3\n7/1 = 2\n8/0\n9/12 = 4"} />
        <p className="text-[11px] mt-1" style={{ color: MUTED }}>{items.length} รายการ{withQty ? ` · มีจำนวน ${withQty} รายการ` : ""}</p>
      </div>
      {withQty > 0 && (
        <div>
          <Label>จำนวนที่ใส่ เป็นของที่</Label>
          <div className="flex flex-wrap gap-2">
            {locations.map(l => <button key={l.id} type="button" onClick={() => setLocation(l.id)} className="px-3 py-1.5 rounded-full text-sm" style={chip(location === l.id)}>{l.short}</button>)}
          </div>
        </div>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4">
        <div className="bg-white px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          {err && <p className="text-xs mb-2" style={{ color: LOW }}>{err}</p>}
          <button type="button" disabled={busy || !items.length} onClick={save} className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-40" style={{ background: PRIMARY }}>
            {busy ? "กำลังบันทึก…" : `เพิ่ม ${items.length} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
}
