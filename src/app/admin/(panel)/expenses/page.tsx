import { prisma } from "@/lib/prisma";
import ExpensesList from "./ExpensesList";

export const revalidate = 30;
export const metadata   = { title: "รายจ่าย — err.day" };

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

/** Default range: current month, 1 → today. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: ymd(start), to: ymd(now) };
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; category?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to   = sp.to   ?? def.to;
  const branchFilter = sp.branchId ?? "all";
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

  const [expenses, branches, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        id: true, branchId: true, category: true, vendor: true,
        date: true, totalAmount: true, vatAmount: true, paymentMethod: true,
        receiptUrl: true, status: true, notes: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.expense.aggregate({
      where,
      _sum: { totalAmount: true },
      _count: true,
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
        receiptUrl:    e.receiptUrl,
        notes:         e.notes,
        status:        e.status,
      }))}
      branches={branches}
      filters={{ branchId: branchFilter, category: categoryFilter, from, to }}
      summary={{
        totalAmount: total._sum.totalAmount ?? 0,
        count:       total._count,
      }}
    />
  );
}
