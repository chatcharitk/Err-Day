import { prisma } from "@/lib/prisma";

/** Monday (YYYY-MM-DD) of the week containing a YYYY-MM-DD date. */
export function mondayKey(ymd: string): string {
  const d = new Date(ymd + "T12:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Weeks (by Monday) the owner has hidden from staff. */
export async function hiddenWeeks(mondays: string[]): Promise<Set<string>> {
  if (!mondays.length) return new Set();
  const rows = await prisma.shiftWeekVisibility.findMany({ where: { weekStart: { in: mondays }, hidden: true }, select: { weekStart: true } });
  return new Set(rows.map(r => r.weekStart));
}
