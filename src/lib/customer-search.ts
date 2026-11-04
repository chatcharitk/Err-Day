/**
 * Customer search shared by every staff search box.
 *
 * Since the Oct 2026 name cleanup a customer's nickname and real name live in
 * separate fields, so a query like "บิว ศุภิสรา" (how lists show them) must
 * match word by word across fields — every word has to appear in the nickname,
 * the real name, the LINE display name or the phone. Results are ranked so an
 * exact nickname / name hit comes first instead of A–Z by real name.
 */
import type { Prisma } from "@/generated/prisma/client";

type Searchable = { name: string; nickname?: string | null; lineDisplayName?: string | null; phone?: string | null };

/** Words of the query; "·" from customerLabel() and dashes in phone numbers are ignored. */
export function searchWords(q: string): string[] {
  return q.toLowerCase().replace(/[·,]/g, " ").split(/\s+/).map(w => (/^[\d-]+$/.test(w) ? w.replace(/-/g, "") : w)).filter(Boolean);
}

/** Prisma filter: every word matches at least one field. */
export function customerSearchWhere(q: string): Prisma.CustomerWhereInput {
  const words = searchWords(q);
  return {
    AND: words.map(w => ({
      OR: [
        { name:            { contains: w, mode: "insensitive" as const } },
        { nickname:        { contains: w, mode: "insensitive" as const } },
        { lineDisplayName: { contains: w, mode: "insensitive" as const } },
        { phone:           { contains: w } },
      ],
    })),
  };
}

/** Client-side version of the same rule (lists already loaded in the page). */
export function matchesCustomer(c: Searchable, q: string): boolean {
  const hay = [c.name, c.nickname ?? "", c.lineDisplayName ?? "", c.phone ?? ""].join(" ").toLowerCase();
  return searchWords(q).every(w => hay.includes(w));
}

/** Lower is better: exact nickname/name → starts with → contains anywhere. */
export function customerSearchRank(c: Searchable, q: string): number {
  const words = searchWords(q);
  const first = words[0] ?? "";
  const fields = [c.nickname ?? "", c.name, c.lineDisplayName ?? ""].map(s => s.toLowerCase());
  if (words.length > 1 && (fields[0] + " " + fields[1]).startsWith(words.join(" "))) return 0;
  if (fields.some(f => f === first)) return 1;
  if (fields.some(f => f.startsWith(first) || f.split(/\s+/).some(p => p === first))) return 2;
  if ((c.phone ?? "").startsWith(first)) return 2;
  return 3;
}

/** Imported walk-in placeholders (phone "walkin-imp-…") sink below real customers. */
const walkinPenalty = (c: Searchable) => ((c.phone ?? "").startsWith("walkin") ? 10 : 0);

/** Rank then cut — callers fetch a wider pool (e.g. 60) and keep `limit`. */
export function rankCustomers<T extends Searchable>(list: T[], q: string, limit: number): T[] {
  return list
    .map((c, i) => ({ c, i, r: customerSearchRank(c, q) + walkinPenalty(c) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map(x => x.c);
}
