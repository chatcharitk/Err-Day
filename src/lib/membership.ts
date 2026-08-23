import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

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

/**
 * "Pay now, activate later." The customer buys a membership at POS but wants
 * the 30-day window to start on a LATER visit — so we record the payment but
 * park the membership as `pendingActivation` (clock not running, expiresAt
 * null). While pending the app treats them as NOT a member (no member pricing)
 * exactly like a not-yet-paid LIFF signup — see [[errday-paid-split]].
 *
 * Records the prepayment as an OPEN MembershipCycle (paidAmount + POS bookingId)
 * so it shows in purchase history; its startedAt/endedAt are placeholders that
 * activateHeldMembership() rewrites to the real 30-day window on activation.
 *
 * Guard: never overwrite an already-ACTIVE membership to pending (that would
 * silently strip a paying member's benefits). In that rare case we keep the
 * active membership untouched and just log the extra payment cycle.
 */
export async function holdMembershipPrepaid(opts: ActivateOpts) {
  const {
    customerId,
    paidAmount     = MEMBERSHIP_PRICE_SATANG,
    paymentMethod = "POS",
    bookingId     = null,
    notes,
  } = opts;

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { customerId } });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const activeAlready = !!existing
      && !existing.pendingActivation
      && (existing.expiresAt == null || existing.expiresAt >= today)
      && !(existing.usagesAllowed > 0 && existing.usagesUsed >= existing.usagesAllowed);

    const membership = activeAlready
      ? existing!  // leave an active membership as-is
      : await tx.membership.upsert({
          where:  { customerId },
          update: { activatedAt: now, expiresAt: null, usagesUsed: 0, pendingActivation: true },
          create: { customerId, activatedAt: now, expiresAt: null, usagesUsed: 0, pendingActivation: true },
        });

    const cycle = await tx.membershipCycle.create({
      data: {
        customerId,
        membershipId: membership.id,
        startedAt:    now,
        endedAt:      now, // placeholder — rewritten to the real window on activation
        paidAmount,
        paymentMethod,
        bookingId,
        notes: notes ?? "รับเงินล่วงหน้า — รอเปิดใช้งาน",
      },
    });

    return { membership, cycle, heldOverActive: activeAlready };
  });
}

/**
 * Core of activating a held (pre-paid, pending) membership, parameterized on
 * the window's start date and the db/tx client so it can run either standalone
 * (the "เปิดใช้งาน" button) or inside an existing booking-creation transaction
 * (see applyMembershipPricingForBooking). Rewrites the open prepayment cycle's
 * placeholder window to match, so purchase history reads correctly.
 */
async function activateHeldMembershipTx(tx: Db, customerId: string, startDate: Date) {
  const expiresAt = new Date(startDate.getTime() + (MEMBERSHIP_VALIDITY_DAYS - 1) * 24 * 60 * 60 * 1000);

  const membership = await tx.membership.update({
    where: { customerId },
    data:  { activatedAt: startDate, expiresAt, usagesUsed: 0, pendingActivation: false },
  });
  // Rewrite the held (still-open) cycle's placeholder window to the real
  // 30 days. If there was no held cycle (e.g. a manual pending entry), this
  // simply affects nothing.
  await tx.membershipCycle.updateMany({
    where: { membershipId: membership.id, closedAt: null },
    data:  { startedAt: startDate, endedAt: expiresAt },
  });
  return membership;
}

/**
 * Activate a held (pre-paid, pending) membership — the return-visit step. Starts
 * a fresh 30-day window from `startDate` (defaults to now). Used by the
 * "เปิดใช้งาน" button on the customer screen.
 */
export async function activateHeldMembership(customerId: string, startDate: Date = new Date()) {
  return prisma.$transaction((tx) => activateHeldMembershipTx(tx, customerId, startDate));
}

/**
 * Decide member pricing for a booking being created, and — if the customer's
 * membership is a held/pre-paid one (`pendingActivation`) — auto-activate it
 * using the booking's own date as the 30-day window's start. This is what lets
 * a customer who paid in advance get member pricing (and start their clock) on
 * their next visit, instead of requiring a separate manual activation step.
 * Must be called with the same `tx` the booking is being created in, so the
 * activation and the booking insert commit atomically.
 */
export async function applyMembershipPricingForBooking(
  tx: Db,
  customerId: string,
  bookingDate: Date,
): Promise<{ isActiveMember: boolean; activatedNow: boolean }> {
  const membership = await tx.membership.findUnique({
    where:  { customerId },
    select: { expiresAt: true, usagesAllowed: true, usagesUsed: true, pendingActivation: true },
  });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const isCurrentlyActive = !!membership
    && !membership.pendingActivation
    && (!membership.expiresAt || membership.expiresAt >= today)
    && (membership.usagesAllowed === 0 || membership.usagesUsed < membership.usagesAllowed);
  if (isCurrentlyActive) return { isActiveMember: true, activatedNow: false };

  if (membership?.pendingActivation) {
    await activateHeldMembershipTx(tx, customerId, bookingDate);
    return { isActiveMember: true, activatedNow: true };
  }
  return { isActiveMember: false, activatedNow: false };
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
