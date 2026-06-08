import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Invalidate cached customer-facing reference data after an admin edits a
 * branch, a service, branch price/duration, or an add-on.
 *
 * Busts two layers:
 *   1. the `unstable_cache` tags used by branches-cache.ts (the admin pages
 *      that read branches / services / add-ons), and
 *   2. the ISR customer booking pages (`/`, `/book`, `/book/[branchId]`) so a
 *      price or service change shows immediately instead of after their 60s
 *      background revalidate.
 *
 * The broad tags (`services`, `branches`, `addons`) also cover the per-branch
 * cache entries, which are tagged with the same broad tag in branches-cache.ts.
 * Reference data changes are rare, so busting the whole set on any edit is cheap
 * and keeps call sites from having to reason about which entries an edit touches.
 *
 * Note: in Next 16 `revalidateTag` takes a required second "profile" argument
 * controlling the stale-while-revalidate window; "max" is the documented
 * recommendation (serve stale while the background refresh runs). The customer
 * booking pages are plain ISR (no cache tags), so they're handled by
 * `revalidatePath` instead.
 */
export function revalidateReferenceData() {
  revalidateTag("branches", "max");
  revalidateTag("services", "max");
  revalidateTag("addons", "max");

  revalidatePath("/");
  revalidatePath("/book");
  revalidatePath("/book/[branchId]", "page");
}
