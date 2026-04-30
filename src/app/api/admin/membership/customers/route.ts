import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PACKAGE_SPECS } from "@/lib/packages";

/** GET /api/admin/membership/customers
 *
 *  Returns three buckets:
 *    - members  : customers with a Membership row OR active package(s)
 *    - pending  : customers who consented to PDPA via signup but have no active membership/package
 *    - history  : recent MembershipCycle rows (last 100)
 */
export async function GET() {
  const now = new Date();

  // ── Members with a Membership row ───────────────────────────────────
  const memberCustomers = await prisma.customer.findMany({
    where: { membership: { isNot: null } },
    orderBy: { name: "asc" },
    include: {
      membership: { include: { tier: true } },
    },
  });

  const membershipRows = await Promise.all(
    memberCustomers.map(async (c) => {
      const m = c.membership!;
      const [cycleCount, totalCount] = await Promise.all([
        m.activatedAt
          ? prisma.booking.count({
              where: {
                customerId: c.id,
                status:     "COMPLETED",
                date:       { gte: m.activatedAt },
              },
            })
          : 0,
        prisma.booking.count({
          where: { customerId: c.id, status: "COMPLETED" },
        }),
      ]);

      const expired  = m.expiresAt != null && new Date(m.expiresAt) <= now;
      const usedUp   = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      const isValid  = !expired && !usedUp;

      return {
        id:    c.id,
        name:  c.name,
        phone: c.phone,
        kind:  "membership" as const,
        membership: {
          id:           m.id,
          label:        m.label,
          isValid,
          expired,
          usedUp,
          expiresAt:    m.expiresAt?.toISOString() ?? null,
          activatedAt:  m.activatedAt?.toISOString() ?? null,
          usagesAllowed: m.usagesAllowed,
          usagesUsed:   m.usagesUsed,
          points:       m.points,
          tier:         m.tier
            ? { id: m.tier.id, name: m.tier.name, discountPercent: m.tier.discountPercent }
            : null,
        },
        packages:      [] as ReturnType<typeof buildPackageInfo>[],
        cycleBookings: cycleCount,
        totalBookings: totalCount,
      };
    })
  );

  // ── Package-only customers (active package, no Membership row) ───────
  const membershipCustomerIds = new Set(memberCustomers.map(c => c.id));

  const packageCustomers = await prisma.customer.findMany({
    where: {
      membership: null,
      packages: {
        some: {
          closedAt:  null,
          expiresAt: { gt: now },
        },
      },
    },
    orderBy: { name: "asc" },
    include: {
      packages: {
        where: { closedAt: null, expiresAt: { gt: now } },
        orderBy: { expiresAt: "asc" },
      },
    },
  });

  function buildPackageInfo(pkg: { id: string; packageSku: string; startedAt: Date; expiresAt: Date; usagesUsed: number; usageLimit: number }) {
    const spec = PACKAGE_SPECS[pkg.packageSku];
    const usagesLeft = pkg.usageLimit > 0 ? Math.max(0, pkg.usageLimit - pkg.usagesUsed) : null;
    return {
      id:         pkg.id,
      sku:        pkg.packageSku,
      nameTh:     spec?.nameTh ?? pkg.packageSku,
      startedAt:  pkg.startedAt.toISOString(),
      expiresAt:  pkg.expiresAt.toISOString(),
      usagesUsed: pkg.usagesUsed,
      usageLimit: pkg.usageLimit,
      usagesLeft,
      isActive:   usagesLeft === null || usagesLeft > 0,
    };
  }

  const packageRows = await Promise.all(
    packageCustomers
      .filter(c => !membershipCustomerIds.has(c.id))
      .map(async (c) => {
        const activePackages = c.packages
          .map(buildPackageInfo)
          .filter(p => p.isActive);

        if (activePackages.length === 0) return null; // all used up

        const totalCount = await prisma.booking.count({
          where: { customerId: c.id, status: "COMPLETED" },
        });

        return {
          id:           c.id,
          name:         c.name,
          phone:        c.phone,
          kind:         "package" as const,
          membership:   null,
          packages:     activePackages,
          cycleBookings: 0,
          totalBookings: totalCount,
        };
      })
  );

  const members = [
    ...membershipRows,
    ...packageRows.filter((r): r is NonNullable<typeof r> => r !== null),
  ].sort((a, b) => a.name.localeCompare(b.name, "th"));

  // ── Pending signups (PDPA consent given, no active membership or package) ──
  const pendingCustomers = await prisma.customer.findMany({
    where: {
      pdpaConsentAt: { not: null },
      membership:    null,
      packages: {
        none: {
          closedAt:  null,
          expiresAt: { gt: now },
        },
      },
    },
    orderBy: { pdpaConsentAt: "desc" },
    select: {
      id:            true,
      name:          true,
      phone:         true,
      email:         true,
      pdpaConsentAt: true,
      pdpaSource:    true,
    },
  });

  const pending = pendingCustomers.map(c => ({
    id:          c.id,
    name:        c.name,
    phone:       c.phone,
    email:       c.email,
    consentedAt: c.pdpaConsentAt?.toISOString() ?? null,
    source:      c.pdpaSource ?? "signup",
  }));

  // ── Cycle history ──────────────────────────────────────────────────
  const cycles = await prisma.membershipCycle.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  const history = cycles.map(cy => ({
    id:            cy.id,
    customerId:    cy.customerId,
    customerName:  cy.customer.name,
    customerPhone: cy.customer.phone,
    startedAt:     cy.startedAt.toISOString(),
    endedAt:       cy.endedAt.toISOString(),
    closedAt:      cy.closedAt?.toISOString() ?? null,
    paidAmount:    cy.paidAmount,
    paymentMethod: cy.paymentMethod,
    bookingsUsed:  cy.bookingsUsed,
  }));

  return NextResponse.json({ members, pending, history });
}
