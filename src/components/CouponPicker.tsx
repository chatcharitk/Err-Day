"use client";

import { useEffect, useState } from "react";
import { Ticket, X, Loader2 } from "lucide-react";
import { couponDate, couponValueLabel, quoteCoupon, type CouponLine } from "@/lib/coupon-rules";

export interface PosCoupon {
  id:     string;
  status: "usable" | "upcoming" | "used" | "expired" | "void";
  campaign: {
    id: string; code: string; name: string; terms?: string | null;
    discountType: string; discountValue: number; maxDiscountSatang: number | null;
    minSpendSatang: number; categories: string[]; validUntil: string;
  };
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH")}`;

/** The coupon line to send to /api/pos/sale (the server recomputes its price). */
export function couponSaleLine(coupon: PosCoupon | null, discountSatang: number) {
  if (!coupon || discountSatang <= 0) return [];
  return [{ name: `คูปอง ${coupon.campaign.name}`, price: -discountSatang, qty: 1, couponId: coupon.id, branchServiceId: undefined, redeemPackageId: undefined }];
}

export function couponDiscount(coupon: PosCoupon | null, lines: CouponLine[]) {
  return coupon ? quoteCoupon(coupon.campaign, lines) : null;
}

/**
 * POS coupon box: lists the selected customer's usable coupons, lets the
 * cashier apply one, or type a code the customer gives at the counter.
 */
export default function CouponPicker({ phone, lines, value, onChange }: {
  phone: string;
  lines: CouponLine[];
  value: PosCoupon | null;
  onChange: (c: PosCoupon | null) => void;
}) {
  const [coupons, setCoupons] = useState<PosCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const cleanPhone = phone.trim();

  useEffect(() => {
    let alive = true;
    // Deferred so the reset isn't a synchronous setState inside the effect body.
    const t = window.setTimeout(() => {
      setErr("");
      if (!cleanPhone) { setCoupons([]); return; }
      setLoading(true);
      fetch(`/api/admin/coupons/customer?phone=${encodeURIComponent(cleanPhone)}`)
        .then(r => r.ok ? r.json() : { coupons: [] })
        .then(d => { if (alive) setCoupons(d.coupons ?? []); })
        .catch(() => { if (alive) setCoupons([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [cleanPhone]);

  async function applyCode() {
    if (!code.trim()) return;
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons/customer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "ใช้โค้ดไม่สำเร็จ"); return; }
      const list: PosCoupon[] = d.coupons ?? [];
      setCoupons(list);
      const got = list.find(c => c.campaign.id === d.campaignId);
      if (got?.status === "usable") onChange(got);
      else if (got) setErr(got.status === "used" ? "ลูกค้าใช้คูปองนี้ไปแล้ว" : "คูปองนี้ใช้ไม่ได้ตอนนี้");
      setCode("");
    } catch { setErr("ใช้โค้ดไม่สำเร็จ"); } finally { setLoading(false); }
  }

  const usable = coupons.filter(c => c.status === "usable");
  const quote = value ? quoteCoupon(value.campaign, lines) : null;

  if (!cleanPhone) {
    return <p className="text-xs flex items-center gap-1.5" style={{ color: "#A08070" }}><Ticket size={13} /> เลือกลูกค้าเพื่อใช้คูปอง</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#3B2A24" }}>
        <Ticket size={13} /> คูปอง {loading && <Loader2 size={12} className="animate-spin" />}
      </p>
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#FFF7ED", border: "1.5px solid #FDBA74" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#9A3412" }}>{value.campaign.name} · {couponValueLabel(value.campaign)}</p>
            <p className="text-[11px]" style={{ color: quote?.problem ? "#B91C1C" : "#C2410C" }}>
              {quote?.problem ?? `ลด ${baht(quote?.discountSatang ?? 0)}`}
            </p>
            {value.campaign.terms && <p className="text-[10px] mt-0.5 whitespace-pre-line" style={{ color: "#A08070" }}>เงื่อนไข: {value.campaign.terms}</p>}
          </div>
          <button type="button" onClick={() => onChange(null)} className="p-1 rounded-lg" style={{ color: "#9A3412" }} title="เอาคูปองออก">
            <X size={16} />
          </button>
        </div>
      ) : usable.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {usable.map(c => (
            <button key={c.id} type="button" onClick={() => onChange(c)}
              className="text-left px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "white", border: "1.5px dashed #FB923C", color: "#9A3412" }}>
              🎟 {c.campaign.name} · {couponValueLabel(c.campaign)}
              <span className="block text-[10px] font-normal" style={{ color: "#A08070" }}>ใช้ได้ถึง {couponDate(c.campaign.validUntil)}</span>
            </button>
          ))}
        </div>
      )}
      {!value && (
        <div className="flex gap-1.5">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="กรอกโค้ดคูปอง"
            onKeyDown={e => { if (e.key === "Enter") void applyCode(); }}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm uppercase"
            style={{ border: "1px solid #E8D8CC", background: "white" }} />
          <button type="button" onClick={() => void applyCode()} disabled={!code.trim() || loading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
            style={{ background: "#C2410C", color: "white" }}>ใช้โค้ด</button>
        </div>
      )}
      {err && <p className="text-[11px]" style={{ color: "#B91C1C" }}>{err}</p>}
    </div>
  );
}
