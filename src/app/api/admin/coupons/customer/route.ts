import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { CouponError, customerCoupons, issueCoupon } from "@/lib/coupons";
import { normalizeCode } from "@/lib/coupon-rules";

/** GET /api/admin/coupons/customer?phone= — the customer's coupons, for the POS. */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const phone = new URL(request.url).searchParams.get("phone")?.trim();
  if (!phone) return NextResponse.json({ coupons: [] });
  const customer = await prisma.customer.findUnique({ where: { phone }, select: { id: true } });
  return NextResponse.json({ coupons: customer ? await customerCoupons(customer.id) : [] });
}

/**
 * POST /api/admin/coupons/customer { phone, code } — the customer says a code
 * at the counter: issue that campaign's coupon to them (any claim mode — staff
 * are the gatekeeper here) and return their coupons.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as { phone?: unknown; code?: unknown } | null;
  const phone = typeof b?.phone === "string" ? b.phone.trim() : "";
  const code = normalizeCode(b?.code);
  if (!phone) return NextResponse.json({ error: "เลือกลูกค้าที่มีเบอร์โทรก่อนใช้คูปอง" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "กรุณากรอกโค้ด" }, { status: 400 });
  const [customer, campaign] = await Promise.all([
    prisma.customer.findUnique({ where: { phone }, select: { id: true } }),
    prisma.couponCampaign.findUnique({ where: { code } }),
  ]);
  if (!customer) return NextResponse.json({ error: "ไม่พบลูกค้าเบอร์นี้ในระบบ" }, { status: 404 });
  if (!campaign) return NextResponse.json({ error: "ไม่พบโค้ดนี้" }, { status: 404 });
  try {
    await issueCoupon(campaign, customer.id, "CODE", gate.id);
  } catch (e) {
    if (e instanceof CouponError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ coupons: await customerCoupons(customer.id), campaignId: campaign.id });
}
