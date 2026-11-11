/**
 * Prepaid event vouchers (see PACKAGE_SPECS `voucher: true` in packages.ts).
 * Unlike the buffet / 5-pack, a voucher only pays for its own service — it
 * never gives member pricing. Kept in its own file so client components can
 * import it (packages.ts pulls in Prisma).
 */
export const VOUCHER_SKUS: string[] = ["svc-voucher-pjoli-1111"];

export function isVoucherSku(sku: string | null | undefined): boolean {
  return !!sku && VOUCHER_SKUS.includes(sku);
}
