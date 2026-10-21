"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ticket, Users, Undo2, Ban, X, Pencil } from "lucide-react";
import CustomerSearch, { type CustomerValue } from "@/components/CustomerSearch";
import { CLAIM_MODE_LABEL, couponValueLabel, type CampaignPhase, type ClaimMode } from "@/lib/coupon-rules";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const ORANGE  = "#C2410C";

interface Campaign {
  id: string; code: string; name: string; description: string | null; terms: string | null;
  discountType: string; discountValue: number; maxDiscountSatang: number | null; minSpendSatang: number; categories: string[];
  validFrom: string; validUntil: string; claimMode: string; usesPerCoupon: number; maxClaims: number | null; isActive: boolean;
  phase: CampaignPhase; issued: number; uses: number; discountSatang: number;
}
interface Holder {
  id: string; source: string; createdAt: string; usesAllowed: number; usesUsed: number; voided: boolean; status: string;
  customer: { id: string; name: string; phone: string };
  redemptions: { id: string; at: string; discountSatang: number; reversed: boolean; bookingId: string | null; branch: string | null; billSatang: number | null; appOnly?: boolean }[];
}
interface Props {
  /** Where campaign links point (desktop /admin/coupons, mobile /admin/m/coupons). */
  basePath?: string;
  /** Phone layout: tighter padding, holders as cards instead of a table. */
  compact?: boolean;
  today: string;
  categories: string[];
  campaigns: Campaign[];
  selected: { id: string; coupons: Holder[] } | null;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH")}`;
const fmtDay = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const PHASE: Record<CampaignPhase, { label: string; bg: string; fg: string }> = {
  active:   { label: "ใช้งานอยู่", bg: "#DCFCE7", fg: "#166534" },
  upcoming: { label: "ยังไม่เริ่ม", bg: "#DBEAFE", fg: "#1D4ED8" },
  expired:  { label: "หมดอายุ",   bg: "#F1F5F9", fg: "#475569" },
  inactive: { label: "ปิดอยู่",    bg: "#FEE2E2", fg: "#991B1B" },
};
const STATUS: Record<string, string> = { usable: "ยังไม่ใช้", upcoming: "รอเริ่ม", used: "ใช้แล้ว", expired: "หมดอายุ", void: "ยกเลิก" };
const SOURCE: Record<string, string> = { CLAIM: "กดรับใน LINE", CODE: "กรอกโค้ด", ADMIN: "แอดมินแจก", BULK: "แจกกลุ่ม" };

export default function CouponsManager({ today, categories, campaigns, selected, basePath = "/admin/coupons", compact = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const current = selected ? campaigns.find(c => c.id === selected.id) ?? null : null;

  return (
    <div className={compact ? "p-4" : "p-6 max-w-6xl"}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          {!compact && <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Coupons</p>}
          <h1 className={compact ? "text-lg font-medium" : "text-2xl font-medium"} style={{ color: TEXT }}>คูปองส่วนลด</h1>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            สร้างคูปองต่อกิจกรรม · ลูกค้าเห็นคูปองที่ได้รับใน LINE (หน้าสมาชิก) · ใช้ที่ POS ตอนคิดเงิน · ลูกค้า 1 คนได้ 1 ใบต่อกิจกรรม
          </p>
        </div>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: PRIMARY }}>
          <Plus size={16} /> สร้างคูปอง
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-sm" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
          ยังไม่มีคูปอง — กด “สร้างคูปอง” เพื่อเริ่ม
        </div>
      ) : (
        <div className={compact ? "grid gap-3 mb-5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6"}>
          {campaigns.map(c => {
            const ph = PHASE[c.phase];
            const on = current?.id === c.id;
            return (
              <button key={c.id} onClick={() => router.push(on ? basePath : `${basePath}?c=${c.id}`, { scroll: false })}
                className="text-left rounded-2xl bg-white p-4 transition-shadow hover:shadow-md"
                style={{ border: `${on ? 2 : 1}px solid ${on ? ORANGE : BORDER}` }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug" style={{ color: TEXT }}>🎟 {c.name}</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: ph.bg, color: ph.fg }}>{ph.label}</span>
                </div>
                <p className="text-lg font-bold mt-1" style={{ color: ORANGE }}>{couponValueLabel(c)}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  โค้ด <b style={{ color: TEXT }}>{c.code}</b> · {fmtDay(c.validFrom)} – {fmtDay(c.validUntil)}
                </p>
                <p className="text-xs" style={{ color: MUTED }}>{CLAIM_MODE_LABEL[c.claimMode as ClaimMode] ?? c.claimMode}</p>
                <div className="flex gap-4 mt-3 pt-3 text-xs" style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}>
                  <span>แจก <b style={{ color: TEXT }}>{c.issued}</b>{c.maxClaims ? `/${c.maxClaims}` : ""}</span>
                  <span>ใช้ <b style={{ color: TEXT }}>{c.uses}</b></span>
                  <span>ลดไป <b style={{ color: TEXT }}>{baht(c.discountSatang)}</b></span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {current && selected && (
        <CampaignDetail key={current.id} campaign={current} holders={selected.coupons} compact={compact} onEdit={() => setEditing(current)} />
      )}

      {editing && (
        <CampaignForm initial={editing === "new" ? null : editing} today={today} categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); router.push(`${basePath}?c=${id}`, { scroll: false }); router.refresh(); }} />
      )}
    </div>
  );
}

// ── Detail: issue + holders ──────────────────────────────────────────────────

function CampaignDetail({ campaign, holders, onEdit, compact = false }: { campaign: Campaign; holders: Holder[]; onEdit: () => void; compact?: boolean }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerValue>({ id: null, name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function act(body: Record<string, unknown>, okMsg?: (d: Record<string, unknown>) => string) {
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch(`/api/admin/coupons/${campaign.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "ไม่สำเร็จ"); return; }
      if (okMsg) setMsg(okMsg(d));
      router.refresh();
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); } finally { setBusy(false); }
  }

  function bulk(audience: "VOTERS" | "LINE", label: string) {
    if (!confirm(`แจกคูปอง “${campaign.name}” ให้${label}?\nคนที่มีคูปองนี้แล้วจะไม่ได้ซ้ำ\n\nระบบจะส่งข้อความ LINE แจ้งลูกค้าทุกคนที่ได้รับ พร้อมลิงก์เปิดแอป`)) return;
    void act({ action: "bulk", audience }, d => `แจกเพิ่ม ${d.issued} คน · กำลังส่งข้อความ LINE แจ้ง (คนที่ไม่ได้เชื่อม LINE จะไม่ได้รับข้อความ)`);
  }

  return (
    <section className={compact ? "rounded-2xl bg-white p-4" : "rounded-2xl bg-white p-5"} style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: TEXT }}>{campaign.name}</h2>
          {campaign.description && <p className="text-sm mt-0.5" style={{ color: MUTED }}>{campaign.description}</p>}
          {campaign.terms && <p className="text-xs mt-1 whitespace-pre-line" style={{ color: MUTED }}><b style={{ color: TEXT }}>เงื่อนไข:</b> {campaign.terms}</p>}
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            {couponValueLabel(campaign)}
            {campaign.minSpendSatang > 0 && ` · ขั้นต่ำ ${baht(campaign.minSpendSatang)}`}
            {` · ใช้ได้ ${campaign.usesPerCoupon} ครั้ง/ใบ`}
            {` · ${campaign.categories.length ? `เฉพาะ ${campaign.categories.join(", ")}` : "ทุกบริการ (ยกเว้นสมาชิก/แพ็กเกจ)"}`}
          </p>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
          <Pencil size={14} /> แก้ไข
        </button>
      </div>

      <div className={compact ? "grid gap-4 mb-5" : "grid gap-4 md:grid-cols-2 mb-5"}>
        <div className="rounded-xl p-4" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: TEXT }}>แจกให้ลูกค้า 1 คน</p>
          <CustomerSearch value={customer} onChange={setCustomer} showManualPhone={false} compact />
          <button disabled={busy || !customer.id}
            onClick={() => void act({ action: "issue", customerId: customer.id }, d => !d.created ? `${customer.name} มีคูปองนี้อยู่แล้ว (ไม่ได้ส่ง LINE ซ้ำ)`
              : d.line === "sent" ? `แจกให้ ${customer.name} แล้ว และส่งข้อความ LINE แล้ว`
              : d.line === "no_line" ? `แจกให้ ${customer.name} แล้ว · ⚠ ลูกค้ายังไม่ได้เชื่อม LINE จึงส่งข้อความไม่ได้ (คูปองจะขึ้นในแอปเมื่อเชื่อม LINE ด้วยเบอร์นี้)`
              : `แจกให้ ${customer.name} แล้ว · ⚠ ส่งข้อความ LINE ไม่สำเร็จ`)}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: ORANGE }}>
            <Ticket size={14} className="inline mr-1" /> แจกคูปอง
          </button>
        </div>
        <div className="rounded-xl p-4" style={{ background: "#FFF8F4", border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: TEXT }}>แจกเป็นกลุ่ม</p>
          <div className="grid gap-2">
            <button disabled={busy} onClick={() => bulk("VOTERS", "ลูกค้าทุกคนที่โหวต Halloween")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left disabled:opacity-40" style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}>
              <Users size={14} /> ลูกค้าที่โหวตพนักงาน Halloween
            </button>
            <button disabled={busy} onClick={() => bulk("LINE", "ลูกค้าทุกคนที่เชื่อม LINE")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left disabled:opacity-40" style={{ background: "white", border: `1px solid ${BORDER}`, color: TEXT }}>
              <Users size={14} /> ลูกค้าทุกคนที่เชื่อม LINE
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: MUTED }}>
            เมื่อแจก ระบบส่งข้อความ LINE แจ้งลูกค้าพร้อมปุ่มเปิดแอป · คูปองจะขึ้นในหน้าสมาชิกของลูกค้า
          </p>
        </div>
      </div>

      {msg && <p className="text-sm mb-3" style={{ color: "#166534" }}>{msg}</p>}
      {err && <p className="text-sm mb-3" style={{ color: "#B91C1C" }}>{err}</p>}

      <p className="text-sm font-semibold mb-2" style={{ color: TEXT }}>ผู้ถือคูปอง ({holders.length})</p>
      {holders.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีใครได้รับคูปองนี้</p>
      ) : compact ? (
        <div className="space-y-2">
          {holders.map(h => (
            <div key={h.id} className="rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={`/admin/m/customers/${h.customer.id}`} className="font-medium text-sm" style={{ color: TEXT }}>{h.customer.name}</a>
                  <p className="text-xs" style={{ color: MUTED }}>{h.customer.phone} · {SOURCE[h.source] ?? h.source} · {fmtTime(h.createdAt)}</p>
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: h.status === "usable" ? "#166534" : MUTED }}>{STATUS[h.status] ?? h.status} · {h.usesUsed}/{h.usesAllowed}</span>
              </div>
              <Redemptions h={h} busy={busy} act={act} />
              <HolderButtons h={h} busy={busy} act={act} />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: MUTED }}>
                <th className="py-2 pr-3 font-medium">ลูกค้า</th>
                <th className="py-2 pr-3 font-medium">ได้รับจาก</th>
                <th className="py-2 pr-3 font-medium">สถานะ</th>
                <th className="py-2 pr-3 font-medium">การใช้</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {holders.map(h => (
                <tr key={h.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td className="py-2 pr-3 align-top">
                    <a href={`/admin/m/customers/${h.customer.id}`} className="font-medium hover:underline" style={{ color: TEXT }}>{h.customer.name}</a>
                    <p className="text-xs" style={{ color: MUTED }}>{h.customer.phone}</p>
                  </td>
                  <td className="py-2 pr-3 align-top text-xs" style={{ color: MUTED }}>{SOURCE[h.source] ?? h.source}<br />{fmtTime(h.createdAt)}</td>
                  <td className="py-2 pr-3 align-top">
                    <span className="text-xs font-semibold" style={{ color: h.status === "usable" ? "#166534" : MUTED }}>{STATUS[h.status] ?? h.status}</span>
                    <p className="text-[11px]" style={{ color: MUTED }}>{h.usesUsed}/{h.usesAllowed} ครั้ง</p>
                  </td>
                  <td className="py-2 pr-3 align-top"><Redemptions h={h} busy={busy} act={act} /></td>
                  <td className="py-2 align-top text-right"><HolderButtons h={h} busy={busy} act={act} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Holder rows: usage list + actions (shared by table and card layouts) ───

type Act = (body: Record<string, unknown>, okMsg?: (d: Record<string, unknown>) => string) => Promise<void>;

function Redemptions({ h, busy, act }: { h: Holder; busy: boolean; act: Act }) {
  if (h.redemptions.length === 0) return <span className="text-xs" style={{ color: MUTED }}>—</span>;
  return (
    <div className="mt-1">
      {h.redemptions.map(r => (
        <div key={r.id} className="flex items-center gap-2 text-xs" style={{ color: r.reversed ? MUTED : TEXT, textDecoration: r.reversed ? "line-through" : undefined }}>
          <span>{r.appOnly ? `${fmtTime(r.at)} · ฉีกคูปองแล้ว (รอใส่ในบิล)` : `${fmtTime(r.at)} · ${r.branch} · ลด ${baht(r.discountSatang)} (บิล ${baht(r.billSatang ?? 0)})`}</span>
          {!r.reversed && (
            <button disabled={busy} title="คืนสิทธิ์ (ยกเลิกการใช้)"
              onClick={() => { if (confirm("คืนสิทธิ์คูปองนี้ให้ลูกค้า? (ใช้เมื่อคืนเงิน/คิดเงินผิด)")) void act({ action: "reverse", redemptionId: r.id }); }}
              className="p-1 rounded" style={{ color: ORANGE }}><Undo2 size={13} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

function HolderButtons({ h, busy, act }: { h: Holder; busy: boolean; act: Act }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-2 md:mt-0 md:justify-end">
      {h.status === "usable" && (
        <button disabled={busy}
          onClick={() => { if (confirm(`ใช้คูปองของ ${h.customer.name} ตอนนี้?\nคูปองจะถูกฉีก (หน้าจอลูกค้าฉีกตาม) แล้วต้องไปใส่ในบิลที่ POS ภายใน 3 ชั่วโมง`)) void act({ action: "use", couponId: h.id }, () => `ใช้คูปองของ ${h.customer.name} แล้ว — ไปใส่ในบิลที่ POS`); }}
          className="text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: ORANGE }}>
          ✂ ใช้คูปอง
        </button>
      )}
      <button disabled={busy} onClick={() => void act({ action: h.voided ? "unvoid" : "void", couponId: h.id })}
        className="text-xs flex items-center gap-1 px-2 py-1.5 rounded" style={{ color: h.voided ? "#166534" : "#991B1B" }}>
        <Ban size={12} /> {h.voided ? "เปิดใช้คืน" : "ยกเลิกคูปอง"}
      </button>
    </div>
  );
}

// ── Create / edit form ───────────────────────────────────────────────────────

function CampaignForm({ initial, today, categories, onClose, onSaved }: {
  initial: Campaign | null; today: string; categories: string[];
  onClose: () => void; onSaved: (id: string) => void;
}) {
  const [f, setF] = useState(() => ({
    code:          initial?.code ?? "",
    name:          initial?.name ?? "",
    description:   initial?.description ?? "",
    terms:         initial?.terms ?? "",
    discountType:  initial?.discountType ?? "PERCENT",
    discountValue: initial ? String(initial.discountType === "AMOUNT" ? initial.discountValue / 100 : initial.discountValue) : "10",
    maxDiscountBaht: initial?.maxDiscountSatang ? String(initial.maxDiscountSatang / 100) : "",
    minSpendBaht:  initial?.minSpendSatang ? String(initial.minSpendSatang / 100) : "",
    categories:    initial?.categories ?? [] as string[],
    validFrom:     initial?.validFrom ?? today,
    validUntil:    initial?.validUntil ?? "",
    claimMode:     initial?.claimMode ?? "CODE",
    usesPerCoupon: String(initial?.usesPerCoupon ?? 1),
    maxClaims:     initial?.maxClaims ? String(initial.maxClaims) : "",
    isActive:      initial?.isActive ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true); setErr("");
    try {
      const res = await fetch(initial ? `/api/admin/coupons/${initial.id}` : "/api/admin/coupons", {
        method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, maxClaims: f.maxClaims || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); return; }
      onSaved(d.campaign.id);
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); } finally { setBusy(false); }
  }

  const input = "w-full px-3 py-2 rounded-lg text-sm";
  const box = { border: `1px solid ${BORDER}`, background: "white", color: TEXT };
  const label = "block text-xs font-medium mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: TEXT }}>{initial ? "แก้ไขคูปอง" : "สร้างคูปองใหม่"}</h2>
          <button onClick={onClose} style={{ color: MUTED }}><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label} style={{ color: MUTED }}>ชื่อคูปอง (ลูกค้าเห็น)</label>
            <input className={input} style={box} value={f.name} onChange={e => set("name", e.target.value)} placeholder="Halloween ลด 10%" />
          </div>
          <div className="col-span-2">
            <label className={label} style={{ color: MUTED }}>รายละเอียด (ไม่บังคับ)</label>
            <input className={input} style={box} value={f.description} onChange={e => set("description", e.target.value)} placeholder="ขอบคุณที่ร่วมสนุกกิจกรรม Halloween" />
          </div>
          <div className="col-span-2">
            <label className={label} style={{ color: MUTED }}>เงื่อนไขการใช้คูปอง (ลูกค้าและแคชเชียร์เห็น · 1 ข้อต่อ 1 บรรทัด)</label>
            <textarea className={input} style={{ ...box, minHeight: 96 }} value={f.terms} onChange={e => set("terms", e.target.value)}
              placeholder={"ใช้ได้ 1 ครั้งต่อ 1 สิทธิ์\nไม่สามารถใช้ร่วมกับโปรโมชั่นอื่น\nไม่สามารถแลกเป็นเงินสด\nร้านขอสงวนสิทธิ์ในการเปลี่ยนแปลงเงื่อนไขโดยไม่แจ้งล่วงหน้า"} />
          </div>
          <div>
            <label className={label} style={{ color: MUTED }}>โค้ด</label>
            <input className={`${input} uppercase`} style={box} value={f.code} onChange={e => set("code", e.target.value.toUpperCase())} placeholder="HALLOWEEN26" />
          </div>
          <div>
            <label className={label} style={{ color: MUTED }}>ส่วนลด</label>
            <div className="flex gap-1.5">
              <input className={input} style={box} inputMode="decimal" value={f.discountValue} onChange={e => set("discountValue", e.target.value)} />
              {(["PERCENT", "AMOUNT"] as const).map(t => (
                <button key={t} type="button" onClick={() => set("discountType", t)}
                  className="px-3 rounded-lg text-sm font-bold flex-shrink-0"
                  style={f.discountType === t ? { background: ORANGE, color: "white" } : { ...box }}>
                  {t === "PERCENT" ? "%" : "฿"}
                </button>
              ))}
            </div>
          </div>
          {f.discountType === "PERCENT" && (
            <div>
              <label className={label} style={{ color: MUTED }}>ลดสูงสุด ฿ (ไม่บังคับ)</label>
              <input className={input} style={box} inputMode="decimal" value={f.maxDiscountBaht} onChange={e => set("maxDiscountBaht", e.target.value)} placeholder="ไม่จำกัด" />
            </div>
          )}
          <div>
            <label className={label} style={{ color: MUTED }}>ยอดขั้นต่ำ ฿ (ไม่บังคับ)</label>
            <input className={input} style={box} inputMode="decimal" value={f.minSpendBaht} onChange={e => set("minSpendBaht", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={label} style={{ color: MUTED }}>เริ่มใช้ได้</label>
            <input type="date" className={input} style={box} value={f.validFrom} onChange={e => set("validFrom", e.target.value)} />
          </div>
          <div>
            <label className={label} style={{ color: MUTED }}>ใช้ได้ถึง (รวมวันนั้น)</label>
            <input type="date" className={input} style={box} value={f.validUntil} onChange={e => set("validUntil", e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className={label} style={{ color: MUTED }}>ใช้กับบริการ</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set("categories", [])}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={f.categories.length === 0 ? { background: ORANGE, color: "white" } : { ...box }}>ทุกบริการ</button>
              {categories.filter(c => c !== "Membership" && c !== "แพ็กเกจ").map(c => {
                const on = f.categories.includes(c);
                return (
                  <button key={c} type="button"
                    onClick={() => set("categories", on ? f.categories.filter(x => x !== c) : [...f.categories, c])}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={on ? { background: ORANGE, color: "white" } : { ...box }}>{c}</button>
                );
              })}
            </div>
            <p className="text-[11px] mt-1" style={{ color: MUTED }}>ไม่ลดค่าสมาชิกและแพ็กเกจเสมอ · ถ้าเลือกหมวด จะไม่ลดบริการเสริม (add-on)</p>
          </div>

          <div className="col-span-2">
            <label className={label} style={{ color: MUTED }}>ลูกค้าได้คูปองยังไง</label>
            <div className="grid gap-1.5">
              {(["OPEN", "CODE", "ISSUED"] as const).map(m => (
                <button key={m} type="button" onClick={() => set("claimMode", m)}
                  className="text-left px-3 py-2 rounded-lg text-sm"
                  style={f.claimMode === m ? { background: "#FFF7ED", border: `1.5px solid ${ORANGE}`, color: TEXT } : { ...box }}>
                  <b>{CLAIM_MODE_LABEL[m]}</b>
                  <span className="block text-xs" style={{ color: MUTED }}>
                    {m === "OPEN" && "ปุ่ม “รับคูปอง” โชว์ในหน้า LINE ของลูกค้าทุกคน"}
                    {m === "CODE" && "ลูกค้าบอกโค้ดที่เคาน์เตอร์ แล้วพนักงานกรอกที่ POS"}
                    {m === "ISSUED" && "แจกเฉพาะคนที่แอดมินเลือก / แจกเป็นกลุ่ม (เช่น คนที่โหวต)"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label} style={{ color: MUTED }}>ใช้ได้กี่ครั้งต่อใบ</label>
            <input className={input} style={box} inputMode="numeric" value={f.usesPerCoupon} onChange={e => set("usesPerCoupon", e.target.value)} />
          </div>
          <div>
            <label className={label} style={{ color: MUTED }}>จำนวนคูปองทั้งหมด (ไม่บังคับ)</label>
            <input className={input} style={box} inputMode="numeric" value={f.maxClaims} onChange={e => set("maxClaims", e.target.value)} placeholder="ไม่จำกัด" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm" style={{ color: TEXT }}>
            <input type="checkbox" checked={f.isActive} onChange={e => set("isActive", e.target.checked)} style={{ width: 16, height: 16 }} />
            เปิดใช้งาน (ปิดไว้ = ลูกค้าไม่เห็นและใช้ไม่ได้)
          </label>
        </div>

        {err && <p className="text-sm mt-3" style={{ color: "#B91C1C" }}>{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>ยกเลิก</button>
          <button onClick={() => void save()} disabled={busy}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: PRIMARY }}>
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
