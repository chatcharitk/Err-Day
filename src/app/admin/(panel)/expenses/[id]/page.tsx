import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExpenseForm from "../ExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "แก้ไขรายจ่าย — err.day" };

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  return (
    <ExpenseForm
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
        notes:         expense.notes,
        items: expense.items.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          totalPrice:  it.totalPrice,
        })),
        attachments: expense.attachments.map(a => ({
          url: a.url, filename: a.filename, fileType: a.fileType,
        })),
      }}
    />
  );
}
