import { prisma } from "@/lib/prisma";
import { getCachedBranches } from "@/lib/branches-cache";
import { defaultBranchId } from "@/lib/utils";
import MobileShiftsManager from "./MobileShiftsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตารางงาน — err.day" };

export default async function MobileShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; week?: string }>;
}) {
  const { branchId, week } = await searchParams;
  const branches = await getCachedBranches();
  const activeBranchId = branchId ?? defaultBranchId(branches);

  // Branch info (open/close used as default shift times) + active staff list.
  // The week's shift rows are fetched client-side on mount so navigating the
  // week strip doesn't trigger a full server re-render.
  const [branch, staff] = await Promise.all([
    activeBranchId
      ? prisma.branch.findUnique({
          where: { id: activeBranchId },
          select: { id: true, name: true, openTime: true, closeTime: true },
        })
      : Promise.resolve(null),
    activeBranchId
      ? prisma.staff.findMany({
          where:   { branchId: activeBranchId, isActive: true },
          orderBy: { name: "asc" },
          select:  { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <MobileShiftsManager
      branches={branches}
      activeBranchId={activeBranchId}
      branchOpenTime={branch?.openTime ?? "10:00"}
      branchCloseTime={branch?.closeTime ?? "21:00"}
      staff={staff}
      initialWeek={week ?? null}
    />
  );
}
