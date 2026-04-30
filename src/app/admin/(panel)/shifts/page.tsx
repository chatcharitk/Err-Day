import { prisma } from "@/lib/prisma";
import ShiftsManager from "./ShiftsManager";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return <ShiftsManager branches={branches} />;
}
