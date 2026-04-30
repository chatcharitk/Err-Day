import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findActivePackages } from "@/lib/packages";

// GET /api/liff/membership?lineUserId=xxx
// Public endpoint — returns membership + active package status for a Line user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");

  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where:   { lineUserId },
    include: { membership: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "ไม่พบลูกค้าในระบบ กรุณาจองผ่าน Line ก่อน" }, { status: 404 });
  }

  // Fetch active packages (independent from membership)
  const activePackages = await findActivePackages(customer.id);
  const packagesPayload = activePackages.map(p => ({
    id:           p.id,
    sku:          p.packageSku,
    nameTh:       p.spec.nameTh,
    startedAt:    p.startedAt.toISOString(),
    expiresAt:    p.expiresAt.toISOString(),
    usagesUsed:   p.usagesUsed,
    usageLimit:   p.usageLimit,
    usagesLeft:   p.usagesLeft,
  }));

  // If they have neither membership nor packages, signal "no entitlements"
  if (!customer.membership && packagesPayload.length === 0) {
    return NextResponse.json(
      { error: "ยังไม่มีสมาชิกหรือแพ็กเกจ", packages: [] },
      { status: 404 },
    );
  }

  // Membership block — null when customer has packages but no membership
  let membershipBlock: Record<string, unknown> | null = null;
  if (customer.membership) {
    const { membership } = customer;
    const now = new Date();
    const isExpired = membership.expiresAt ? membership.expiresAt < now : false;
    const isUsagesExhausted =
      membership.usagesAllowed > 0 && membership.usagesUsed >= membership.usagesAllowed;

    membershipBlock = {
      label:             membership.label,
      points:            membership.points,
      activatedAt:       membership.activatedAt.toISOString(),
      expiresAt:         membership.expiresAt?.toISOString() ?? null,
      usagesUsed:        membership.usagesUsed,
      usagesAllowed:     membership.usagesAllowed,
      isExpired,
      isUsagesExhausted,
    };
  }

  // Fetch services that have a member discount (only relevant if membership exists)
  const services = customer.membership ? await prisma.service.findMany({
    where: { isActive: true, memberDiscountPercent: { gt: 0 } },
    select: {
      id: true,
      nameTh: true,
      name: true,
      memberDiscountPercent: true,
      branches: {
        where: { isActive: true },
        select: { price: true },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
    orderBy: { nameTh: "asc" },
  }) : [];

  // ── Backward-compatible response shape ──
  // Older clients destructured top-level membership fields; we keep those
  // present (mirroring the membership block) and also add `membership` and
  // `packages` keys so newer clients can read them directly.
  return NextResponse.json({
    customerName:   customer.name,
    // Spread legacy top-level membership fields (for older clients):
    ...(membershipBlock ?? {
      label:             null,
      points:            0,
      activatedAt:       null,
      expiresAt:         null,
      usagesUsed:        0,
      usagesAllowed:     0,
      isExpired:         false,
      isUsagesExhausted: false,
    }),
    membership: membershipBlock,
    packages:   packagesPayload,
    services: services.map(s => ({
      id:                    s.id,
      nameTh:                s.nameTh || s.name,
      memberDiscountPercent: s.memberDiscountPercent,
      basePrice:             s.branches[0]?.price ?? null,
    })),
  });
}
