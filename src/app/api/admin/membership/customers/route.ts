import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/membership/customers
 *
 *  Returns three buckets:
 *    - members  : customers with a Membership row (active or expired)
 *    - pending  : customers who consented to PDPA via signup but have no Membership yet
 *    - history  : recent MembershipCycle rows (last 100)
 */
export async function GET() {
  // ── Members (have a Membership row) ─────────────────────────────────
  const memberCustomers = await prisma.customer.findMany({
    where: { membership: { isNot: null } },
    orderBy: { name: "asc" },
    include: {
      membership: { include: { tier: true } },
    },
  });

  const members = await Promise.all(
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

      const now      = new Date();
      const expired  = m.expiresAt != null && new Date(m.expiresAt) <= now;
      const usedUp   = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      const isValid  = !expired && !usedUp;

      return {
        id:    c.id,
        name:  c.name,
        phone: c.phone,
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
        cycleBookings: cycleCount,
        totalBookings: totalCount,
      };
    })
  );

  // ── Pending signups (PDPA consent given, no active membership or package) ──
  const now = new Date();
  const pendingCustomers = await prisma.customer.findMany({
    where: {
      pdpaConsentAt: { not: null },
      membership:    null,
      // Also exclude customers who have already purchased an active package
      packages: {
        none: {
          closedAt:  null,
          expiresAt: { gt: now },
        },
      },
    },
    orderBy: { pdpaConsentAt: "desc" },
    select: {
      id:           true,
      name:         true,
      phone:        true,
      email:        true,
      pdpaConsentAt: true,
      pdpaSource:   true,
    },
  });

  const pending = pendingCustomers.map(c => ({
    id:           c.id,
    name:         c.name,
    phone:        c.phone,
    email:        c.email,
    consentedAt:  c.pdpaConsentAt?.toISOString() ?? null,
    source:       c.pdpaSource ?? "signup",
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
