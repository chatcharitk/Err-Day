import { getCurrentAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MobileExpenseForm from "../MobileExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "แก้ไขรายจ่าย — err.day" };

export default async function EditMobileExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await getCurrentAdmin()) notFound();
  const { id } = await params;

  const [expense, branches] = await Promise.all([
    prisma.expense.findUnique({
      where:  { id },
      include: {
        items:       { orderBy: { id: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  if (!expense) notFound();
  const payout = await prisma.staffDailyPayout.findFirst({ where: { expenseId: id } });

  return (
    <MobileExpenseForm
      mode="edit"
      branches={branches}
      initial={{
        id:            expense.id,
        vendorId: expense.vendorId, vatMode: expense.vatMode, vatRate: expense.vatRate,
        discountAmount: expense.discountAmount, withholdingAmount: expense.withholdingAmount,
        invoiceNumber: expense.invoiceNumber, documentDate: expense.documentDate?.toISOString().slice(0,10),
        paidDate: expense.paidAt ? new Date(expense.paidAt.getTime()+7*3600000).toISOString().slice(0,10) : null,
        status: expense.status,
        locked: !!(payout || expense.sourceKey?.startsWith("PAYROLL:") || expense.notes?.includes("[PAYROLL:")),
        canVoidLegacyMonthly: !payout && !!expense.notes?.includes("[PAYROLL:"),
        payrollHref: payout ? `/admin/payroll?branchId=${payout.branchId}&date=${payout.date.toISOString().slice(0,10)}` : undefined,
        branchId:      expense.branchId,
        category:      expense.category,
        vendor:        expense.vendor,
        date:          expense.date.toISOString().slice(0, 10),
        totalAmount:   expense.totalAmount,
        vatAmount:     expense.vatAmount,
        paymentMethod: expense.paymentMethod,
        notes:         expense.notes,
        items: expense.items.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          totalPrice:  it.totalPrice,
        })),
        attachments: [...(expense.receiptUrl && !expense.attachments.some(a => a.url === expense.receiptUrl) ? [{ url: expense.receiptUrl, filename: "หลักฐานเดิม", fileType: "" }] : []), ...expense.attachments.map(a => ({
          url: a.url, filename: a.filename, fileType: a.fileType,
        }))],
      }}
    />
  );
}
