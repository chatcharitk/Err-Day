import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import ExpensesList from "./ExpensesList";

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

const SORT_KEYS = ["date", "category", "vendor", "branch", "paymentMethod", "amount", "attachments"] as const;
type SortKey = typeof SORT_KEYS[number];

/** Sorting happens in the database (not the browser) because the list is capped
 *  at 500 rows — sorting only the loaded rows would hide the true top/bottom. */
function orderByFor(key: SortKey, dir: "asc" | "desc"): Prisma.ExpenseOrderByWithRelationInput[] {
  const nullsLast = { sort: dir, nulls: "last" as const };
  const primary: Prisma.ExpenseOrderByWithRelationInput =
      key === "category"      ? { category: dir }
    : key === "vendor"        ? { vendor: nullsLast }
    : key === "branch"        ? { branch: { name: dir } }
    : key === "paymentMethod" ? { paymentMethod: nullsLast }
    : key === "amount"        ? { totalAmount: dir }
    : key === "attachments"   ? { attachments: { _count: dir } }
    :                           { date: dir };
  // Stable tie-break: newest first, so equal values keep a predictable order.
  return key === "date"
    ? [primary, { createdAt: dir }]
    : [primary, { date: "desc" }, { createdAt: "desc" }];
}

/** Default range: current month, 1 → today. */
function defaultRange(): { from: string; to: string } {
  const to = bangkokToday();
  return { from: `${to.slice(0, 7)}-01`, to };
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; category?: string; from?: string; to?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to   = sp.to   ?? def.to;
  const branchFilter = sp.branchId ?? "all";
  const categoryFilter = sp.category ?? "all";
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "date";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {
    status: { not: "VOIDED" },
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
        date: true, totalAmount: true, vatAmount: true, paymentMethod: true,
        status: true, notes: true,
        branch: { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: orderByFor(sortKey, sortDir),
      take: 500,
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.expense.aggregate({
      where: { ...where, status: "CONFIRMED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { ...where, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
  ]);

  return (
    <ExpensesList
      expenses={expenses.map(e => ({
        id:            e.id,
        branchId:      e.branchId,
        branchName:    e.branch?.name ?? null,
        category:      e.category,
        vendor:        e.vendor,
        date:          e.date.toISOString().slice(0, 10),
        totalAmount:   e.totalAmount,
        vatAmount:     e.vatAmount,
        paymentMethod: e.paymentMethod,
        attachmentCount: e._count.attachments,
        notes:         e.notes,
        status:        e.status,
      }))}
      branches={branches}
      filters={{ branchId: branchFilter, category: categoryFilter, from, to }}
      sort={{ key: sortKey, dir: sortDir }}
      summary={{
        totalAmount: total._sum.totalAmount ?? 0,
        count:       total._count,
      }}
      categoryTotals={Object.fromEntries(
        categoryTotals.map(row => [row.category, row._sum.totalAmount ?? 0]),
      )}
    />
  );
}
