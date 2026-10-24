/** Preset product groups, in display order. Products may also use any custom name. */
export const STOCK_CATEGORIES = [
  "แชมพู / ครีมนวด",
  "ทรีทเม้นต์ / สปา",
  "สีย้อมผม",
  "ไฮโดรเจน / ดีเวลลอปเปอร์",
  "สินค้าขาย",
  "อุปกรณ์ / ของใช้",
  "อื่นๆ",
] as const;

export const NO_CATEGORY = "ไม่มีหมวด";

function rank(c: string): number {
  const i = (STOCK_CATEGORIES as readonly string[]).indexOf(c);
  if (i >= 0) return i;
  return c === NO_CATEGORY ? 1000 : 500;
}

export function compareCategory(a: string, b: string): number {
  return rank(a) - rank(b) || a.localeCompare(b, "th");
}

/** Group rows by category (preset order first, then custom A–Z, uncategorised last). */
export function groupByCategory<T extends { category: string | null }>(rows: T[]): { category: string; rows: T[] }[] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const c = r.category?.trim() || NO_CATEGORY;
    if (!m.has(c)) m.set(c, []);
    m.get(c)!.push(r);
  }
  return [...m.entries()].sort((a, b) => compareCategory(a[0], b[0])).map(([category, rows]) => ({ category, rows }));
}
