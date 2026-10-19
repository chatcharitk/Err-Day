import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { parseCampaignInput } from "@/lib/coupon-admin";
import { CouponError, couponStatus, issueCoupon } from "@/lib/coupons";
import { sendCouponsReceived } from "@/lib/notifications";
import { VOTE_EVENT } from "@/lib/staff-vote";
import type { Prisma } from "@/generated/prisma/client";

/** PATCH /api/admin/coupons/[id] — edit campaign fields (partial). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const parsed = parseCampaignInput(b, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.data.code) {
    const clash = await prisma.couponCampaign.findFirst({ where: { code: parsed.data.code as string, NOT: { id } }, select: { id: true } });
    if (clash) return NextResponse.json({ error: "โค้ดนี้ถูกใช้แล้ว" }, { status: 409 });
  }
  try {
    const campaign = await prisma.couponCampaign.update({ where: { id }, data: parsed.data as Prisma.CouponCampaignUpdateInput });
    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

/**
 * POST /api/admin/coupons/[id] — actions on a campaign's coupons:
 *   { action: "issue", customerId }                 one customer
 *   { action: "bulk", audience: "VOTERS"|"LINE" }   everyone in a group (skips holders)
 *   { action: "use", couponId }                    admin tears the coupon (same as the customer's app button)
 *   { action: "void" | "unvoid", couponId }
 *   { action: "reverse", redemptionId }             give a used coupon back (refund / mistake)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const campaign = await prisma.couponCampaign.findUnique({ where: { id } });
  if (!b || !campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    switch (b.action) {
      case "issue": {
        if (typeof b.customerId !== "string") return NextResponse.json({ error: "กรุณาเลือกลูกค้า" }, { status: 400 });
        const { coupon, created } = await issueCoupon(campaign, b.customerId, "ADMIN", admin.id);
        // Tell the customer on LINE (card + button into the app).
        if (created && b.notify !== false) after(() => sendCouponsReceived([coupon.id]).catch(e => console.error("[notify] coupon received failed", e)));
        return NextResponse.json({ ok: true, created, notified: created && b.notify !== false });
      }
      case "bulk": {
        const where: Prisma.CustomerWhereInput =
          b.audience === "VOTERS" ? { staffVotes: { some: { eventKey: VOTE_EVENT.key } } }
          : b.audience === "LINE" ? { lineUserId: { not: null } }
          : { id: "__none__" };
        const customers = await prisma.customer.findMany({
          where: { ...where, coupons: { none: { campaignId: campaign.id } } },
          select: { id: true },
        });
        let ids = customers.map(c => c.id);
        if (campaign.maxClaims != null) {
          const have = await prisma.coupon.count({ where: { campaignId: campaign.id } });
          ids = ids.slice(0, Math.max(0, campaign.maxClaims - have));
        }
        const res = await prisma.coupon.createMany({
          data: ids.map(customerId => ({
            campaignId: campaign.id, customerId, source: "BULK", usesAllowed: campaign.usesPerCoupon, issuedById: admin.id,
          })),
          skipDuplicates: true,
        });
        if (res.count > 0 && b.notify !== false) {
          const fresh = await prisma.coupon.findMany({ where: { campaignId: campaign.id, customerId: { in: ids }, source: "BULK" }, select: { id: true } });
          after(() => sendCouponsReceived(fresh.map(c => c.id)).catch(e => console.error("[notify] coupon received failed", e)));
        }
        return NextResponse.json({ ok: true, issued: res.count, notified: res.count > 0 && b.notify !== false });
      }
      case "use": {
        if (typeof b.couponId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        const coupon = await prisma.coupon.findFirst({ where: { id: b.couponId, campaignId: campaign.id } });
        if (!coupon) return NextResponse.json({ error: "ไม่พบคูปอง" }, { status: 404 });
        const status = couponStatus(coupon, campaign);
        if (status !== "usable") return NextResponse.json({ error: status === "used" ? "คูปองนี้ใช้ไปแล้ว" : "คูปองนี้ใช้ไม่ได้ตอนนี้" }, { status: 409 });
        const spent = await prisma.coupon.updateMany({ where: { id: coupon.id, usesUsed: coupon.usesUsed, voidedAt: null }, data: { usesUsed: { increment: 1 } } });
        if (spent.count !== 1) return NextResponse.json({ error: "คูปองนี้เพิ่งถูกใช้ไป" }, { status: 409 });
        // Torn without a bill yet — POS attaches it to the sale (within 3 h), like the in-app button.
        await prisma.couponRedemption.create({ data: { couponId: coupon.id, source: "APP", discountSatang: 0, adminId: admin.id } });
        return NextResponse.json({ ok: true });
      }
      case "void":
      case "unvoid": {
        if (typeof b.couponId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        await prisma.coupon.updateMany({
          where: { id: b.couponId, campaignId: campaign.id },
          data:  { voidedAt: b.action === "void" ? new Date() : null },
        });
        return NextResponse.json({ ok: true });
      }
      case "reverse": {
        if (typeof b.redemptionId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        const r = await prisma.couponRedemption.findUnique({ where: { id: b.redemptionId }, include: { coupon: true } });
        if (!r || r.coupon.campaignId !== campaign.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
        if (r.reversedAt) return NextResponse.json({ ok: true });
        await prisma.$transaction([
          prisma.couponRedemption.update({ where: { id: r.id }, data: { reversedAt: new Date() } }),
          prisma.coupon.update({ where: { id: r.couponId }, data: { usesUsed: { decrement: 1 } } }),
        ]);
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (e) {
    if (e instanceof CouponError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
