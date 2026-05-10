import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** UTC midnight of the current day — use as the expiry boundary so that
 *  an expiresAt of "2026-06-03" is still valid on June 3 (inclusive). */
export function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Default branch — สุขุมวิท. Falls back to first branch if not found. */
export const DEFAULT_BRANCH_ID = "branch-sukhumvit";

export function defaultBranchId(branches: { id: string }[]): string {
  return branches.find(b => b.id === DEFAULT_BRANCH_ID)?.id ?? branches[0]?.id ?? "";
}
