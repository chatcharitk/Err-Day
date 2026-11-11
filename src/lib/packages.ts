import { prisma } from "@/lib/prisma";
import { startOfTodayUTC } from "@/lib/utils";

/**
 * Package SKUs — these are the service IDs that, when sold at POS, activate
 * the corresponding entitlement on the customer.
 */
export const BUFFET_SKU    = "svc-buffet";
export const FIVE_PACK_SKU = "svc-pkg5";
/** 11.11 (2026) prepaid PJOLI Treatment voucher — sold only on 11 Nov, used by 30 Nov. */
export const PJOLI_1111_SKU = "svc-voucher-pjoli-1111";

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
  /** Fixed last day (Bangkok "YYYY-MM-DD", inclusive) instead of validityDays. */
  expiresOn?:       string;
  /**
   * Prepaid voucher: buying one never closes another of the same SKU (two
   * bought = two separate vouchers) and the purchase itself never counts as a
   * use — the customer comes back to redeem it.
   */
  voucher?:         boolean;
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
  [PJOLI_1111_SKU]: {
    sku:              PJOLI_1111_SKU,
    nameTh:           "บัตร PJOLI Treatment 11.11",
    nameEn:           "PJOLI Treatment 11.11 voucher",
    priceSatang:      81100,                   // ฿811 (member ฿711 via Service.memberPrice)
    validityDays:     20,
    expiresOn:        "2026-11-30",
    usageLimit:       1,
    coversServiceIds: ["svc-pjoli-treatment"],
    shortDescTh:      "PJOLI Treatment 1 ครั้ง ใช้ได้ถึง 30 พ.ย. 2569",
    voucher:          true,
  },
};

/** Expiry timestamp for a package started at `start`. */
export function packageExpiresAt(spec: PackageSpec, start: Date): Date {
  // Fixed end date: the end of that Bangkok day (23:59:59 +07:00).
  if (spec.expiresOn) return new Date(`${spec.expiresOn}T23:59:59.999+07:00`);
  // 30-day package started today → expires day 30 (inclusive). Count today as
  // day 1 and add (validityDays - 1) more days.
  return new Date(start.getTime() + (spec.validityDays - 1) * 24 * 60 * 60 * 1000);
}

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
  /**
   * Count the first visit immediately on activation. For capped packages
   * (5-pack), customers almost always use one right when they buy it, so POS
   * sets this true → the package starts at usagesUsed=1 instead of 0. No effect
   * on unlimited (buffet) packages.
   */
  countFirstUse?: boolean;
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
    countFirstUse = false,
  } = opts;

  // Only meaningful for capped packages (5-pack). Buffet (usageLimit 0) ignores it.
  const initialUsed = countFirstUse && spec.usageLimit > 0 && !spec.voucher ? 1 : 0;

  const now       = new Date();
  const expiresAt = packageExpiresAt(spec, now);

  return prisma.$transaction(async (tx) => {
    // If the customer self-registered via LIFF, a *pending* package of this SKU
    // already exists — activate that row in place (set fresh dates + clear the
    // pending flag) rather than orphaning it and creating a duplicate.
    const pending = await tx.customerPackage.findFirst({
      where: { customerId, packageSku, pendingActivation: true, closedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (pending) {
      return tx.customerPackage.update({
        where: { id: pending.id },
        data: {
          startedAt:         now,
          expiresAt,
          usagesUsed:        initialUsed,
          usageLimit:        spec.usageLimit,
          paidAmount,
          paymentMethod,
          bookingId,
          notes,
          pendingActivation: false,
        },
      });
    }

    // Otherwise (normal POS sale): close any open package of the same SKU and
    // create a fresh active one. Vouchers stack instead.
    if (!spec.voucher) {
      await tx.customerPackage.updateMany({
        where: { customerId, packageSku, closedAt: null },
        data:  { closedAt: now },
      });
    }

    return tx.customerPackage.create({
      data: {
        customerId,
        packageSku,
        startedAt:  now,
        expiresAt,
        usagesUsed: initialUsed,
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
  const today = startOfTodayUTC();
  const rows = await prisma.customerPackage.findMany({
    where: {
      customerId,
      closedAt:  null,
      pendingActivation: false,
      expiresAt: { gte: today },
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

export interface AdminPackage extends ActivePackage {
  pendingActivation: boolean;
  paidAmount: number;
  /** POS booking that activated this package (null for manual entries). */
  bookingId: string | null;
}

/**
 * For the admin customer detail view: returns all open (non-closed) packages
 * including those that are still pending activation. Active ones plus pending
 * ones, most-recently-started first.
 */
export async function findCustomerPackagesForAdmin(customerId: string): Promise<AdminPackage[]> {
  const today = startOfTodayUTC();
  const rows = await prisma.customerPackage.findMany({
    where: {
      customerId,
      closedAt: null,
      OR: [
        { pendingActivation: true },
        { expiresAt: { gte: today } },
      ],
    },
    orderBy: { startedAt: "desc" },
  });

  const out: AdminPackage[] = [];
  for (const r of rows) {
    const spec = PACKAGE_SPECS[r.packageSku];
    if (!spec) continue;
    const usagesLeft = r.usageLimit > 0 ? Math.max(0, r.usageLimit - r.usagesUsed) : null;
    if (!r.pendingActivation && usagesLeft === 0) continue;
    out.push({
      id:                r.id,
      packageSku:        r.packageSku,
      spec,
      startedAt:         r.startedAt,
      expiresAt:         r.expiresAt,
      usagesUsed:        r.usagesUsed,
      usageLimit:        r.usageLimit,
      usagesLeft,
      pendingActivation: r.pendingActivation,
      paidAmount:        r.paidAmount,
      bookingId:         r.bookingId,
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
export async function redeemPackage(packageId: string, bookingId?: string) {
  const row = await prisma.customerPackage.update({
    where: { id: packageId },
    data:  { usagesUsed: { increment: 1 } },
  });
  // Vouchers are single-use: remember which bill used it, for the admin list
  // under คูปอง (see VOUCHER_USED_PREFIX).
  if (bookingId && PACKAGE_SPECS[row.packageSku]?.voucher) {
    await prisma.customerPackage.update({
      where: { id: packageId },
      data:  { notes: `${VOUCHER_USED_PREFIX}${bookingId}` },
    });
  }
  return row;
}

/** `notes` on a voucher row once used: prefix + the booking id of that bill. */
export const VOUCHER_USED_PREFIX = "used-on-booking:";
