import { prisma } from "@/lib/prisma";

/**
 * Package SKUs — these are the service IDs that, when sold at POS, activate
 * the corresponding entitlement on the customer.
 */
export const BUFFET_SKU    = "svc-buffet";
export const FIVE_PACK_SKU = "svc-pkg5";

export interface PackageSpec {
  sku:              string;
  nameTh:           string;
  nameEn:           string;
  priceSatang:      number;
  validityDays:     number;
  /** 0 = unlimited (buffet); positive = capped (5-pack) */
  usageLimit:       number;
  /** Service IDs whose visits this package redeems for free */
  coversServiceIds: string[];
  shortDescTh:      string;
}

/**
 * Specs for every purchasable package. The price is the sticker price the
 * customer agrees to pay at the shop; the actual amount sold at POS is
 * recorded on the CustomerPackage row in case it ever differs.
 */
export const PACKAGE_SPECS: Record<string, PackageSpec> = {
  [BUFFET_SKU]: {
    sku:              BUFFET_SKU,
    nameTh:           "Buffet 30 วัน",
    nameEn:           "Buffet 30 days",
    priceSatang:      350000,                  // ฿3,500
    validityDays:     30,
    usageLimit:       0,                       // unlimited
    coversServiceIds: ["svc-walkin"],
    shortDescTh:      "สระไดร์ไม่จำกัด 30 วัน",
  },
  [FIVE_PACK_SKU]: {
    sku:              FIVE_PACK_SKU,
    nameTh:           "แพ็กเกจ 5 ครั้ง",
    nameEn:           "5-Visit Pack",
    priceSatang:      160000,                  // ฿1,600
    validityDays:     90,
    usageLimit:       5,
    coversServiceIds: ["svc-walkin"],
    shortDescTh:      "สระไดร์ 5 ครั้ง ใน 90 วัน",
  },
};

export const PACKAGE_SKUS = Object.keys(PACKAGE_SPECS);

export function isPackageSku(sku: string | null | undefined): sku is string {
  return !!sku && sku in PACKAGE_SPECS;
}

interface ActivateOpts {
  customerId:    string;
  packageSku:    string;
  paidAmount?:   number;
  paymentMethod?: "POS" | "Manual";
  bookingId?:    string | null;
  notes?:        string;
}

/**
 * Activate a package purchase. If the customer already has an active package
 * of the same SKU, the existing one is closed (closedAt set) and a fresh one
 * is created — same model as how MembershipCycle handles renewals.
 */
export async function activatePackage(opts: ActivateOpts) {
  const spec = PACKAGE_SPECS[opts.packageSku];
  if (!spec) throw new Error(`Unknown package SKU: ${opts.packageSku}`);

  const {
    customerId,
    packageSku,
    paidAmount    = spec.priceSatang,
    paymentMethod = "POS",
    bookingId     = null,
    notes,
  } = opts;

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + spec.validityDays * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    // Close any open package of the same SKU
    await tx.customerPackage.updateMany({
      where: {
        customerId,
        packageSku,
        closedAt: null,
      },
      data: { closedAt: now },
    });

    return tx.customerPackage.create({
      data: {
        customerId,
        packageSku,
        startedAt:  now,
        expiresAt,
        usagesUsed: 0,
        usageLimit: spec.usageLimit,
        paidAmount,
        paymentMethod,
        bookingId,
        notes,
      },
    });
  });
}

export interface ActivePackage {
  id:           string;
  packageSku:   string;
  spec:         PackageSpec;
  startedAt:    Date;
  expiresAt:    Date;
  usagesUsed:   number;
  usageLimit:   number;
  /** null = unlimited */
  usagesLeft:   number | null;
}

/**
 * Returns all currently active (not expired, not used up, not closed)
 * packages a customer holds. Most-recently-started first.
 */
export async function findActivePackages(customerId: string): Promise<ActivePackage[]> {
  const now = new Date();
  const rows = await prisma.customerPackage.findMany({
    where: {
      customerId,
      closedAt:  null,
      expiresAt: { gt: now },
    },
    orderBy: { startedAt: "desc" },
  });

  const out: ActivePackage[] = [];
  for (const r of rows) {
    const spec = PACKAGE_SPECS[r.packageSku];
    if (!spec) continue;
    const usagesLeft = r.usageLimit > 0 ? Math.max(0, r.usageLimit - r.usagesUsed) : null;
    if (usagesLeft === 0) continue;  // used up
    out.push({
      id:         r.id,
      packageSku: r.packageSku,
      spec,
      startedAt:  r.startedAt,
      expiresAt:  r.expiresAt,
      usagesUsed: r.usagesUsed,
      usageLimit: r.usageLimit,
      usagesLeft,
    });
  }
  return out;
}

/**
 * Pick the best package to redeem against a given service. Prefers packages
 * that are about to expire soonest (use it before you lose it). Returns null
 * if the customer has no active package covering the service.
 */
export function pickRedemption(
  active: ActivePackage[],
  serviceId: string,
): ActivePackage | null {
  const eligible = active
    .filter(p => p.spec.coversServiceIds.includes(serviceId))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return eligible[0] ?? null;
}

/**
 * Increment usagesUsed atomically for a package. Caller is responsible for
 * having checked the package is still valid right before redemption.
 */
export async function redeemPackage(packageId: string) {
  return prisma.customerPackage.update({
    where: { id: packageId },
    data:  { usagesUsed: { increment: 1 } },
  });
}
