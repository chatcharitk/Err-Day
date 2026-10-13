import { prisma } from "@/lib/prisma";

/**
 * One employee can own several Staff rows — one per branch they work at (วัน,
 * เอิร์น). Rows that share a phone number are the same PERSON; the portal, pay
 * view and pay slips all work per person, not per row.
 */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Stable key for a person: their phone digits, or the row id when there's no usable phone. */
export function personKeyOf(staff: { id: string; phone: string | null }): string {
  const d = phoneDigits(staff.phone);
  return d.length >= 9 ? d : staff.id;
}

export interface StaffPerson {
  key: string;
  name: string;
  staffIds: string[];
  branchIds: string[];
}

/**
 * All Staff rows belonging to the same person as `staffId` (active or not, so
 * history from a retired branch row still counts).
 */
export async function personForStaff(staffId: string): Promise<StaffPerson | null> {
  const me = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, name: true, phone: true, branchId: true } });
  if (!me) return null;
  const key = personKeyOf(me);
  const rows = key === me.id
    ? [me]
    : (await prisma.staff.findMany({ where: { phone: { not: null } }, select: { id: true, name: true, phone: true, branchId: true } }))
        .filter(r => personKeyOf(r) === key);
  return {
    key,
    name: me.name,
    staffIds: rows.map(r => r.id),
    branchIds: [...new Set(rows.map(r => r.branchId))],
  };
}

/** Every person who has at least one active Staff row, grouped. */
export async function activePeople(): Promise<StaffPerson[]> {
  const rows = await prisma.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true, phone: true, branchId: true },
    orderBy: { name: "asc" },
  });
  const byKey = new Map<string, StaffPerson>();
  for (const r of rows) {
    const key = personKeyOf(r);
    const p = byKey.get(key) ?? { key, name: r.name, staffIds: [], branchIds: [] };
    p.staffIds.push(r.id);
    if (!p.branchIds.includes(r.branchId)) p.branchIds.push(r.branchId);
    byKey.set(key, p);
  }
  return [...byKey.values()];
}

/** "0812345678" → "•••-•••-5678" — enough for staff to tell customers apart without exposing the number. */
export function maskPhone(phone: string | null | undefined): string {
  const d = phoneDigits(phone);
  if (d.length < 4) return "";
  return `•••-•••-${d.slice(-4)}`;
}
