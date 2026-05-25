import { prisma } from "@/lib/prisma";
import MobileExpenseForm from "../MobileExpenseForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มรายจ่าย — err.day" };

export default async function NewMobileExpensePage() {
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
  return <MobileExpenseForm mode="create" branches={branches} />;
}
