"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { couponValueLabel } from "@/lib/coupon-rules";

interface CampaignView {
  id: string; code: string; name: string; description: string | null;
  discountType: string; discountValue: number; maxDiscountSatang: number | null;
  minSpendSatang: number; categories: string[]; validFrom: string; validUntil: string;
}
interface MyCoupon { id: string; status: "usable" | "upcoming" | "used" | "expired" | "void"; campaign: CampaignView }
interface WalletState { canClaim: boolean; coupons: MyCoupon[]; available: CampaignView[] }

const UI = {
  th: {
    title: "คูปองของฉัน", sub: "แสดงหน้านี้กับพนักงานตอนชำระเงิน", claim: "รับคูปอง", claiming: "กำลังรับ...",
    until: "ใช้ได้ถึง", from: "เริ่มใช้", minSpend: "ขั้นต่ำ", only: "เฉพาะ", haveCode: "มีโค้ดส่วนลด?", codePh: "กรอกโค้ด",
    use: "ใช้โค้ด", got: "ได้รับคูปองแล้ว 🎉", already: "คุณมีคูปองนี้อยู่แล้ว", notLinked: "จองคิวหรือสมัครสมาชิกก่อน เพื่อเก็บคูปองไว้ในบัญชี LINE",
    used: "ใช้แล้ว", expired: "หมดอายุ", failed: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", newOne: "คูปองใหม่", pastToggle: "คูปองที่ใช้แล้ว / หมดอายุ",
    off: (label: string) => label,
  },
  en: {
    title: "My coupons", sub: "Show this to our staff when you pay", claim: "Get coupon", claiming: "Getting...",
    until: "Valid until", from: "Starts", minSpend: "Min. spend", only: "Only for", haveCode: "Have a promo code?", codePh: "Enter code",
    use: "Apply", got: "Coupon added 🎉", already: "You already have this coupon", notLinked: "Book or join as a member first to keep coupons in your LINE account",
    used: "Used", expired: "Expired", failed: "Something went wrong. Please try again.", newOne: "New coupon", pastToggle: "Used / expired coupons",
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

/** Customer LINE hub: coupons held, coupons to claim, and a code box. */
export default function CouponWallet({ accessToken, lang }: { accessToken: string | null; lang: "th" | "en" }) {
  const t = UI[lang];
  const [state, setState] = useState<WalletState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPast, setShowPast] = useState(false);

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

  async function claim(extra: Record<string, string>, key: string) {
    setBusy(key); setNote(null);
    try {
      const r = await call(extra);
      if (r.ok) {
        setState(r.data as WalletState);
        setNote({ ok: true, text: r.data.created ? t.got : t.already });
        setCode("");
      } else {
        setNote({ ok: false, text: r.data.message || t.failed });
      }
    } catch { setNote({ ok: false, text: t.failed }); } finally { setBusy(null); }
  }

  if (!state) return null;
  const live = state.coupons.filter(c => c.status === "usable" || c.status === "upcoming");
  const past = state.coupons.filter(c => c.status === "used" || c.status === "expired");
  const hasAnything = live.length > 0 || state.available.length > 0;

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
            {state.canClaim
              ? <button type="button" disabled={!!busy} onClick={() => void claim({ claimCampaignId: c.id }, c.id)}>{busy === c.id ? t.claiming : t.claim}</button>
              : <p className="coupon-note">{t.notLinked}</p>}
          </div>
        </article>
      ))}

      {state.canClaim && (
        <div className="coupon-code">
          <span>{t.haveCode}</span>
          <div>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t.codePh} autoCapitalize="characters" />
            <button type="button" disabled={!code.trim() || !!busy} onClick={() => void claim({ code }, "code")}>{busy === "code" ? "…" : t.use}</button>
          </div>
        </div>
      )}
      {note && <p className={`coupon-msg${note.ok ? " ok" : ""}`} role="status">{note.text}</p>}

      {past.length > 0 && <>
        <button type="button" className="coupon-past-toggle" onClick={() => setShowPast(v => !v)}>{t.pastToggle} ({past.length}) {showPast ? "▴" : "▾"}</button>
        {showPast && past.map(c => (
          <article key={c.id} className="coupon-ticket past">
            <div className="coupon-value"><strong>{t.off(couponValueLabel(c.campaign))}</strong></div>
            <div className="coupon-body"><h3>{c.campaign.name}</h3><small>{c.status === "used" ? t.used : t.expired}</small></div>
          </article>
        ))}
      </>}
    </section>
  );
}
