import { expenseBranchOptions } from "@/lib/branch-label";
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
    // Includes not-yet-open branches (isActive=false) so set-up costs can be
      // booked against them before launch; they're labelled below.
      where:   {},
    orderBy: { name: "asc" },
    select:  { id: true, name: true, isActive: true },
  });
  return (
    <ExpenseForm
      mode="create"
      branches={expenseBranchOptions(branches)}
      initial={isExpenseCategory(category) ? { category } : undefined}
    />
  );
}
