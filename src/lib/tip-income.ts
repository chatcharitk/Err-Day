/**
 * Customer tips count as shop income (sales) from October 2026: the customer
 * pays the tip with the bill, the shop passes it to the stylist through payroll.
 * Sales screens and exports show it as its own figure — never folded into the
 * service price — so accounting can separate service revenue from tips.
 * Receipts (VAT documents) still cover the service only.
 */
export const TIP_INCOME_FROM = "2026-10-01";

/** The booking's tip as income, or 0 for bookings before TIP_INCOME_FROM.
 *  `date` is Booking.date (UTC noon of the Bangkok day) or its ISO string. */
export function tipIncomeSatang(date: Date | string, tipSatang: number | null | undefined): number {
  if (!tipSatang || tipSatang <= 0) return 0;
  const ymd = (typeof date === "string" ? date : date.toISOString()).slice(0, 10);
  return ymd >= TIP_INCOME_FROM ? tipSatang : 0;
}
