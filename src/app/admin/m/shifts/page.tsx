import { prisma } from "@/lib/prisma";
import { getCachedBranches } from "@/lib/branches-cache";
import { defaultBranchId } from "@/lib/utils";
import MobileShiftsManager from "./MobileShiftsManager";

export const revalidate = 30;
export const metadata = { title: "ตารางงาน — err.day" };

// Compute Monday of the requested week (or today's week) in local time.
function mondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = c.getDay();
  c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow));
  c.setHours(0, 0, 0, 0);
  return c;
}

export default async function MobileShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; week?: string }>;
}) {
  const { branchId, week } = await searchParams;
  const branches = await getCachedBranches();
  const activeBranchId = branchId ?? defaultBranchId(branches);

  // Preload the requested week's shifts server-side so the page renders fully
  // populated on first paint instead of flashing a loading state. Subsequent
  // week navigation still uses the client-side API call.
  const weekMonday = week ? mondayOf(new Date(week + "T12:00:00")) : mondayOf(new Date());
  const weekSunday = new Date(weekMonday); weekSunday.setDate(weekSunday.getDate() + 6);
  weekSunday.setHours(23, 59, 59, 999);

  const [branch, staffWithShifts] = await Promise.all([
    activeBranchId
      ? prisma.branch.findUnique({
          where:  { id: activeBranchId },
          select: { id: true, name: true, openTime: true, closeTime: true },
        })
      : Promise.resolve(null),
    activeBranchId
      ? prisma.staff.findMany({
          where:   { branchId: activeBranchId, isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            shifts: {
              where: { date: { gte: weekMonday, lte: weekSunday } },
              select: { id: true, date: true, startTime: true, endTime: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const staff = staffWithShifts.map(s => ({ id: s.id, name: s.name }));
  const initialShifts = staffWithShifts.map(s => ({
    staffId: s.id,
    shifts:  s.shifts.map(sh => ({
      id:        sh.id,
      date:      sh.date.toISOString().slice(0, 10),
      startTime: sh.startTime,
      endTime:   sh.endTime,
    })),
  }));

  return (
    <MobileShiftsManager
      branches={branches}
      activeBranchId={activeBranchId}
      branchOpenTime={branch?.openTime ?? "10:00"}
      branchCloseTime={branch?.closeTime ?? "21:00"}
      staff={staff}
      initialWeek={week ?? null}
      initialShifts={initialShifts}
    />
  );
}
