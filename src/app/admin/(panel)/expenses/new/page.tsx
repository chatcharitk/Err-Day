import { prisma } from "@/lib/prisma";
import { isExpenseCategory } from "@/lib/expenses";
import ExpenseForm from "../ExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มรายจ่าย — err.day" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
  return (
    <ExpenseForm
      mode="create"
      branches={branches}
      initial={isExpenseCategory(category) ? { category } : undefined}
    />
  );
}
