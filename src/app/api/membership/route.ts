import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findActivePackages } from "@/lib/packages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const customer = await prisma.customer.findUnique({
    where: { phone },
    include: {
      membership: { include: { tier: true } },
      bookings: {
        where: { status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        include: { service: true, branch: true },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const activePackages = await findActivePackages(customer.id);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const membership = customer.membership;
  const hasActiveMembership = !!membership
    && !membership.pendingActivation
    && (!membership.expiresAt || membership.expiresAt >= today)
    && (membership.usagesAllowed === 0 || membership.usagesUsed < membership.usagesAllowed);
  return NextResponse.json({
    ...customer,
    // Active packages receive the same service pricing as the ฿990 membership,
    // even when the selected service is not redeemed from the package.
    hasMemberPricing: hasActiveMembership || activePackages.length > 0,
    packages: activePackages.map(p => ({
      id:               p.id,
      sku:              p.packageSku,
      nameTh:           p.spec.nameTh,
      coversServiceIds: p.spec.coversServiceIds,
      startedAt:        p.startedAt.toISOString(),
      expiresAt:        p.expiresAt.toISOString(),
      usagesUsed:       p.usagesUsed,
      usageLimit:       p.usageLimit,
      usagesLeft:       p.usagesLeft,
    })),
  });
}

export async function POST(request: Request) {
  const { phone, name } = await request.json();
  if (!phone || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const bronzeTier = await prisma.membershipTier.findFirst({ where: { id: "tier-bronze" } });
  if (!bronzeTier) return NextResponse.json({ error: "Tiers not set up" }, { status: 500 });

  const customer = await prisma.customer.upsert({
    where: { phone },
    update: {},
    create: { name, phone },
  });

  const membership = await prisma.membership.upsert({
    where: { customerId: customer.id },
    update: {},
    // Registration alone is not payment. POS/admin activation must explicitly
    // clear this flag before member pricing is granted.
    create: { customerId: customer.id, tierId: bronzeTier.id, points: 0, pendingActivation: true },
    include: { tier: true },
  });

  return NextResponse.json({ customer, membership }, { status: 201 });
}
