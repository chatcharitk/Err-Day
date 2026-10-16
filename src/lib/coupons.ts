import { prisma } from "@/lib/prisma";
import { bangkokTodayKey } from "@/lib/member-pricing";
import { campaignPhase, type CampaignPhase } from "@/lib/coupon-rules";
import type { Coupon, CouponCampaign } from "@/generated/prisma/client";

/**
 * Coupon server helpers. A customer holds at most one coupon per campaign
 * (database unique key); each POS use is a CouponRedemption.
 */

export type CouponStatus = "usable" | "upcoming" | "used" | "expired" | "void";

export function couponStatus(coupon: Pick<Coupon, "usesAllowed" | "usesUsed" | "voidedAt">, campaign: CouponCampaign, today = bangkokTodayKey()): CouponStatus {
  if (coupon.voidedAt) return "void";
  if (coupon.usesUsed >= coupon.usesAllowed) return "used";
  const phase: CampaignPhase = campaignPhase(campaign, today);
  if (phase === "expired") return "expired";
  if (phase === "inactive") return "void";
  if (phase === "upcoming") return "upcoming";
  return "usable";
}

/** Public shape of a campaign for customer / POS screens. */
export function campaignView(c: CouponCampaign) {
  return {
    id:                c.id,
    code:              c.code,
    name:              c.name,
    description:       c.description,
    discountType:      c.discountType,
    discountValue:     c.discountValue,
    maxDiscountSatang: c.maxDiscountSatang,
    minSpendSatang:    c.minSpendSatang,
    categories:        c.categories,
    validFrom:         c.validFrom.toISOString(),
    validUntil:        c.validUntil.toISOString(),
    claimMode:         c.claimMode,
  };
}

export async function customerCoupons(customerId: string) {
  const today = bangkokTodayKey();
  const rows = await prisma.coupon.findMany({
    where:   { customerId },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({
    id:          r.id,
    status:      couponStatus(r, r.campaign, today),
    usesAllowed: r.usesAllowed,
    usesUsed:    r.usesUsed,
    createdAt:   r.createdAt.toISOString(),
    campaign:    campaignView(r.campaign),
  }));
}

/** Campaigns this customer can still tap "รับคูปอง" on (OPEN mode, running, not yet held). */
export async function openCampaignsFor(customerId: string | null) {
  const today = bangkokTodayKey();
  const rows = await prisma.couponCampaign.findMany({
    where: {
      isActive: true, claimMode: "OPEN",
      ...(customerId ? { coupons: { none: { customerId } } } : {}),
    },
    include: { _count: { select: { coupons: true } } },
    orderBy: { validUntil: "asc" },
  });
  return rows
    .filter(c => campaignPhase(c, today) === "active" && (c.maxClaims == null || c._count.coupons < c.maxClaims))
    .map(campaignView);
}

export class CouponError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/**
 * Give `customerId` a coupon from `campaign`. Idempotent — an existing coupon
 * is returned as-is. Throws CouponError (Thai message) when it can't be issued.
 */
export async function issueCoupon(
  campaign: CouponCampaign,
  customerId: string,
  source: "CLAIM" | "CODE" | "ADMIN" | "BULK",
  issuedById?: string,
) {
  const existing = await prisma.coupon.findUnique({
    where: { campaignId_customerId: { campaignId: campaign.id, customerId } },
  });
  if (existing) return { coupon: existing, created: false };

  // Admin may hand out an upcoming campaign early; customers only while it runs.
  const phase = campaignPhase(campaign, bangkokTodayKey());
  if (phase === "inactive") throw new CouponError("คูปองนี้ปิดใช้งานอยู่");
  if (phase === "expired") throw new CouponError("คูปองนี้หมดอายุแล้ว");
  if (phase === "upcoming" && source !== "ADMIN" && source !== "BULK") throw new CouponError("คูปองนี้ยังไม่เริ่ม");
  if (campaign.maxClaims != null) {
    const n = await prisma.coupon.count({ where: { campaignId: campaign.id } });
    if (n >= campaign.maxClaims) throw new CouponError("คูปองนี้ถูกรับครบจำนวนแล้ว");
  }
  try {
    const coupon = await prisma.coupon.create({
      data: { campaignId: campaign.id, customerId, source, usesAllowed: campaign.usesPerCoupon, issuedById },
    });
    return { coupon, created: true };
  } catch {
    // Lost a race with a parallel claim — the unique key kept it to one.
    const again = await prisma.coupon.findUnique({
      where: { campaignId_customerId: { campaignId: campaign.id, customerId } },
    });
    if (again) return { coupon: again, created: false };
    throw new CouponError("รับคูปองไม่สำเร็จ", 500);
  }
}
