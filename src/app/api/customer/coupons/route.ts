import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineAccessToken } from "@/lib/line-auth";
import { CouponError, couponStatus, customerCoupons, issueCoupon, openCampaignsFor } from "@/lib/coupons";

/**
 * POST /api/customer/coupons  { lineAccessToken, claimCampaignId? }
 *
 * No action: this customer's coupons + OPEN campaigns they can still claim.
 * useCouponId: the cashier taps "ใช้คูปอง" on the customer's phone — the coupon is
 *   torn (a use is spent, source APP). It carries no discount by itself: the
 *   cashier then applies it to the bill at POS within a few hours.
 * claimCampaignId: tap "รับคูปอง" on an OPEN campaign. (Codes are entered by
 * staff at the POS, not by customers.)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { lineAccessToken?: unknown; claimCampaignId?: unknown; useCouponId?: unknown } | null;
  const lineProfile = await verifyLineAccessToken(body?.lineAccessToken);
  if (!lineProfile) return NextResponse.json({ error: "invalid_line_session" }, { status: 401 });

  const customer = await prisma.customer.findUnique({ where: { lineUserId: lineProfile.userId }, select: { id: true } });
  const state = async () => ({
    canClaim:  !!customer,
    coupons:   customer ? await customerCoupons(customer.id) : [],
    available: await openCampaignsFor(customer?.id ?? null),
  });

  const useId = typeof body?.useCouponId === "string" ? body.useCouponId : null;
  if (useId) {
    const coupon = customer ? await prisma.coupon.findUnique({ where: { id: useId }, include: { campaign: true } }) : null;
    if (!customer || !coupon || coupon.customerId !== customer.id) {
      return NextResponse.json({ error: "not_found", message: "ไม่พบคูปอง" }, { status: 404 });
    }
    const status = couponStatus(coupon, coupon.campaign);
    if (status !== "usable") {
      return NextResponse.json({ error: "not_usable", message: status === "used" ? "คูปองนี้ใช้ไปแล้ว" : status === "expired" ? "คูปองหมดอายุแล้ว" : "คูปองนี้ใช้ไม่ได้ตอนนี้", ...(await state()) }, { status: 409 });
    }
    // Compare-and-set so a double tap can't spend two uses.
    const spent = await prisma.coupon.updateMany({ where: { id: coupon.id, usesUsed: coupon.usesUsed, voidedAt: null }, data: { usesUsed: { increment: 1 } } });
    if (spent.count !== 1) return NextResponse.json({ error: "busy", message: "คูปองนี้เพิ่งถูกใช้ไป", ...(await state()) }, { status: 409 });
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, source: "APP", discountSatang: 0 } });
    return NextResponse.json({ ...(await state()), used: coupon.id });
  }

  const claimId = typeof body?.claimCampaignId === "string" ? body.claimCampaignId : null;
  if (!claimId) return NextResponse.json(await state());

  if (!customer) {
    return NextResponse.json(
      { error: "customer_not_linked", message: "กรุณาจองคิวหรือสมัครสมาชิกเพื่อเชื่อมบัญชี LINE ก่อนรับคูปอง" },
      { status: 403 },
    );
  }
  const campaign = await prisma.couponCampaign.findUnique({ where: { id: claimId } });
  if (!campaign || campaign.claimMode !== "OPEN") {
    return NextResponse.json({ error: "not_found", message: "ไม่พบคูปอง" }, { status: 404 });
  }
  try {
    const { created } = await issueCoupon(campaign, customer.id, "CLAIM");
    return NextResponse.json({ ...(await state()), claimed: campaign.id, created }, { status: created ? 201 : 200 });
  } catch (e) {
    if (e instanceof CouponError) return NextResponse.json({ error: "cannot_claim", message: e.message }, { status: e.status });
    throw e;
  }
}
