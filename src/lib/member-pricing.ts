import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Member pricing is decided by the APPOINTMENT date, not by when the booking
 * was made or viewed. A membership/package that expires before the visit gives
 * no discount on it; one that starts before the visit (renewed, activated at
 * the counter, bought after the booking) does. Everything that prices a booking
 * should ask `hasMemberPricingOnDate` rather than looking at "is a member now".
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Bangkok calendar day ("YYYY-MM-DD") of an instant. Booking dates are stored
 *  at UTC noon of their Bangkok day, which maps back to the same day. */
export function bangkokYmdOf(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

export function bangkokTodayKey(): string {
  return bangkokYmdOf(new Date());
}

interface MembershipFacts {
  activatedAt:       Date;
  expiresAt:         Date | null;
  pendingActivation: boolean;
  usagesAllowed:     number;
  usagesUsed:        number;
  cycles:            { startedAt: Date; endedAt: Date }[];
}

interface PackageFacts {
  startedAt:         Date;
  expiresAt:         Date;
  closedAt:          Date | null;
  pendingActivation: boolean;
  usageLimit:        number;
  usagesUsed:        number;
}

/** A pre-paid "activate later" membership parks a cycle whose start and end are
 *  the same instant — it is not a real coverage window. */
const isPlaceholderCycle = (c: { startedAt: Date; endedAt: Date }) =>
  c.endedAt.getTime() - c.startedAt.getTime() < 60_000;

/** Pure rule — exported for tests and the audit script. */
export function memberPricingOnDate(
  membership: MembershipFacts | null,
  packages: PackageFacts[],
  ymd: string,
  today: string = bangkokTodayKey(),
): boolean {
  if (membership) {
    // Remaining-usage caps only matter for visits that haven't happened yet.
    const exhausted = membership.usagesAllowed > 0 && membership.usagesUsed >= membership.usagesAllowed;
    if (!(exhausted && ymd >= today)) {
      // Real purchased windows (history) — still counts after a later renewal
      // or while a new pre-paid membership waits to be activated.
      const inCycle = membership.cycles.some(
        (c) => !isPlaceholderCycle(c) && bangkokYmdOf(c.startedAt) <= ymd && ymd <= bangkokYmdOf(c.endedAt),
      );
      if (inCycle) return true;
      // The membership row itself (covers manual admin edits with no cycle).
      if (!membership.pendingActivation) {
        const started = bangkokYmdOf(membership.activatedAt) <= ymd;
        const notEnded = membership.expiresAt == null || bangkokYmdOf(membership.expiresAt) >= ymd;
        if (started && notEnded) return true;
      }
    }
  }
  for (const p of packages) {
    if (p.pendingActivation) continue;
    if (p.usageLimit > 0 && p.usagesUsed >= p.usageLimit && ymd >= today) continue;
    // A package replaced by a renewal is closed at that instant — the
    // replacement covers the days after, so cap this one's window there.
    const endsAt = p.closedAt && p.closedAt < p.expiresAt ? p.closedAt : p.expiresAt;
    if (bangkokYmdOf(p.startedAt) <= ymd && ymd <= bangkokYmdOf(endsAt)) return true;
  }
  return false;
}

/** Did this customer hold an active membership or package on `appointmentDate`? */
export async function hasMemberPricingOnDate(
  db: Db,
  customerId: string,
  appointmentDate: Date | string,
): Promise<boolean> {
  const [membership, packages] = await Promise.all([
    db.membership.findUnique({
      where: { customerId },
      select: {
        activatedAt: true, expiresAt: true, pendingActivation: true,
        usagesAllowed: true, usagesUsed: true,
        cycles: { select: { startedAt: true, endedAt: true } },
      },
    }),
    db.customerPackage.findMany({
      where: { customerId },
      select: {
        startedAt: true, expiresAt: true, closedAt: true,
        pendingActivation: true, usageLimit: true, usagesUsed: true,
      },
    }),
  ]);
  return memberPricingOnDate(membership, packages, bangkokYmdOf(appointmentDate));
}

/** The service's member rate in satang, or null when it has none — the same
 *  formula every booking screen used to carry its own copy of. */
export function serviceMemberRate(svc: {
  price: number;
  memberPrice: number | null;
  memberDiscountPercent: number;
}): number | null {
  if (svc.memberPrice != null && svc.memberPrice > 0) return svc.memberPrice;
  if (svc.memberDiscountPercent > 0) return Math.round(svc.price * (1 - svc.memberDiscountPercent / 100));
  return null;
}
