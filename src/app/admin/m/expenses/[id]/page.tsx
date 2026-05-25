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
  const { id } = await params;

  const [expense, branches] = await Promise.all([
    prisma.expense.findUnique({
      where:  { id },
      include: { items: { orderBy: { id: "asc" } } },
    }),
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  if (!expense) notFound();

  return (
    <MobileExpenseForm
      mode="edit"
      branches={branches}
      initial={{
        id:            expense.id,
        branchId:      expense.branchId,
        category:      expense.category,
        vendor:        expense.vendor,
        date:          expense.date.toISOString().slice(0, 10),
        totalAmount:   expense.totalAmount,
        vatAmount:     expense.vatAmount,
        paymentMethod: expense.paymentMethod,
        receiptUrl:    expense.receiptUrl,
        notes:         expense.notes,
        items: expense.items.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          totalPrice:  it.totalPrice,
        })),
      }}
    />
  );
}
