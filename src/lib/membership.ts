import { prisma } from "@/lib/prisma";

/** SKU for the 30-day membership service. Sold at POS to activate / renew. */
export const MEMBERSHIP_SKU = "svc-membership-30d";

/** Days a 30-day membership lasts. Single source of truth. */
export const MEMBERSHIP_VALIDITY_DAYS = 30;

/** Default amount in satang for the 30-day membership (฿990). */
export const MEMBERSHIP_PRICE_SATANG = 99000;

interface ActivateOpts {
  customerId:    string;
  paidAmount?:   number;        // satang; defaults to MEMBERSHIP_PRICE_SATANG
  paymentMethod?: "POS" | "PromptPay" | "Manual";
  bookingId?:    string | null; // POS Booking that triggered activation
  notes?:        string;
}

/**
 * Activate or renew a customer's 30-day membership.
 *
 * Behaviour:
 *  - Closes the previous active cycle (if any) — sets `closedAt` and snapshots `bookingsUsed`.
 *  - Updates / creates the Membership row with fresh `activatedAt` and `expiresAt`.
 *  - Inserts a new MembershipCycle row.
 *  - Returns the updated membership and the new cycle.
 *
 * Idempotent only in the sense that calling twice creates two cycles.
 * Callers should already have validated the trigger (e.g. POS sale containing
 * the membership SKU).
 */
export async function activateOrRenewMembership(opts: ActivateOpts) {
  const {
    customerId,
    paidAmount     = MEMBERSHIP_PRICE_SATANG,
    paymentMethod = "POS",
    bookingId     = null,
    notes,
  } = opts;

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + MEMBERSHIP_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { customerId } });

    // Close any open cycle of this membership
    if (existing) {
      const bookingsUsed = await tx.booking.count({
        where: {
          customerId,
          status: "COMPLETED",
          ...(existing.activatedAt ? { date: { gte: existing.activatedAt } } : {}),
        },
      });
      await tx.membershipCycle.updateMany({
        where: { membershipId: existing.id, closedAt: null },
        data:  { closedAt: now, bookingsUsed },
      });
    }

    // Upsert membership with fresh dates
    const membership = await tx.membership.upsert({
      where:  { customerId },
      update: {
        activatedAt: now,
        expiresAt,
        usagesUsed:  0,
      },
      create: {
        customerId,
        activatedAt: now,
        expiresAt,
        usagesUsed:  0,
        // tierId left null — flat membership
      },
    });

    // Create new cycle row
    const cycle = await tx.membershipCycle.create({
      data: {
        customerId,
        membershipId: membership.id,
        startedAt:    now,
        endedAt:      expiresAt,
        paidAmount,
        paymentMethod,
        bookingId,
        notes,
      },
    });

    return { membership, cycle };
  });
}
