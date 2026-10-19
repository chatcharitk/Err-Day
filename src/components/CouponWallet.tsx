"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { couponValueLabel } from "@/lib/coupon-rules";

interface CampaignView {
  id: string; code: string; name: string; description: string | null; terms: string | null;
  discountType: string; discountValue: number; maxDiscountSatang: number | null;
  minSpendSatang: number; categories: string[]; validFrom: string; validUntil: string;
}
interface MyCoupon {
  id: string; status: "usable" | "upcoming" | "used" | "expired" | "void"; campaign: CampaignView;
  /** When / where the cashier applied it (set once used). */
  usedAt?: string | null; usedBranch?: string | null;
}
interface WalletState { canClaim: boolean; coupons: MyCoupon[]; available: CampaignView[] }

const UI = {
  th: {
    title: "คูปองของฉัน", sub: "แสดงหน้านี้กับพนักงานตอนชำระเงิน", claim: "รับคูปอง", claiming: "กำลังรับ...",
    until: "ใช้ได้ถึง", from: "เริ่มใช้", minSpend: "ขั้นต่ำ", only: "เฉพาะ", got: "ได้รับคูปองแล้ว 🎉", already: "คุณมีคูปองนี้อยู่แล้ว", notLinked: "จองคิวหรือสมัครสมาชิกก่อน เพื่อเก็บคูปองไว้ในบัญชี LINE",
    used: "ใช้แล้ว", expired: "หมดอายุ", failed: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", newOne: "คูปองใหม่", pastToggle: "คูปองที่ใช้แล้ว / หมดอายุ",
    terms: "เงื่อนไขการใช้คูปอง", showStaff: "แสดงให้พนักงาน", showHint: "แสดงหน้านี้ให้พนักงานตอนชำระเงิน แล้วให้พนักงานกดฉีกคูปองด้านล่าง", live: "สด",
    usedMsg: "ใช้คูปองแล้ว · พนักงานจะใส่ส่วนลดในบิลให้", usedAt: "ใช้เมื่อ", close: "ปิด", code: "โค้ด",
    tearBtn: "ฉีกคูปอง (พนักงานกด)", tearAsk: "พนักงานกดยืนยันการใช้คูปองนี้ตอนนี้? กดแล้วย้อนกลับไม่ได้", tearYes: "ยืนยัน ใช้คูปอง", tearNo: "ยกเลิก", tearing: "กำลังใช้คูปอง...",
    off: (label: string) => label,
  },
  en: {
    title: "My coupons", sub: "Show this to our staff when you pay", claim: "Get coupon", claiming: "Getting...",
    until: "Valid until", from: "Starts", minSpend: "Min. spend", only: "Only for", got: "Coupon added 🎉", already: "You already have this coupon", notLinked: "Book or join as a member first to keep coupons in your LINE account",
    used: "Used", expired: "Expired", failed: "Something went wrong. Please try again.", newOne: "New coupon", pastToggle: "Used / expired coupons",
    terms: "Terms & conditions", showStaff: "Show to staff", showHint: "Show this screen to our staff when you pay — they tap the button below to tear the coupon", live: "LIVE",
    usedMsg: "Coupon used · staff will take the discount off your bill", usedAt: "Used", close: "Close", code: "Code",
    tearBtn: "Tear coupon (staff taps)", tearAsk: "Staff: use this coupon now? This can't be undone.", tearYes: "Yes, use coupon", tearNo: "Cancel", tearing: "Using...",
    off: (label: string) => label.replace("ลด", "").replace("สูงสุด", "max").trim() + " off",
  },
};

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH")}`;

function day(value: string, lang: "th" | "en") {
  const ymd = new Date(new Date(value).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return new Date(ymd + "T12:00:00Z").toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
  });
}

const stamp = (iso: string, lang: "th" | "en") =>
  new Date(iso).toLocaleString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Zig-zag "torn" edge across the ticket at `y`% — the top half and the bottom half share it. */
function tearPath(y: number, half: "top" | "bottom") {
  const teeth = 18, pts: string[] = [];
  for (let i = 0; i <= teeth; i++) pts.push(`${(i / teeth) * 100}% ${y + (i % 2 ? 2.2 : -2.2)}%`);
  return half === "top"
    ? `polygon(0 0, 100% 0, ${pts.reverse().join(", ")})`
    : `polygon(${pts.join(", ")}, 100% 100%, 0 100%)`;
}
const TEAR_Y = 40;

function TicketFace({ c, lang, t }: { c: MyCoupon; lang: "th" | "en"; t: (typeof UI)["th"] }) {
  const cp = c.campaign;
  return (
    <div className="cp-face">
      <div className="cp-top"><small>err·day</small><strong>{t.off(couponValueLabel(cp))}</strong></div>
      <div className="cp-bottom">
        <h3>{cp.name}</h3>
        {cp.description && <p>{cp.description}</p>}
        <small>{t.until} {day(cp.validUntil, lang)}</small>
        <code>{t.code} {cp.code}</code>
      </div>
    </div>
  );
}

/** Full-screen "show the staff" coupon. Polls (parent) — when the cashier uses it, the ticket tears in two. */
function ShowCoupon({ c, lang, t, onClose, onUse }: { c: MyCoupon; lang: "th" | "en"; t: (typeof UI)["th"]; onClose: () => void; onUse: () => Promise<boolean> }) {
  const [clock, setClock] = useState(() => new Date());
  const [asking, setAsking] = useState(false);
  const [using, setUsing] = useState(false);
  const [prev, setPrev] = useState(c.status);
  const [tearing, setTearing] = useState(false);
  if (prev !== c.status) {
    setPrev(c.status);
    if (c.status === "used") setTearing(true);
  }
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (tearing) { try { navigator.vibrate?.([60, 40, 120]); } catch { /* not supported */ } } }, [tearing]);
  const used = c.status === "used";
  const time = clock.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" aria-label={c.campaign.name}>
      <button type="button" className="cp-close" onClick={onClose} aria-label={t.close}>✕</button>
      <div className="cp-live"><i /> {t.live} · {time}</div>
      <div className={`cp-stage${used ? " used" : ""}${tearing ? " tearing" : ""}`}>
        <div className="cp-half top" style={{ clipPath: tearPath(TEAR_Y, "top") }}><TicketFace c={c} lang={lang} t={t} /></div>
        <div className="cp-half bottom" style={{ clipPath: tearPath(TEAR_Y, "bottom") }}><TicketFace c={c} lang={lang} t={t} /></div>
        {used && <div className="cp-stamp"><b>{t.used}</b>{c.usedAt && <span>{t.usedAt} {stamp(c.usedAt, lang)}</span>}{c.usedBranch && <span>{c.usedBranch}</span>}</div>}
      </div>
      {!used && c.status === "usable" && (asking ? (
        <div className="cp-confirm">
          <p>{t.tearAsk}</p>
          <div>
            <button type="button" className="no" disabled={using} onClick={() => setAsking(false)}>{t.tearNo}</button>
            <button type="button" className="yes" disabled={using} onClick={async () => { setUsing(true); const ok = await onUse(); if (!ok) { setUsing(false); setAsking(false); } }}>{using ? t.tearing : t.tearYes}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="cp-tear-btn" onClick={() => setAsking(true)}>✂ {t.tearBtn}</button>
      ))}
      <p className="cp-hint">{used ? t.usedMsg : t.showHint}</p>
      {c.campaign.terms && !used && (
        <details className="cp-terms"><summary>{t.terms}</summary><p>{c.campaign.terms}</p></details>
      )}
    </div>
  );
}

/** Customer LINE hub: coupons held and coupons to claim. Codes are taken at the counter (POS), not here. */
export default function CouponWallet({ accessToken, lang }: { accessToken: string | null; lang: "th" | "en" }) {
  const t = UI[lang];
  const [state, setState] = useState<WalletState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showId, setShowId] = useState<string | null>(null);

  const call = useCallback(async (extra: Record<string, string> = {}) => {
    const res = await fetch("/api/customer/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineAccessToken: accessToken, ...extra }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    void call().then(r => { if (alive && r.ok) setState(r.data as WalletState); }).catch(() => {});
    return () => { alive = false; };
  }, [accessToken, call]);

  // While the "show staff" screen is open, watch for the cashier using the coupon.
  useEffect(() => {
    if (!showId || !accessToken) return;
    let alive = true;
    const id = setInterval(() => {
      void call().then(r => { if (alive && r.ok) setState(r.data as WalletState); }).catch(() => {});
    }, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [showId, accessToken, call]);

  async function tearCoupon(id: string): Promise<boolean> {
    try {
      const r = await call({ useCouponId: id });
      if (r.data?.coupons) setState(r.data as WalletState);
      return r.ok;
    } catch { return false; }
  }

  async function claim(extra: Record<string, string>, key: string) {
    setBusy(key); setNote(null);
    try {
      const r = await call(extra);
      if (r.ok) {
        setState(r.data as WalletState);
        setNote({ ok: true, text: r.data.created ? t.got : t.already });
      } else {
        setNote({ ok: false, text: r.data.message || t.failed });
      }
    } catch { setNote({ ok: false, text: t.failed }); } finally { setBusy(null); }
  }

  if (!state) return null;
  const live = state.coupons.filter(c => c.status === "usable" || c.status === "upcoming");
  const past = state.coupons.filter(c => c.status === "used" || c.status === "expired");
  const hasAnything = live.length > 0 || state.available.length > 0;
  if (!hasAnything && past.length === 0 && !showId) return null;

  const terms = (c: CampaignView) => [
    c.minSpendSatang > 0 ? `${t.minSpend} ${baht(c.minSpendSatang)}` : null,
    c.categories.length ? `${t.only} ${c.categories.join(", ")}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="hub-section coupon-wallet">
      {hasAnything && <div className="coupon-head"><h2><Ticket /> {t.title}</h2><p>{t.sub}</p></div>}

      {live.map(c => (
        <article key={c.id} className={`coupon-ticket${c.status === "upcoming" ? " soon" : ""}`}>
          <div className="coupon-value"><strong>{t.off(couponValueLabel(c.campaign))}</strong></div>
          <div className="coupon-body">
            <h3>{c.campaign.name}</h3>
            {c.campaign.description && <p>{c.campaign.description}</p>}
            {terms(c.campaign) && <p>{terms(c.campaign)}</p>}
            <small>{c.status === "upcoming" ? `${t.from} ${day(c.campaign.validFrom, lang)}` : `${t.until} ${day(c.campaign.validUntil, lang)}`}</small>
            {c.campaign.terms && <details className="coupon-terms"><summary>{t.terms}</summary><p>{c.campaign.terms}</p></details>}
            {c.status === "usable" && <button type="button" onClick={() => setShowId(c.id)}>{t.showStaff}</button>}
          </div>
        </article>
      ))}

      {state.available.map(c => (
        <article key={c.id} className="coupon-ticket offer">
          <div className="coupon-value"><strong>{t.off(couponValueLabel(c))}</strong></div>
          <div className="coupon-body">
            <em>{t.newOne}</em>
            <h3>{c.name}</h3>
            {terms(c) && <p>{terms(c)}</p>}
            <small>{t.until} {day(c.validUntil, lang)}</small>
            {c.terms && <details className="coupon-terms"><summary>{t.terms}</summary><p>{c.terms}</p></details>}
            {state.canClaim
              ? <button type="button" disabled={!!busy} onClick={() => void claim({ claimCampaignId: c.id }, c.id)}>{busy === c.id ? t.claiming : t.claim}</button>
              : <p className="coupon-note">{t.notLinked}</p>}
          </div>
        </article>
      ))}

      {showId && (() => { const sc = state.coupons.find(x => x.id === showId); return sc ? <ShowCoupon key={sc.id} c={sc} lang={lang} t={t} onClose={() => setShowId(null)} onUse={() => tearCoupon(sc.id)} /> : null; })()}

      {note && <p className={`coupon-msg${note.ok ? " ok" : ""}`} role="status">{note.text}</p>}

      {past.length > 0 && <>
        <button type="button" className="coupon-past-toggle" onClick={() => setShowPast(v => !v)}>{t.pastToggle} ({past.length}) {showPast ? "▴" : "▾"}</button>
        {showPast && past.map(c => (
          <article key={c.id} className={`coupon-ticket past${c.status === "used" ? " torn" : ""}`}>
            <div className="coupon-value"><strong>{t.off(couponValueLabel(c.campaign))}</strong></div>
            <div className="coupon-body">
              <h3>{c.campaign.name}</h3>
              <small>{c.status === "used" ? `${t.used}${c.usedAt ? ` · ${stamp(c.usedAt, lang)}` : ""}` : t.expired}</small>
            </div>
            {c.status === "used" && <span className="coupon-torn-stamp">{t.used}</span>}
          </article>
        ))}
      </>}
    </section>
  );
}
