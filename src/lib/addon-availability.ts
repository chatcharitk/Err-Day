import { bangkokTodayKey } from "@/lib/member-pricing";

/**
 * Add-ons can carry an inclusive last day (ServiceAddon.availableUntil). The
 * rule is judged on the APPOINTMENT date, like promotions: a customer booking
 * today for a day after the end date is not offered it.
 */
export function addonOfferedOn(
  addon: { availableUntil?: string | null },
  ymd: string,
): boolean {
  return !addon.availableUntil || ymd.slice(0, 10) <= addon.availableUntil;
}

/** Prisma `where` fragment: add-ons still offered on `ymd` (default: today, Bangkok). */
export function addonsOfferedWhere(ymd: string = bangkokTodayKey()) {
  return { OR: [{ availableUntil: null }, { availableUntil: { gte: ymd } }] };
}

/**
 * Same end-date rule for a whole service (Service.availableTo, inclusive Bangkok
 * "YYYY-MM-DD", judged on the appointment date) — for time-limited menu items.
 */
export function serviceOfferedOn(
  svc: { availableTo?: string | null },
  ymd: string,
): boolean {
  return !svc.availableTo || ymd.slice(0, 10) <= svc.availableTo;
}

/** Prisma `service` filter: services still offered on `ymd` (default: today, Bangkok). */
export function servicesOfferedWhere(ymd: string = bangkokTodayKey()) {
  return { OR: [{ availableTo: null }, { availableTo: { gte: ymd } }] };
}
