import { prisma } from "@/lib/prisma";
import MobileExpensesList from "./MobileExpensesList";

export const dynamic    = "force-dynamic";
export const metadata   = { title: "รายจ่าย — err.day" };

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function defaultRange(): { from: string; to: string } {
  const to = bangkokToday();
  return { from: `${to.slice(0, 7)}-01`, to };
}

export default async function MobileExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; category?: string; from?: string; to?: string }>;
}) {
  const sp  = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to   = sp.to   ?? def.to;
  const branchFilter   = sp.branchId ?? "all";
  const categoryFilter = sp.category ?? "all";

  const where: Record<string, unknown> = {
    date: {
      gte: new Date(from + "T00:00:00.000Z"),
      lte: new Date(to   + "T23:59:59.999Z"),
    },
  };
  if (branchFilter === "shared") where.branchId = null;
  else if (branchFilter !== "all") where.branchId = branchFilter;
  if (categoryFilter !== "all") where.category = categoryFilter;

  const [expenses, branches, total, categoryTotals] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        id: true, branchId: true, category: true, vendor: true,
        date: true, totalAmount: true, paymentMethod: true,
        notes: true, status: true,
        branch: { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.expense.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
    prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { totalAmount: true },
    }),
  ]);

  return (
    <MobileExpensesList
      expenses={expenses.map(e => ({
        id:            e.id,
        branchName:    e.branch?.name ?? null,
        category:      e.category,
        vendor:        e.vendor,
        date:          e.date.toISOString().slice(0, 10),
        totalAmount:   e.totalAmount,
        paymentMethod: e.paymentMethod,
        attachmentCount: e._count.attachments,
      }))}
      branches={branches}
      filters={{ branchId: branchFilter, category: categoryFilter, from, to }}
      summary={{ totalAmount: total._sum.totalAmount ?? 0, count: total._count }}
      categoryTotals={Object.fromEntries(
        categoryTotals.map(row => [row.category, row._sum.totalAmount ?? 0]),
      )}
    />
  );
}
