import { prisma } from "@/lib/prisma";
import { isHeldCycle } from "@/lib/membership";

export interface HeldMembership {
  /** When the prepayment was taken (the POS sale). */
  paidAt: string;
  /** End of the membership still running, if the customer is a member now —
   *  the held period then starts the day after it. null = no current period. */
  currentExpiresAt: string | null;
}

/**
 * Customers who have PAID for a membership that is not switched on yet — the
 * "pay now, activate later" hold. Both cases count:
 *   - no current membership, held one waiting (membership.pendingActivation);
 *   - still a member, next period prepaid and waiting.
 * Only paid holds (open POS cycle whose sale has paidAt): an unpaid app signup
 * is also pendingActivation, but there is nothing to activate.
 */
export async function loadHeldMemberships(customerIds: string[]): Promise<Map<string, HeldMembership>> {
  const out = new Map<string, HeldMembership>();
  const ids = [...new Set(customerIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const cycles = await prisma.membershipCycle.findMany({
    where: { customerId: { in: ids }, closedAt: null, paymentMethod: "POS", bookingId: { not: null } },
    select: {
      customerId: true, bookingId: true, startedAt: true, endedAt: true, closedAt: true,
      membership: { select: { pendingActivation: true, expiresAt: true } },
    },
  });
  const candidates = cycles.filter(c => isHeldCycle(c) || c.membership.pendingActivation);
  if (candidates.length === 0) return out;

  const paid = await prisma.booking.findMany({
    where: { id: { in: candidates.map(c => c.bookingId!) }, paidAt: { not: null } },
    select: { id: true, paidAt: true },
  });
  const paidAt = new Map(paid.map(b => [b.id, b.paidAt!]));

  const today0 = new Date(); today0.setUTCHours(0, 0, 0, 0);
  for (const c of candidates) {
    const p = paidAt.get(c.bookingId!);
    if (!p || out.has(c.customerId)) continue;
    out.set(c.customerId, {
      paidAt: p.toISOString(),
      currentExpiresAt: !c.membership.pendingActivation && c.membership.expiresAt && c.membership.expiresAt >= today0
        ? c.membership.expiresAt.toISOString() : null,
    });
  }
  return out;
}
