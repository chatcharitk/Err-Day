"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Plus, Printer, ShieldAlert } from "lucide-react";
import { C, fmtThaiDate } from "./ui";

type Zone = { zone: string; shades: { label: string; grams: number }[]; developerPercent: string | null; ratio: string | null; minutes: number | null };
export type CardVisit = {
  id: string; date: string; branchName: string; stylistName: string; visitNo: number; status: string; bookingId: string | null;
  serviceTypes: string[]; targetLevel: number | null; result: string | null; nextTimeNotes: string | null;
  zones: Zone[]; beforePhotos: string[]; afterPhotos: string[];
};
export type CardProfile = { allergy: string; allergyDetail: string | null; consentAt: string | null } | null;

const ZONE: Record<string, string> = { ALL: "ทั้งหัว", ROOT: "โคน", MID: "ช่วงกลาง", ENDS: "ปลาย", TONER: "โทนเนอร์" };
const RESULT: Record<string, { t: string; c: string; bg: string }> = {
  ON_TARGET: { t: "ตรงเป้า", c: C.green, bg: C.greenBg }, DARKER: { t: "เข้มกว่า", c: C.amber, bg: C.amberBg },
  LIGHTER: { t: "อ่อนกว่า", c: C.amber, bg: C.amberBg }, NEEDS_FIX: { t: "ต้องแก้", c: C.red, bg: C.redBg },
};

export function zoneLine(z: Zone) {
  const shades = z.shades.map(s => `${s.label.replace(/^(Ordeve|NIGAO)\s+/i, "")} ${s.grams}g`).join(" + ");
  return [shades || "—", [z.developerPercent, z.ratio].filter(Boolean).join(" "), z.minutes ? `${z.minutes}′` : ""].filter(Boolean).join(" · ");
}

/** One-line caution (allergy / sensitivity) — the only thing kept per customer besides photo consent. */
function Caution({ customerId, profile }: { customerId: string; profile: CardProfile }) {
  const router = useRouter();
  const saved = profile?.allergy === "YES" ? profile.allergyDetail ?? "" : "";
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [consent, setConsent] = useState(!!profile?.consentAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!consent) { setErr("ให้ลูกค้ากดยินยอมก่อนบันทึก"); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/color/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, caution: text, consent: true }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr("บันทึกไม่สำเร็จ"); return; }
    setEditing(false); router.refresh();
  }

  if (!editing) {
    return saved ? (
      <button type="button" onClick={() => setEditing(true)} className="w-full text-left flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: C.redBg, color: C.red }}>
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" /><span className="flex-1"><b>ข้อควรระวัง</b> — {saved}</span><span className="text-xs font-semibold">แก้</span>
      </button>
    ) : (
      <button type="button" onClick={() => setEditing(true)} className="text-xs px-1" style={{ color: C.muted }}>+ ข้อควรระวัง (เคยแพ้ / หนังศีรษะบอบบาง)</button>
    );
  }
  return (
    <section className="bg-white rounded-2xl p-3.5 space-y-2.5" style={{ border: `1px solid ${C.border}` }}>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder="เช่น แพ้สีย้อมเบอร์ 7 / หนังศีรษะระคายง่าย"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.border}`, color: C.text }} />
      {!profile?.consentAt && (
        <label className="flex items-start gap-2.5 text-xs rounded-xl p-2.5 cursor-pointer" style={{ background: C.bg, color: C.text }}>
          <input type="checkbox" className="mt-0.5 w-4 h-4" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>ลูกค้ายินยอมให้ err·day เก็บข้อมูลนี้และรูปก่อน–หลัง เพื่อใช้ภายในร้าน</span>
        </label>
      )}
      {err && <p className="text-xs" style={{ color: C.red }}>{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setEditing(false); setText(saved); }} className="flex-1 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.border}`, color: C.muted }}>ยกเลิก</button>
        <button type="button" disabled={busy} onClick={save} className="flex-1 py-2 rounded-lg text-sm text-white font-semibold disabled:opacity-50" style={{ background: C.primary }}>{busy ? "…" : "บันทึก"}</button>
      </div>
    </section>
  );
}

export default function ColorCard({ customerId, base, profile, visits, branches, bookingId, defaultBranchId, canChooseBranch }: {
  customerId: string; base: string; profile: CardProfile; visits: CardVisit[];
  branches: { id: string; name: string }[]; bookingId: string | null; defaultBranchId: string | null; canChooseBranch: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(defaultBranchId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const forBooking = bookingId ? visits.find(v => v.bookingId === bookingId) : null;
  const lastDone = visits.find(v => v.status === "DONE" && v.zones.length);

  async function start(copyFrom?: string) {
    setBusy(true); setErr(null);
    const res = await fetch("/api/color/visit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, bookingId: bookingId ?? undefined, branchId: branchId ?? undefined, copyFrom }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({})) as { id?: string; error?: string } | undefined;
    setBusy(false);
    if (!res?.ok || !j?.id) { setErr(j?.error ?? "เริ่มบันทึกไม่สำเร็จ"); return; }
    router.replace(`${base}/visit/${j.id}`);
  }

  return (
    <div className="space-y-3">
      <Caution customerId={customerId} profile={profile} />

      <section className="bg-white rounded-2xl p-4 space-y-2.5" style={{ border: `1px solid ${C.border}` }}>
        {forBooking ? (
          <Link replace href={`${base}/visit/${forBooking.id}`} className="block w-full py-3 rounded-xl text-center text-white font-semibold" style={{ background: C.primary }}>
            {forBooking.status === "DONE" ? "ดูบันทึกสีของนัดนี้" : "บันทึกสีของนัดนี้ต่อ"}
          </Link>
        ) : (
          <>
            {canChooseBranch && !bookingId && (
              <div className="flex flex-wrap gap-1.5">
                {branches.map(b => (
                  <button key={b.id} type="button" onClick={() => setBranchId(b.id)} className="px-3 py-1 rounded-full text-xs"
                    style={branchId === b.id ? { background: C.text, color: "white" } : { border: `1px solid ${C.border}`, color: C.muted }}>{b.name}</button>
                ))}
              </div>
            )}
            {lastDone && (
              <button type="button" disabled={busy} onClick={() => start(lastDone.id)} className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: C.primary }}>
                <Copy size={16} /> ใช้สูตรครั้งก่อน ({fmtThaiDate(lastDone.date)}) แล้วปรับ
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => start()} className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={lastDone ? { border: `1px solid ${C.primary}`, color: C.primary } : { background: C.primary, color: "white" }}>
              <Plus size={16} /> {lastDone ? "เริ่มสูตรใหม่" : "เริ่มบันทึกสีครั้งนี้"}
            </button>
          </>
        )}
        {err && <p className="text-xs" style={{ color: C.red }}>{err}</p>}
        <Link replace href={`${base}/print`} className="flex items-center justify-center gap-2 py-2 text-sm" style={{ color: C.muted }}>
          <Printer size={15} /> พิมพ์การ์ดสีผม A4
        </Link>
      </section>

      <p className="text-[11px] uppercase tracking-wider font-semibold px-1 pt-1" style={{ color: C.muted }}>ประวัติการทำสี · {visits.length} ครั้ง</p>
      {visits.length === 0 && <p className="text-sm px-1" style={{ color: C.muted }}>ยังไม่เคยบันทึกสูตรสี</p>}
      {visits.map(v => (
        <Link replace key={v.id} href={`${base}/visit/${v.id}`} className="block bg-white rounded-2xl p-3.5 space-y-1.5" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold flex-1" style={{ color: C.text }}>{fmtThaiDate(v.date)} · {v.branchName} · {v.stylistName}</p>
            {v.status === "DRAFT" && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: C.amberBg, color: C.amber }}>ยังไม่เสร็จ</span>}
            {v.result && RESULT[v.result] && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: RESULT[v.result].bg, color: RESULT[v.result].c }}>{RESULT[v.result].t}</span>}
          </div>
          {v.serviceTypes.length > 0 && <p className="text-xs" style={{ color: C.muted }}>{v.serviceTypes.join(" · ")}{v.targetLevel ? ` · เป้าหมายระดับ ${v.targetLevel}` : ""}</p>}
          {v.zones.map(z => (
            <p key={z.zone} className="text-xs" style={{ color: C.text }}><b>{ZONE[z.zone] ?? z.zone}</b> · {zoneLine(z)}</p>
          ))}
          {(v.beforePhotos.length > 0 || v.afterPhotos.length > 0) && (
            <div className="flex gap-1.5 pt-1">
              {[...v.beforePhotos.slice(0, 1), ...v.afterPhotos.slice(0, 2)].map(u => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ))}
            </div>
          )}
          {v.nextTimeNotes && <p className="text-xs italic" style={{ color: C.muted }}>“{v.nextTimeNotes}”</p>}
        </Link>
      ))}
    </div>
  );
}
