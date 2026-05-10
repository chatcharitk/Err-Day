import { prisma } from "@/lib/prisma";
import { getCachedBranches } from "@/lib/branches-cache";
import { defaultBranchId } from "@/lib/utils";
import StaffList from "./StaffList";

export const dynamic = "force-dynamic";

export default async function MobileStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;
  const branches = await getCachedBranches();
  const activeBranchId = branchId ?? defaultBranchId(branches);

  // Today's date at 00:00 (local) — used to scope today's shifts
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const staff = activeBranchId ? await prisma.staff.findMany({
    where:   { branchId: activeBranchId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id:    true,
      name:  true,
      phone: true,
      shifts: {
        where: { date: { gte: today, lt: tomorrow } },
        select: { id: true, date: true, startTime: true, endTime: true },
      },
    },
  }) : [];

  const data = staff.map(s => ({
    id:    s.id,
    name:  s.name,
    phone: s.phone,
    todayShifts: s.shifts.map(sh => ({ id: sh.id, startTime: sh.startTime, endTime: sh.endTime })),
  }));

  return <StaffList branches={branches} activeBranchId={activeBranchId} staff={data} />;
}
