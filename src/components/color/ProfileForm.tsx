"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { C, Chips, Field, LevelPicker, Section } from "./ui";
import { OPT } from "@/lib/color-options";

export const PROFILE_OPT = { ...OPT, lastChem: OPT.lastChem };

export type ProfileValue = {
  naturalLevel: number | null; grayPercent: number | null; length: string | null; texture: string | null; curl: string | null; density: string | null;
  condition: string[]; scalp: string[]; chemicalHistory: string[]; lastChemical: string | null; lastChemicalProduct: string;
  allergy: string; allergyDetail: string; patchTestResult: string | null; preferredTones: string; avoidTones: string; goals: string;
  consentMarketing: boolean; hasConsent: boolean;
};

const ALLERGY = [["NONE", "ไม่เคย"], ["YES", "เคย"], ["UNSURE", "ไม่แน่ใจ"]] as const;

/**
 * Page 1 of the colour record, asked at the salon (never a customer form).
 * The first save needs the customer's own tap on the consent box — allergy
 * answers are health data under PDPA.
 */
export default function ProfileForm({ customerId, customerLabel, initial, doneHref }: {
  customerId: string; customerLabel: string; initial: ProfileValue; doneHref: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [consent, setConsent] = useState(initial.hasConsent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ProfileValue>(k: K, val: ProfileValue[K]) => setV(s => ({ ...s, [k]: val }));

  async function save() {
    if (!consent) { setErr("ให้ลูกค้ากดยินยอมก่อนบันทึก"); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/color/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, ...v, consent: true }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({})) as { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) { setErr(j?.error ?? "บันทึกไม่สำเร็จ"); return; }
    router.push(doneHref);
    router.refresh();
  }

  const input = "w-full px-3 py-2 rounded-lg text-sm outline-none bg-white";
  const box = { border: `1px solid ${C.border}`, color: C.text };

  return (
    <div className="space-y-3 pb-28">
      <Section title="ประวัติเคมี / ความเสี่ยง">
        <Field label="เคยแพ้หรือแสบจากการทำสีไหม">
          <div className="grid grid-cols-3 gap-1.5">
            {ALLERGY.map(([k, t]) => (
              <button key={k} type="button" onClick={() => set("allergy", k)} className="py-2 rounded-lg text-sm"
                style={v.allergy === k ? { background: k === "YES" ? C.red : C.primary, color: "white" } : { ...box, background: "white" }}>{t}</button>
            ))}
          </div>
        </Field>
        {v.allergy !== "NONE" && v.allergy !== "UNKNOWN" && (
          <input id="allergyDetail" className={input} style={box} value={v.allergyDetail} onChange={e => set("allergyDetail", e.target.value)} placeholder="อาการ / ผลิตภัณฑ์ที่แพ้" />
        )}
        <Field label="ทำเคมีใน 12 เดือน (เลือกได้หลายข้อ)">
          <Chips multi options={PROFILE_OPT.chemical} value={v.chemicalHistory} onChange={x => set("chemicalHistory", x as string[])} />
        </Field>
        <Field label="ทำครั้งล่าสุด">
          <Chips options={PROFILE_OPT.lastChem} value={v.lastChemical} onChange={x => set("lastChemical", x as string | null)} small />
        </Field>
        <input id="lastChemicalProduct" className={input} style={box} value={v.lastChemicalProduct} onChange={e => set("lastChemicalProduct", e.target.value)} placeholder="สี / ผลิตภัณฑ์เดิม (ถ้าทราบ)" />
        <Field label="Patch test (ทำเมื่อช่างสงสัย)">
          <div className="grid grid-cols-3 gap-1.5">
            {([[null, "ไม่ได้ทำ"], ["PASS", "ผ่าน"], ["FAIL", "ไม่ผ่าน"]] as const).map(([k, t]) => (
              <button key={t} type="button" onClick={() => set("patchTestResult", k)} className="py-2 rounded-lg text-sm"
                style={v.patchTestResult === k ? { background: k === "FAIL" ? C.red : C.primary, color: "white" } : { ...box, background: "white" }}>{t}</button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="เส้นผมก่อนทำเคมี">
        <Field label="ระดับสีพื้นผมธรรมชาติ (1–10)"><LevelPicker value={v.naturalLevel} onChange={x => set("naturalLevel", x)} /></Field>
        <Field label="ผมหงอกประมาณ (%)">
          <Chips options={["0", "10", "25", "50", "75", "100"]} value={v.grayPercent != null ? String(v.grayPercent) : null} onChange={x => set("grayPercent", x == null ? null : Number(x))} small />
        </Field>
        <Field label="ความยาว"><Chips options={PROFILE_OPT.length} value={v.length} onChange={x => set("length", x as string | null)} small /></Field>
        <Field label="ลักษณะเส้นผม">
          <div className="space-y-1.5">
            <Chips options={PROFILE_OPT.texture} value={v.texture} onChange={x => set("texture", x as string | null)} small />
            <Chips options={PROFILE_OPT.curl} value={v.curl} onChange={x => set("curl", x as string | null)} small />
          </div>
        </Field>
        <Field label="ความหนาแน่น"><Chips options={PROFILE_OPT.density} value={v.density} onChange={x => set("density", x as string | null)} small /></Field>
        <Field label="สภาพผม"><Chips multi options={PROFILE_OPT.condition} value={v.condition} onChange={x => set("condition", x as string[])} small /></Field>
        <Field label="หนังศีรษะ (ประเมินก่อนทำ)"><Chips multi options={PROFILE_OPT.scalp} value={v.scalp} onChange={x => set("scalp", x as string[])} small /></Field>
      </Section>

      <Section title="สีที่ชอบ / ข้อสังเกต">
        <input id="preferredTones" className={input} style={box} value={v.preferredTones} onChange={e => set("preferredTones", e.target.value)} placeholder="โทนที่ชอบ เช่น เบจหม่น" />
        <input id="avoidTones" className={input} style={box} value={v.avoidTones} onChange={e => set("avoidTones", e.target.value)} placeholder="โทนที่ไม่ต้องการ เช่น แดงส้ม" />
        <textarea id="goals" rows={2} className={input} style={box} value={v.goals} onChange={e => set("goals", e.target.value)} placeholder="เป้าหมายการทำสี / ประวัติสำคัญอื่นๆ" />
      </Section>

      <Section title={`ความยินยอมของลูกค้า · ${customerLabel}`}>
        {initial.hasConsent ? (
          <p className="text-sm flex items-center gap-2" style={{ color: C.green }}><Check size={16} /> ลูกค้ายินยอมแล้ว</p>
        ) : (
          <>
            <p className="text-xs" style={{ color: C.muted }}>ส่งเครื่องให้ลูกค้ากดเอง</p>
            <label className="flex items-start gap-2.5 text-sm rounded-xl p-3 cursor-pointer" style={{ background: C.bg, color: C.text }}>
              <input id="consent" type="checkbox" className="mt-1 w-4 h-4" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>ฉันยินยอมให้ err·day เก็บข้อมูลสุขภาพเส้นผม ประวัติการแพ้ และรูปก่อน–หลัง เพื่อใช้ในการให้บริการภายในร้าน</span>
            </label>
          </>
        )}
        <label className="flex items-start gap-2.5 text-sm rounded-xl p-3 cursor-pointer" style={{ background: C.bg, color: C.text }}>
          <input id="consentMarketing" type="checkbox" className="mt-1 w-4 h-4" checked={v.consentMarketing} onChange={e => set("consentMarketing", e.target.checked)} />
          <span>ยินยอมให้นำรูปไปใช้ประชาสัมพันธ์ / โซเชียลมีเดีย (ไม่บังคับ)</span>
        </label>
      </Section>

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-md mx-auto bg-white px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {err && <p className="text-xs mb-2" style={{ color: C.red }}>{err}</p>}
          <button type="button" disabled={busy || !consent} onClick={save} className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: C.primary }}>
            {busy ? "กำลังบันทึก…" : consent ? "บันทึกประวัติ" : "รอลูกค้ากดยินยอม"}
          </button>
        </div>
      </div>
    </div>
  );
}
