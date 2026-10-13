import { expenseBranchOptions } from "@/lib/branch-label";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isExpenseCategory } from "@/lib/expenses";
import MobileExpenseForm from "../MobileExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มรายจ่าย — err.day" };

export default async function NewMobileExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  if (!await getCurrentAdmin()) notFound();
  const { category } = await searchParams;
  const branches = await prisma.branch.findMany({
    // Includes not-yet-open branches (isActive=false) so set-up costs can be
      // booked against them before launch; they're labelled below.
      where:   {},
    orderBy: { name: "asc" },
    select:  { id: true, name: true, isActive: true },
  });
  return (
    <MobileExpenseForm
      mode="create"
      branches={expenseBranchOptions(branches)}
      initial={isExpenseCategory(category) ? { category } : undefined}
    />
  );
}
