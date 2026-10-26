import { prisma } from "@/lib/prisma";
import { suggestNameFix, type NameFix } from "@/lib/customer-name";

export type NameCheckItem = {
  id: string; phone: string; name: string; nickname: string | null; lineDisplayName: string | null;
  visits: number; lastBranch: string | null; fix: NameFix;
};

const isPlaceholder = (c: { name: string; phone: string }) => /^walk[\s-]?in$/i.test(c.name.trim()) || c.phone.startsWith("walkin-");

/** Customers whose name/nickname a person should confirm (not yet checked). */
export async function nameCheckQueue(): Promise<NameCheckItem[]> {
  const rows = await prisma.customer.findMany({
    where: { nameCheckedAt: null },
    select: {
      id: true, name: true, nickname: true, phone: true, lineDisplayName: true,
      _count: { select: { bookings: true } },
      bookings: { take: 1, orderBy: { date: "desc" }, select: { branch: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .filter(c => !isPlaceholder(c))
    .map(c => ({ c, fix: suggestNameFix(c) }))
    .filter(x => x.fix.action === "review")
    .map(({ c, fix }) => ({
      id: c.id, phone: c.phone, name: c.name, nickname: c.nickname, lineDisplayName: c.lineDisplayName,
      visits: c._count.bookings, lastBranch: c.bookings[0]?.branch.name.replace(/^err\.day\s*สาขา/, "") ?? null, fix,
    }));
}

export async function nameCheckCount(): Promise<number> {
  return (await nameCheckQueue()).length;
}
