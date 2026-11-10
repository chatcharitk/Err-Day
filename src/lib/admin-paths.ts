/**
 * The admin app has two shells over the same screens: the phone app under
 * /admin/m and the desktop panel under /admin. Screens shared by both write
 * their links in phone form ("/admin/m/…"); on desktop those links go through
 * toDesktopAdminPath so the admin stays in the desktop shell.
 */

/** Phone sections whose desktop page lives at the same path minus "/m". */
const SAME_PATH = new Set([
  "capacity", "coupons", "customers", "expenses", "history", "inbox", "live",
  "membership", "notifications", "payroll", "pos", "restock", "search",
  "services", "settings", "shifts", "staff", "stock", "votes",
]);

/** Phone sections that are a different page on desktop. */
const RENAMED: Record<string, string> = {
  dashboard: "/admin",
  new:       "/admin/calendar",
  block:     "/admin/calendar",
};

export function isPhoneAdminPath(pathname: string): boolean {
  return pathname === "/admin/m" || pathname.startsWith("/admin/m/") || pathname.startsWith("/admin/m?");
}

export function toDesktopAdminPath(path: string): string {
  if (!isPhoneAdminPath(path)) return path;
  const rest = path.slice("/admin/m".length); // "" | "?…" | "/…"
  if (rest === "" || rest.startsWith("?")) return `/admin${rest}`;
  const seg = rest.slice(1).split(/[/?#]/)[0];
  if (SAME_PATH.has(seg)) return `/admin${rest}`;
  if (seg in RENAMED) return RENAMED[seg];
  // Anything else is a booking: /admin/m/<bookingId> → /admin/bookings/<bookingId>
  return `/admin/bookings${rest}`;
}
