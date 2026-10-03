/**
 * Short-lived, date-bound salon promotions.
 *
 * Prices are deliberately calculated at checkout/booking time instead of
 * changing the catalogue. This preserves the normal price and makes each
 * promotion stop automatically at the end of its advertised dates.
 *
 * A promotion applies to the APPOINTMENT date (the day the service is
 * performed), so a customer booking today for a date inside the window gets
 * the promo price and one booking today for a date after it does not.
 * To add a campaign: append an entry to PROMOTIONS — every pricing path
 * (customer booking, booking API, customer edit, both POS screens) reads it.
 */
export interface ServicePromotion {
  serviceId: string;
  /** Inclusive Bangkok calendar dates, "YYYY-MM-DD". */
  startsOn: string;
  endsOn: string;
  /** Promo price for non-members, satang. */
  regularPrice: number;
  /** Promo price for active members, satang. */
  memberPrice: number;
  labelTh: string;
  labelEn: string;
}

export const DAVINES_SPA_PROMOTION = {
  serviceId: "svc-davines-spa",
  startsOn: "2026-08-07",
  endsOn: "2026-08-09",
  regularPrice: 78_800,
  memberPrice: 68_800,
  labelTh: "โปร 7–9 ส.ค. 2569",
  labelEn: "Promo 7–9 Aug 2026",
} as const satisfies ServicePromotion;

/** Normal price ฿990 / member ฿890 — set per branch in the services admin. */
export const PJOLI_TREATMENT_SERVICE_ID = "svc-pjoli-treatment";

export const PJOLI_TREATMENT_PROMOTION = {
  serviceId: PJOLI_TREATMENT_SERVICE_ID,
  startsOn: "2026-10-03",
  endsOn: "2026-10-31",
  regularPrice: 79_000,
  memberPrice: 69_000,
  labelTh: "โปรโมชันสำหรับนัดหมายถึง 31 ต.ค. 2569",
  labelEn: "Promotion for appointments until 31 Oct 2026",
} as const satisfies ServicePromotion;

export const PROMOTIONS: readonly ServicePromotion[] = [
  DAVINES_SPA_PROMOTION,
  PJOLI_TREATMENT_PROMOTION,
];

function toDateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** The promotion covering this service on this appointment day, or null. */
export function getServicePromotion(
  serviceId: string,
  appointmentDate: Date | string,
): ServicePromotion | null {
  const day = toDateKey(appointmentDate);
  return PROMOTIONS.find(
    (p) => p.serviceId === serviceId && day >= p.startsOn && day <= p.endsOn,
  ) ?? null;
}

/**
 * The service's promotion that is running now or still to come (null once it
 * has ended) — for advertising it on the service list before a date is chosen.
 */
export function getCurrentOrUpcomingPromotion(
  serviceId: string,
  today: Date | string,
): ServicePromotion | null {
  const day = toDateKey(today);
  return PROMOTIONS.find((p) => p.serviceId === serviceId && day <= p.endsOn) ?? null;
}

/** Returns the special price in satang, or null when this is not a promo day. */
export function getPromotionServicePrice(
  serviceId: string,
  appointmentDate: Date | string,
  isMember: boolean,
): number | null {
  const promo = getServicePromotion(serviceId, appointmentDate);
  if (!promo) return null;
  return isMember ? promo.memberPrice : promo.regularPrice;
}

export function isDavinesSpaPromotionDay(appointmentDate: Date | string): boolean {
  return getPromotionServicePrice(DAVINES_SPA_PROMOTION.serviceId, appointmentDate, false) != null;
}
