import { prisma } from "@/lib/prisma";
import { bangkokTodayKey } from "@/lib/member-pricing";
import { couponStatus } from "@/lib/coupons";
import { campaignPhase, ymdOf } from "@/lib/coupon-rules";
import CouponsManager from "./CouponsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "คูปอง — err.day" };

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: selectedId } = await searchParams;
  const today = bangkokTodayKey();
  const [campaigns, usedAgg, categories, selected] = await Promise.all([
    prisma.couponCampaign.findMany({
      orderBy: [{ isActive: "desc" }, { validUntil: "desc" }],
      include: { _count: { select: { coupons: true } } },
    }),
    prisma.couponRedemption.groupBy({
      by: ["couponId"], where: { reversedAt: null }, _count: { _all: true }, _sum: { discountSatang: true },
    }),
    prisma.service.findMany({ where: { isActive: true }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    selectedId ? prisma.couponCampaign.findUnique({
      where: { id: selectedId },
      include: {
        coupons: {
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, name: true, nickname: true, phone: true } },
            redemptions: {
              orderBy: { createdAt: "desc" },
              include: { booking: { select: { id: true, date: true, totalPrice: true, branch: { select: { name: true } } } } },
            },
          },
        },
      },
    }) : null,
  ]);

  // Redemption totals per campaign (via coupon → campaign).
  const couponCampaign = new Map(
    (await prisma.coupon.findMany({ where: { id: { in: usedAgg.map(u => u.couponId) } }, select: { id: true, campaignId: true } }))
      .map(c => [c.id, c.campaignId]),
  );
  const totals = new Map<string, { uses: number; discount: number }>();
  for (const u of usedAgg) {
    const cid = couponCampaign.get(u.couponId);
    if (!cid) continue;
    const t = totals.get(cid) ?? { uses: 0, discount: 0 };
    t.uses += u._count._all;
    t.discount += u._sum.discountSatang ?? 0;
    totals.set(cid, t);
  }

  return (
    <CouponsManager
      today={today}
      categories={categories.map(c => c.category).filter(Boolean)}
      campaigns={campaigns.map(c => ({
        id: c.id, code: c.code, name: c.name, description: c.description,
        discountType: c.discountType, discountValue: c.discountValue,
        maxDiscountSatang: c.maxDiscountSatang, minSpendSatang: c.minSpendSatang, categories: c.categories,
        validFrom: ymdOf(c.validFrom), validUntil: ymdOf(c.validUntil),
        claimMode: c.claimMode, usesPerCoupon: c.usesPerCoupon, maxClaims: c.maxClaims, isActive: c.isActive,
        phase: campaignPhase(c, today),
        issued: c._count.coupons,
        uses: totals.get(c.id)?.uses ?? 0,
        discountSatang: totals.get(c.id)?.discount ?? 0,
      }))}
      selected={selected ? {
        id: selected.id,
        coupons: selected.coupons.map(k => ({
          id: k.id, source: k.source, createdAt: k.createdAt.toISOString(),
          usesAllowed: k.usesAllowed, usesUsed: k.usesUsed, voided: !!k.voidedAt,
          status: couponStatus(k, selected, today),
          customer: { id: k.customer.id, name: k.customer.nickname || k.customer.name, phone: k.customer.phone },
          redemptions: k.redemptions.map(r => ({
            id: r.id, at: r.createdAt.toISOString(), discountSatang: r.discountSatang, reversed: !!r.reversedAt,
            bookingId: r.booking.id, branch: r.booking.branch.name, billSatang: r.booking.totalPrice,
          })),
        })),
      } : null}
    />
  );
}
