/**
 * Prepaid event vouchers (see PACKAGE_SPECS `voucher: true` in packages.ts).
 * Unlike the buffet / 5-pack, a voucher only pays for its own service — it
 * never gives member pricing. Kept in its own file so client components can
 * import it (packages.ts pulls in Prisma).
 */
/** Prepaid service tickets ("บัตรบริการล่วงหน้า") — any service, paid now, used later. */
export const PREPAID_SKU = "svc-prepaid";

export const VOUCHER_SKUS: string[] = ["svc-voucher-pjoli-1111", PREPAID_SKU];

export function isVoucherSku(sku: string | null | undefined): boolean {
  return !!sku && VOUCHER_SKUS.includes(sku);
}

/** "No expiry" is stored as the end of 2099 (same convention as coupons). */
export const isNoExpiryDate = (d: Date | string) => new Date(d).getUTCFullYear() >= 2099;

/** Expiry choices for a prepaid ticket at the till (days; null = no expiry). */
export const PREPAID_EXPIRY_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: "ไม่มีวันหมดอายุ" },
  { days: 90,   label: "90 วัน" },
  { days: 180,  label: "180 วัน" },
  { days: 365,  label: "1 ปี" },
];

/** Can this service be sold "for later" at the till? Real services only —
 *  not membership, packages, vouchers or retail products. */
export function canSellForLater(serviceId: string, category: string | null | undefined): boolean {
  if (["svc-membership-30d", "svc-buffet", "svc-pkg5", "svc-retail", ...VOUCHER_SKUS].includes(serviceId)) return false;
  return category !== "สินค้า" && category !== "Membership" && category !== "แพ็กเกจ";
}

/** "ใช้ได้ถึง 1 ม.ค. 2570" or "ไม่มีวันหมดอายุ". */
export function expiryLabelTh(d: Date | string): string {
  if (isNoExpiryDate(d)) return "ไม่มีวันหมดอายุ";
  return `ใช้ได้ถึง ${new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" })}`;
}
