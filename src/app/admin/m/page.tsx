import { prisma } from "@/lib/prisma";
import { defaultBranchId } from "@/lib/utils";
import { getCachedBranches } from "@/lib/branches-cache";
import { PACKAGE_SPECS } from "@/lib/packages";
import MobileHome from "./MobileHome";

export const revalidate = 30;

/** Build "YYYY-MM-DD" from a local Date (no UTC offset). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBounds(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default async function MobileHomePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  const { branchId, date } = await searchParams;

  const today        = toLocalDateStr(new Date());
  const selectedDate = date ?? today;

  // Fetch branches and bookings in parallel — the booking query depends on
  // activeBranchId, but we can speculatively run it against the requested branch
  // and short-circuit if none was provided.
  const branches = await getCachedBranches();
  const activeBranchId = branchId ?? defaultBranchId(branches);

  const { start, end } = dayBounds(selectedDate);

  // Slim select: only the columns the UI actually renders.
  // Includes the customer's membership + active packages so the booking row
  // can show member/package badges and expiry at a glance.
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  // Sale-only SKUs (membership/package purchases) are stored as bookings so
  // they appear in sales history, but excluded from booking lists.
  const SALE_ONLY_SKUS = ["svc-membership-30d", "svc-buffet", "svc-pkg5"];

  const [bookings, branchServiceList, blockedSlotRows] = activeBranchId
    ? await Promise.all([
        prisma.booking.findMany({
          where: {
            branchId: activeBranchId,
            date:     { gte: start, lte: end },
            serviceId: { notIn: SALE_ONLY_SKUS },
          },
          select: {
            id:         true,
            startTime:  true,
            endTime:    true,
            status:      true,
            totalPrice:  true,
            paidAt:      true,
            checkedInAt: true,
            serviceId:   true,
            service:    {
              select: {
                nameTh:                true,
                memberPrice:           true,
                memberDiscountPercent: true,
              },
            },
            customer:   {
              select: {
                name:       true,
                nickname:   true,
                phone:      true,
                membership: {
                  select: {
                    expiresAt:         true,
                    pendingActivation: true,
                    usagesUsed:        true,
                    usagesAllowed:     true,
                  },
                },
                packages: {
                  where: {
                    closedAt: null,
                    OR: [
                      { pendingActivation: true },
                      { expiresAt: { gte: todayUTC } },
                    ],
                  },
                  select: {
                    id:                true,
                    packageSku:        true,
                    expiresAt:         true,
                    usagesUsed:        true,
                    usageLimit:        true,
                    pendingActivation: true,
                  },
                  orderBy: { expiresAt: "asc" },
                  take:    3,
                },
              },
            },
            staff:      { select: { name: true } },
            addons:     { select: { price: true } },
            _count:     { select: { addons: true } },
          },
          orderBy: { startTime: "asc" },
        }),
        prisma.branchService.findMany({
          where:  { branchId: activeBranchId, isActive: true },
          select: { serviceId: true, price: true },
        }),
        // Blocked windows for the day — shown on the home list so an admin can
        // see (and remove) what the 🚫 button created; invisible blocks were
        // silently closing online booking.
        prisma.blockedSlot.findMany({
          where:   { branchId: activeBranchId, date: selectedDate },
          select:  { id: true, startTime: true, endTime: true, reason: true, staff: { select: { name: true } } },
          orderBy: { startTime: "asc" },
        }),
      ])
    : [[], [], []];

  // Lookup map: serviceId → branch list price
  const branchPriceByService = new Map(
    branchServiceList.map(bs => [bs.serviceId, bs.price]),
  );

  const data = bookings.map((b) => {
    // Compute member status (inclusive expiry — valid through expiresAt day)
    let memberStatus: "active" | "pending" | "expired" | null = null;
    let memberExpiresAt: string | null = null;
    if (b.customer.membership) {
      const m = b.customer.membership;
      const expired = m.expiresAt != null && new Date(m.expiresAt) < todayUTC;
      const usedUp  = m.usagesAllowed > 0 && m.usagesUsed >= m.usagesAllowed;
      if      (m.pendingActivation)    memberStatus = "pending";
      else if (expired || usedUp)      memberStatus = "expired";
      else                             memberStatus = "active";
      memberExpiresAt = m.expiresAt?.toISOString() ?? null;
    }

    const packages = b.customer.packages.map(p => ({
      id:        p.id,
      sku:       p.packageSku,
      expiresAt: p.expiresAt.toISOString(),
      usagesLeft: p.usageLimit > 0 ? Math.max(0, p.usageLimit - p.usagesUsed) : null,
      isPending: p.pendingActivation,
    }));

    // For PENDING / CONFIRMED bookings, show what the booking *would* cost at
    // checkout (as a hint) — without overwriting the saved totalPrice. Once a
    // booking is COMPLETED the totalPrice is the audited charged amount.
    let displayPrice = b.totalPrice;
    const isOpenBooking = b.status === "PENDING" || b.status === "CONFIRMED";
    const addonsTotal = b.addons.reduce((s, a) => s + a.price, 0);

    // A service covered by an active package (5-pack / buffet) with uses left is
    // redeemed for free at checkout, so show the service portion as ฿0 — only
    // the add-ons (which the package doesn't cover) remain. Package beats the
    // member rate. Mirrors the POS redemption in pickRedemption/packages.ts.
    const coveredByPackage = isOpenBooking && b.customer.packages.some(p =>
      !p.pendingActivation
      && (PACKAGE_SPECS[p.packageSku]?.coversServiceIds.includes(b.serviceId) ?? false)
      && (p.usageLimit === 0 || p.usageLimit - p.usagesUsed > 0)
    );

    if (coveredByPackage) {
      displayPrice = addonsTotal;
    } else if (isOpenBooking && memberStatus === "active") {
      const branchListPrice = branchPriceByService.get(b.serviceId);
      if (branchListPrice != null) {
        let memberServicePrice = branchListPrice;
        if (b.service.memberPrice != null) {
          memberServicePrice = b.service.memberPrice;
        } else if ((b.service.memberDiscountPercent ?? 0) > 0) {
          memberServicePrice = Math.round(branchListPrice * (1 - (b.service.memberDiscountPercent ?? 0) / 100));
        }
        displayPrice = Math.min(b.totalPrice, memberServicePrice + addonsTotal);
      }
    }
    const hasMemberDiscount = displayPrice < b.totalPrice;

    return {
      id:           b.id,
      startTime:    b.startTime,
      endTime:      b.endTime,
      status:       b.status,
      totalPrice:   b.totalPrice,
      isPaid:       b.paidAt != null,
      checkedInAt:  b.checkedInAt ? b.checkedInAt.toISOString() : null,
      displayPrice,
      hasMemberDiscount,
      serviceName:  b.service.nameTh,
      customerName: b.customer.nickname || b.customer.name,
      customerPhone:b.customer.phone,
      staffName:    b.staff?.name ?? null,
      addonCount:   b._count.addons,
      memberStatus,
      memberExpiresAt,
      packages,
    };
  });

  return (
    <MobileHome
      branches={branches}
      activeBranchId={activeBranchId}
      selectedDate={selectedDate}
      bookings={data}
      blockedSlots={blockedSlotRows.map((b) => ({
        id:        b.id,
        startTime: b.startTime,
        endTime:   b.endTime,
        reason:    b.reason,
        staffName: b.staff?.name ?? null,
      }))}
      todayDate={today}
    />
  );
}
