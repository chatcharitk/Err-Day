import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

/**
 * GET /api/admin/vendors/[id]/expenses — every (non-void) expense paid to this
 * payee, newest first, plus totals by month and by category. Owner only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;

  const rows = await prisma.expense.findMany({
    where: { vendorId: id, status: { not: "VOID" } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, date: true, category: true, totalAmount: true, vatAmount: true, withholdingAmount: true,
      paymentMethod: true, invoiceNumber: true, notes: true, vendor: true,
      branch: { select: { name: true } },
      items: { select: { description: true }, take: 3 },
      _count: { select: { attachments: true } },
    },
  });

  const byMonth: Record<string, { count: number; total: number }> = {};
  const byCategory: Record<string, { count: number; total: number }> = {};
  for (const r of rows) {
    const m = r.date.toISOString().slice(0, 7); // rows sit at UTC noon of their Bangkok day
    (byMonth[m] ??= { count: 0, total: 0 }).count++;
    byMonth[m].total += r.totalAmount;
    (byCategory[r.category] ??= { count: 0, total: 0 }).count++;
    byCategory[r.category].total += r.totalAmount;
  }

  return Response.json({
    total: rows.reduce((s, r) => s + r.totalAmount, 0),
    count: rows.length,
    byMonth: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v })),
    byCategory: Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total).map(([category, v]) => ({ category, ...v })),
    expenses: rows.map(r => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      category: r.category,
      totalAmount: r.totalAmount,
      vatAmount: r.vatAmount,
      withholdingAmount: r.withholdingAmount,
      paymentMethod: r.paymentMethod,
      invoiceNumber: r.invoiceNumber,
      notes: r.notes,
      vendorText: r.vendor,
      branch: r.branch?.name ?? null,
      items: r.items.map(i => i.description),
      attachments: r._count.attachments,
    })),
  });
}
