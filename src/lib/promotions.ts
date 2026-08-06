/**
 * Short-lived, date-bound salon promotions.
 *
 * Prices are deliberately calculated at checkout/booking time instead of
 * changing the catalogue. This preserves the normal price and makes each
 * promotion stop automatically at the end of its advertised dates.
 */
export const DAVINES_SPA_PROMOTION = {
  serviceId: "svc-davines-spa",
  startsOn: "2026-08-07",
  endsOn: "2026-08-09",
  regularPrice: 78_800,
  memberPrice: 68_800,
  labelTh: "โปร 7–9 ส.ค. 2569",
} as const;

function toDateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** Returns the special price in satang, or null when this is not a promo day. */
export function getPromotionServicePrice(
  serviceId: string,
  appointmentDate: Date | string,
  isMember: boolean,
): number | null {
  const day = toDateKey(appointmentDate);
  if (
    serviceId !== DAVINES_SPA_PROMOTION.serviceId ||
    day < DAVINES_SPA_PROMOTION.startsOn ||
    day > DAVINES_SPA_PROMOTION.endsOn
  ) return null;

  return isMember ? DAVINES_SPA_PROMOTION.memberPrice : DAVINES_SPA_PROMOTION.regularPrice;
}

export function isDavinesSpaPromotionDay(appointmentDate: Date | string): boolean {
  return getPromotionServicePrice(DAVINES_SPA_PROMOTION.serviceId, appointmentDate, false) != null;
}
