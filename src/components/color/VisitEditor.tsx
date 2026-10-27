"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Minus, Plus, Search, Timer, Trash2, X } from "lucide-react";
import { OPT, ZONES, ZONE_LABEL, developerGramsOf, type ColorZone } from "@/lib/color-options";
import { resizeImageFile } from "@/lib/resize-image";
import { C, Chips, Field, LevelPicker, Section } from "./ui";

export type ShadeOpt = { id: string; label: string; brand: string | null; name: string; qtyByBranch: Record<string, number> };
export type EditableVisit = {
  id: string; status: string; serviceTypes: string[]; rootLevel: number | null; midEndsLevel: number | null; targetLevel: number | null;
  grayPercent: number | null; preChecks: string[]; patchTestNeeded: boolean; zones: ColorZone[]; otherProducts: string | null;
  result: string | null; scalpAfter: string | null; referencePhotos: string[]; beforePhotos: string[]; afterPhotos: string[]; nextTimeNotes: string | null;
};

const RESULTS = [["ON_TARGET", "ตรงตามเป้าหมาย"], ["DARKER", "เข้มกว่า"], ["LIGHTER", "อ่อนกว่า"], ["NEEDS_FIX", "ต้องปรับแก้"]] as const;
const MINUTES = [10, 15, 20, 25, 30, 35, 40, 45];
const emptyZone = (zone: ColorZone["zone"]): ColorZone => ({ zone, shades: [], developerPercent: null, ratio: null, minutes: null, startedAt: null, rinsedAt: null });

/** Live "time left" for a zone that is processing. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [active]);
  return now;
}

export default function VisitEditor({ customerId, branchId, initial, shades, backHref, canPhoto }: {
  customerId: string; branchId: string; initial: EditableVisit; shades: ShadeOpt[]; backHref: string; canPhoto: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<EditableVisit>(initial);
  const [zoneTab, setZoneTab] = useState<ColorZone["zone"]>(initial.zones[0]?.zone ?? "ROOT");
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const set = <K extends keyof EditableVisit>(k: K, val: EditableVisit[K]) => { setV(s => ({ ...s, [k]: val })); setDirty(true); };

  const zone = v.zones.find(z => z.zone === zoneTab) ?? emptyZone(zoneTab);
  const putZone = (z: ColorZone) => {
    const others = v.zones.filter(x => x.zone !== z.zone);
    const keep = z.shades.length || z.developerPercent || z.ratio || z.minutes || z.startedAt;
    set("zones", ZONES.flatMap(k => (k === z.zone ? (keep ? [z] : []) : others.filter(x => x.zone === k))));
  };
  const running = v.zones.some(z => z.startedAt && !z.rinsedAt);
  const now = useNow(running);

  const totals = useMemo(() => ({
    color: v.zones.reduce((s, z) => s + z.shades.reduce((t, x) => t + x.grams, 0), 0),
    dev: v.zones.reduce((s, z) => s + developerGramsOf(z), 0),
  }), [v.zones]);

  async function save(extra: Record<string, unknown> = {}, next?: EditableVisit) {
    const body = next ?? v;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/color/visit/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...extra }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { const j = await res?.json().catch(() => ({})) as { error?: string } | undefined; setMsg({ t: j?.error ?? "บันทึกไม่สำเร็จ ลองอีกครั้ง", bad: true }); return false; }
    setDirty(false); setMsg({ t: extra.finish ? "บันทึกเสร็จงานแล้ว" : "บันทึกแล้ว" });
    return true;
  }

  // Timer start/stop saves straight away so another device sees the clock too.
  async function timer(action: "start" | "rinse") {
    const z = { ...zone, [action === "start" ? "startedAt" : "rinsedAt"]: new Date().toISOString(), ...(action === "start" ? { rinsedAt: null } : {}) };
    const zones = ZONES.flatMap(k => (k === z.zone ? [z] : v.zones.filter(x => x.zone === k)));
    const next = { ...v, zones };
    setV(next);
    await save({}, next);
  }

  async function upload(kind: "referencePhotos" | "beforePhotos" | "afterPhotos", files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      const small = await resizeImageFile(f);
      const fd = new FormData(); fd.append("file", small);
      const res = await fetch(`/api/color/photo?customerId=${customerId}`, { method: "POST", body: fd }).catch(() => null);
      const j = await res?.json().catch(() => ({})) as { url?: string; error?: string } | undefined;
      if (!res?.ok || !j?.url) { setMsg({ t: j?.error ?? "อัปโหลดรูปไม่สำเร็จ", bad: true }); break; }
      urls.push(j.url);
    }
    setBusy(false);
    if (urls.length) { const next = { ...v, [kind]: [...v[kind], ...urls] }; setV(next); await save({}, next); }
  }

  async function remove() {
    if (!window.confirm("ลบบันทึกสีครั้งนี้?")) return;
    const res = await fetch(`/api/color/visit/${v.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) { router.push(backHref); router.refresh(); }
  }

  const filtered = shades.filter(s => !q.trim() || s.label.toLowerCase().includes(q.trim().toLowerCase()));
  const addShade = (s: { id: string | null; label: string }) => {
    putZone({ ...zone, shades: [...zone.shades, { productId: s.id, label: s.label, grams: 20 }] });
    setPicker(false); setQ("");
  };
  const box = { border: `1px solid ${C.border}`, color: C.text };
  const input = "w-full px-3 py-2 rounded-lg text-sm outline-none bg-white";

  const photos = (kind: "referencePhotos" | "beforePhotos" | "afterPhotos", title: string) => (
    <Field label={title}>
      <div className="flex flex-wrap gap-2">
        {v[kind].map(u => (
          <div key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-20 h-20 rounded-xl object-cover" />
            <button type="button" onClick={() => set(kind, v[kind].filter(x => x !== u))} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow" aria-label="ลบรูป"><X size={12} /></button>
          </div>
        ))}
        {canPhoto && (
          <label className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] cursor-pointer" style={{ border: `1.5px dashed ${C.border}`, color: C.muted }}>
            <Camera size={18} /> เพิ่มรูป
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => { upload(kind, e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </Field>
  );

  return (
    <div className="space-y-3 pb-32">
      <Section title="ประเภทบริการ">
        <Chips multi options={OPT.service} value={v.serviceTypes} onChange={x => set("serviceTypes", x as string[])} small />
      </Section>

      <Section title="สภาพผมและเป้าหมายก่อนทำ">
        <Field label="ระดับสีโคนเดิม"><LevelPicker max={12} value={v.rootLevel} onChange={x => set("rootLevel", x)} /></Field>
        <Field label="ระดับสีช่วงกลาง–ปลาย"><LevelPicker max={12} value={v.midEndsLevel} onChange={x => set("midEndsLevel", x)} /></Field>
        <Field label="ระดับสีเป้าหมาย"><LevelPicker max={12} value={v.targetLevel} onChange={x => set("targetLevel", x)} /></Field>
        <Field label="ผมหงอก (%)">
          <Chips options={["0", "10", "25", "50", "75", "100"]} value={v.grayPercent != null ? String(v.grayPercent) : null} onChange={x => set("grayPercent", x == null ? null : Number(x))} small />
        </Field>
        <Field label="เช็คก่อนทำ"><Chips multi options={OPT.preCheck} value={v.preChecks} onChange={x => set("preChecks", x as string[])} small /></Field>
        <label className="flex items-center gap-2 text-sm" style={{ color: C.text }}>
          <input type="checkbox" className="w-4 h-4" checked={v.patchTestNeeded} onChange={e => set("patchTestNeeded", e.target.checked)} />
          ช่างสงสัย — ต้องทำ patch test (บันทึกผลในประวัติลูกค้า)
        </label>
        {photos("referencePhotos", "สี / รูปอ้างอิงลูกค้า")}
      </Section>

      <Section title="สูตรที่ผสมจริง">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl" style={{ background: C.border }}>
          {ZONES.map(k => {
            const has = v.zones.some(z => z.zone === k && z.shades.length);
            return (
              <button key={k} type="button" onClick={() => setZoneTab(k)} className="py-1.5 rounded-lg text-xs relative"
                style={zoneTab === k ? { background: "white", color: C.primary, fontWeight: 600 } : { color: C.muted }}>
                {ZONE_LABEL[k].replace("อื่นๆ / ", "")}
                {has && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: C.primary }} />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {zone.shades.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.bg }}>
              <span className="flex-1 text-sm" style={{ color: C.text }}>{s.label}</span>
              <button type="button" onClick={() => putZone({ ...zone, shades: zone.shades.map((x, j) => (j === i ? { ...x, grams: Math.max(0, x.grams - 5) } : x)) })} className="w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} aria-label="ลด 5 กรัม"><Minus size={14} /></button>
              <input inputMode="numeric" value={s.grams} onChange={e => putZone({ ...zone, shades: zone.shades.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)) })}
                className="w-12 text-center py-1 rounded-lg text-sm bg-white outline-none tabular-nums" style={{ border: `1px solid ${C.border}` }} aria-label="กรัม" />
              <span className="text-xs" style={{ color: C.muted }}>g</span>
              <button type="button" onClick={() => putZone({ ...zone, shades: zone.shades.map((x, j) => (j === i ? { ...x, grams: x.grams + 5 } : x)) })} className="w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} aria-label="เพิ่ม 5 กรัม"><Plus size={14} /></button>
              <button type="button" onClick={() => putZone({ ...zone, shades: zone.shades.filter((_, j) => j !== i) })} className="p-1" style={{ color: C.muted }} aria-label="เอาออก"><X size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setPicker(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1.5px dashed ${C.primary}`, color: C.primary }}>
            <Plus size={15} /> เพิ่มเบอร์สี ({ZONE_LABEL[zoneTab]})
          </button>
        </div>

        <Field label="ไฮ / Developer"><Chips options={OPT.developer} value={zone.developerPercent} onChange={x => putZone({ ...zone, developerPercent: x as string | null })} small /></Field>
        <Field label="อัตราผสม (สี : ไฮ)"><Chips options={OPT.ratio} value={zone.ratio} onChange={x => putZone({ ...zone, ratio: x as string | null })} small /></Field>
        {developerGramsOf(zone) > 0 && <p className="text-xs" style={{ color: C.muted }}>ไฮที่ต้องใช้โซนนี้ ≈ <b style={{ color: C.text }}>{developerGramsOf(zone)}g</b></p>}
        <Field label="เวลาทิ้งสี (นาที)">
          <Chips options={MINUTES.map(String)} value={zone.minutes != null ? String(zone.minutes) : null} onChange={x => putZone({ ...zone, minutes: x == null ? null : Number(x) })} small />
        </Field>

        {zone.shades.length > 0 && (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: C.text, color: "white" }}>
            <Timer size={18} />
            {zone.startedAt && !zone.rinsedAt ? (() => {
              const left = (zone.minutes ?? 0) * 60 - Math.floor((now - Date.parse(zone.startedAt)) / 1000);
              const abs = Math.abs(left);
              return (
                <>
                  <div className="flex-1">
                    <p className="text-[11px] opacity-70">เริ่ม {new Date(zone.startedAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}{zone.minutes ? ` · ${zone.minutes} นาที` : ""}</p>
                    <p className="text-xl font-semibold tabular-nums" style={{ color: left < 0 ? "#FCA5A5" : "white" }}>{left < 0 ? "เกิน " : ""}{String(Math.floor(abs / 60)).padStart(2, "0")}:{String(abs % 60).padStart(2, "0")}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => timer("rinse")} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "white", color: C.text }}>ล้างแล้ว</button>
                </>
              );
            })() : (
              <>
                <p className="flex-1 text-sm">
                  {zone.rinsedAt && zone.startedAt
                    ? `ทิ้งไว้ ${Math.round((Date.parse(zone.rinsedAt) - Date.parse(zone.startedAt)) / 60000)} นาที · ล้าง ${new Date(zone.rinsedAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}`
                    : "จับเวลาทิ้งสีโซนนี้"}
                </p>
                <button type="button" disabled={busy} onClick={() => timer("start")} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "white", color: C.text }}>
                  {zone.rinsedAt ? "เริ่มใหม่" : "เริ่ม"}
                </button>
              </>
            )}
          </div>
        )}

        <input id="otherProducts" className={input} style={box} value={v.otherProducts ?? ""} onChange={e => set("otherProducts", e.target.value)} placeholder="แบรนด์ / ไลน์สีอื่น · ฟอก / อื่นๆ (ชื่อผลิตภัณฑ์)" />
        <div className="flex gap-4 text-xs" style={{ color: C.muted }}>
          <span>สีรวม <b style={{ color: C.text }}>{totals.color}g</b></span>
          <span>ไฮรวม <b style={{ color: C.text }}>{totals.dev}g</b></span>
        </div>
      </Section>

      <Section title="ผลการทำ">
        {photos("beforePhotos", "รูปก่อนทำ")}
        {photos("afterPhotos", "รูปหลังทำ")}
        {!canPhoto && <p className="text-xs" style={{ color: C.amber }}>ลูกค้ายังไม่ได้ยินยอมให้เก็บรูป</p>}
        <Field label="ผลลัพธ์หลังทำ">
          <div className="grid grid-cols-2 gap-1.5">
            {RESULTS.map(([k, t]) => (
              <button key={k} type="button" onClick={() => set("result", v.result === k ? null : k)} className="py-2 rounded-lg text-sm"
                style={v.result === k ? { background: k === "NEEDS_FIX" ? C.red : C.primary, color: "white" } : { ...box, background: "white" }}>{t}</button>
            ))}
          </div>
        </Field>
        <Field label="สภาพเส้นผม / หนังศีรษะหลังทำ"><Chips options={OPT.scalpAfter} value={v.scalpAfter} onChange={x => set("scalpAfter", x as string | null)} small /></Field>
        <textarea id="nextTimeNotes" rows={3} className={input} style={box} value={v.nextTimeNotes ?? ""} onChange={e => set("nextTimeNotes", e.target.value)}
          placeholder="สิ่งที่ต้องจำสำหรับครั้งหน้า / สูตรที่ควรปรับ / การดูแลที่แนะนำ" />
      </Section>

      {v.status === "DRAFT" && (
        <button type="button" onClick={remove} className="w-full py-2 text-sm flex items-center justify-center gap-1.5" style={{ color: C.red }}><Trash2 size={14} /> ลบบันทึกนี้</button>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-md mx-auto bg-white px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
          {msg && <p className="text-xs" style={{ color: msg.bad ? C.red : C.green }}>{msg.t}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => save()} className="flex-1 py-3 rounded-xl font-semibold disabled:opacity-50"
              style={{ border: `1px solid ${C.primary}`, color: C.primary }}>{busy ? "กำลังบันทึก…" : dirty ? "บันทึก" : "บันทึกแล้ว"}</button>
            <button type="button" disabled={busy} onClick={async () => { if (await save({ finish: true })) { router.push(backHref); router.refresh(); } }}
              className="flex-1 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: C.primary }}>
              <Check size={16} /> {v.status === "DONE" ? "บันทึกการแก้ไข" : "เสร็จงาน"}
            </button>
          </div>
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => setPicker(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-6 max-h-[80vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <p className="font-semibold flex-1" style={{ color: C.text }}>เลือกเบอร์สี · {ZONE_LABEL[zoneTab]}</p>
              <button type="button" onClick={() => setPicker(false)} className="p-1" style={{ color: C.muted }} aria-label="ปิด"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: `1px solid ${C.border}` }}>
              <Search size={15} style={{ color: C.muted }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์เบอร์ เช่น 7-pGG, C4" className="flex-1 text-sm outline-none bg-transparent" />
            </div>
            <div className="overflow-y-auto -mx-1 px-1 space-y-1">
              {filtered.map(s => {
                const qty = s.qtyByBranch[branchId] ?? 0;
                return (
                  <button key={s.id} type="button" onClick={() => addShade({ id: s.id, label: s.label })} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left" style={{ background: C.bg }}>
                    <span className="flex-1 text-sm" style={{ color: C.text }}>{s.label}</span>
                    <span className="text-xs" style={{ color: qty > 0 ? C.green : C.muted }}>{qty > 0 ? `สาขานี้มี ${qty}` : "สาขานี้ไม่มี"}</span>
                  </button>
                );
              })}
              {q.trim() && (
                <button type="button" onClick={() => addShade({ id: null, label: q.trim() })} className="w-full px-3 py-2.5 rounded-xl text-left text-sm" style={{ border: `1px dashed ${C.border}`, color: C.primary }}>
                  + ใช้ “{q.trim()}” (ไม่มีในสต็อก)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
