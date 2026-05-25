import { prisma } from "@/lib/prisma";
import ExpenseForm from "../ExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มรายจ่าย — err.day" };

export default async function NewExpensePage() {
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
  return <ExpenseForm mode="create" branches={branches} />;
}
