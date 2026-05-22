import { prisma } from "@/lib/prisma";
import { defaultBranchId } from "@/lib/utils";
import { getCachedBranches } from "@/lib/branches-cache";
import MobileCapacity from "./MobileCapacity";

export const revalidate = 30;
export const metadata = { title: "ความจุการจอง — err.day" };

export default async function MobileCapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  const { branchId, date } = await searchParams;
  const branchesList = await getCachedBranches();
  const activeBranchId = branchId ?? defaultBranchId(branchesList);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const selectedDate = date ?? today;

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, onlineCap: true, bookingEnabled: true },
  });

  return (
    <MobileCapacity
      branches={branches}
      activeBranchId={activeBranchId}
      selectedDate={selectedDate}
    />
  );
}
