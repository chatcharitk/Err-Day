import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineAccessToken } from "@/lib/line-auth";
import { CouponError, customerCoupons, issueCoupon, openCampaignsFor } from "@/lib/coupons";

/**
 * POST /api/customer/coupons  { lineAccessToken, claimCampaignId? }
 *
 * No action: this customer's coupons + OPEN campaigns they can still claim.
 * claimCampaignId: tap "รับคูปอง" on an OPEN campaign. (Codes are entered by
 * staff at the POS, not by customers.)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { lineAccessToken?: unknown; claimCampaignId?: unknown } | null;
  const lineProfile = await verifyLineAccessToken(body?.lineAccessToken);
  if (!lineProfile) return NextResponse.json({ error: "invalid_line_session" }, { status: 401 });

  const customer = await prisma.customer.findUnique({ where: { lineUserId: lineProfile.userId }, select: { id: true } });
  const state = async () => ({
    canClaim:  !!customer,
    coupons:   customer ? await customerCoupons(customer.id) : [],
    available: await openCampaignsFor(customer?.id ?? null),
  });

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
