/**
 * Coupon rules shared by the POS (preview) and the server (authoritative).
 * Pure — no Prisma — so client components can import it.
 */

export type DiscountType = "PERCENT" | "AMOUNT";
export type ClaimMode = "OPEN" | "CODE" | "ISSUED";

export const CLAIM_MODE_LABEL: Record<ClaimMode, string> = {
  OPEN:   "ลูกค้ากดรับเองใน LINE",
  CODE:   "ต้องกรอกโค้ด",
  ISSUED: "แอดมินแจกเท่านั้น",
};

/** Membership / package purchases are entitlements, never coupon-discounted. */
export const COUPON_EXCLUDED_SKUS = new Set(["svc-membership-30d", "svc-buffet", "svc-pkg5"]);

export interface CampaignTerms {
  discountType:      string;
  discountValue:     number;
  maxDiscountSatang: number | null;
  minSpendSatang:    number;
  categories:        string[];
}

export interface CouponLine {
  /** Service id when the line is a catalogue service; null for add-ons / custom lines. */
  serviceId:    string | null;
  category:     string | null;
  /** Line total in satang (unit price × qty, after member pricing). */
  amountSatang: number;
}

export interface CouponQuote {
  eligibleSatang: number;
  discountSatang: number;
  /** Why the discount is 0, in Thai — null when it applies. */
  problem:        string | null;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH")}`;

/** What this campaign takes off a cart. */
export function quoteCoupon(terms: CampaignTerms, lines: CouponLine[]): CouponQuote {
  const eligible = lines.filter(l => {
    if (l.amountSatang <= 0) return false;
    if (l.serviceId && COUPON_EXCLUDED_SKUS.has(l.serviceId)) return false;
    if (terms.categories.length === 0) return true;
    return !!l.category && terms.categories.includes(l.category);
  });
  const eligibleSatang = eligible.reduce((s, l) => s + l.amountSatang, 0);
  if (eligibleSatang <= 0) {
    return { eligibleSatang, discountSatang: 0, problem: "ไม่มีรายการที่ใช้คูปองนี้ได้" };
  }
  if (eligibleSatang < terms.minSpendSatang) {
    return { eligibleSatang, discountSatang: 0, problem: `ยอดขั้นต่ำ ${baht(terms.minSpendSatang)}` };
  }
  let discount = terms.discountType === "AMOUNT"
    ? terms.discountValue
    : Math.round(eligibleSatang * terms.discountValue / 100);
  if (terms.discountType !== "AMOUNT" && terms.maxDiscountSatang != null && terms.maxDiscountSatang > 0) {
    discount = Math.min(discount, terms.maxDiscountSatang);
  }
  discount = Math.max(0, Math.min(discount, eligibleSatang));
  return { eligibleSatang, discountSatang: discount, problem: null };
}

/** "ลด 10%" / "ลด ฿100" (+ cap). */
export function couponValueLabel(terms: Pick<CampaignTerms, "discountType" | "discountValue" | "maxDiscountSatang">): string {
  if (terms.discountType === "AMOUNT") return `ลด ${baht(terms.discountValue)}`;
  const cap = terms.maxDiscountSatang ? ` (สูงสุด ${baht(terms.maxDiscountSatang)})` : "";
  return `ลด ${terms.discountValue}%${cap}`;
}

/** Bangkok "YYYY-MM-DD" of a stored campaign date (UTC noon of the day). */
export function ymdOf(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type CampaignPhase = "inactive" | "upcoming" | "active" | "expired";

export function campaignPhase(
  c: { isActive: boolean; validFrom: Date | string; validUntil: Date | string },
  todayYmd: string,
): CampaignPhase {
  if (!c.isActive) return "inactive";
  if (todayYmd < ymdOf(c.validFrom)) return "upcoming";
  if (todayYmd > ymdOf(c.validUntil)) return "expired";
  return "active";
}

/** Thai short date of a stored campaign date, e.g. "30 พ.ย. 69". */
export function couponDate(value: Date | string): string {
  return new Date(ymdOf(value) + "T12:00:00Z").toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit",
  });
}

export function normalizeCode(code: unknown): string {
  return typeof code === "string" ? code.trim().toUpperCase().replace(/\s+/g, "") : "";
}
