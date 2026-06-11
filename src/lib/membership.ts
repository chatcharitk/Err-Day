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
/**
 * Resolve a set of booking ids to their branch id. Membership cycles and
 * customer packages store the POS `bookingId` that activated them, and that
 * booking carries the selling branch — so this is how we learn "where it was
 * bought" without a dedicated column. Returns Map<bookingId, branchId>.
 */
export async function getBranchByBookingIds(
  bookingIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(bookingIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return new Map();
  const bookings = await prisma.booking.findMany({
    where:  { id: { in: ids } },
    select: { id: true, branchId: true },
  });
  return new Map(bookings.map((b) => [b.id, b.branchId]));
}

/**
 * Derive the branch each customer most recently bought/renewed their membership
 * at — from the latest MembershipCycle that has a linked POS booking. Manual
 * admin entries (no booking) are omitted, so their branch reads as "unknown".
 * Batched (2 queries total) to avoid N+1 in lists / the dashboard.
 */
export async function getMembershipBranchByCustomer(
  customerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (customerIds.length === 0) return out;

  const cycles = await prisma.membershipCycle.findMany({
    where:   { customerId: { in: customerIds }, bookingId: { not: null } },
    orderBy: { startedAt: "desc" },
    select:  { customerId: true, bookingId: true },
  });

  // Keep only the most recent cycle (with a booking) per customer.
  const latestBooking = new Map<string, string>();
  for (const c of cycles) {
    if (c.bookingId && !latestBooking.has(c.customerId)) {
      latestBooking.set(c.customerId, c.bookingId);
    }
  }

  const branchByBooking = await getBranchByBookingIds([...latestBooking.values()]);
  for (const [customerId, bookingId] of latestBooking) {
    const branchId = branchByBooking.get(bookingId);
    if (branchId) out.set(customerId, branchId);
  }
  return out;
}

export async function activateOrRenewMembership(opts: ActivateOpts) {
  const {
    customerId,
    paidAmount     = MEMBERSHIP_PRICE_SATANG,
    paymentMethod = "POS",
    bookingId     = null,
    notes,
  } = opts;

  const now       = new Date();
  // Inclusive expiry: today counts as day 1, so add (DAYS - 1) more days.
  // 30-day membership activated May 9 → expires Jun 7 (valid through end of Jun 7).
  const expiresAt = new Date(now.getTime() + (MEMBERSHIP_VALIDITY_DAYS - 1) * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { customerId } });
    // Renewal = the customer already had a fully-activated membership (not a
    // first-time activation, and not a pending LIFF self-signup awaiting payment).
    const renewed = !!existing?.activatedAt && !existing.pendingActivation;

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

    // Upsert membership with fresh dates. pendingActivation is forced false so
    // that a membership created in a "pending" state at LIFF self-signup becomes
    // fully active once staff complete the sale at POS.
    const membership = await tx.membership.upsert({
      where:  { customerId },
      update: {
        activatedAt:       now,
        expiresAt,
        usagesUsed:        0,
        pendingActivation: false,
      },
      create: {
        customerId,
        activatedAt:       now,
        expiresAt,
        usagesUsed:        0,
        pendingActivation: false,
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

    return { membership, cycle, renewed };
  });
}
