import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StaffShifts from "./StaffShifts";

export const revalidate = 30;

export default async function MobileStaffShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const staff = await prisma.staff.findUnique({
    where:  { id },
    select: { id: true, name: true, branch: { select: { id: true, name: true } } },
  });
  if (!staff) notFound();

  // Pull shifts for the next 30 days
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);

  const shifts = await prisma.staffShift.findMany({
    where:   { staffId: id, date: { gte: today, lte: horizon } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select:  { id: true, date: true, startTime: true, endTime: true },
  });

  const data = shifts.map(s => ({
    id:        s.id,
    date:      `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, "0")}-${String(s.date.getDate()).padStart(2, "0")}`,
    startTime: s.startTime,
    endTime:   s.endTime,
  }));

  return <StaffShifts staff={{ id: staff.id, name: staff.name, branchName: staff.branch.name }} initialShifts={data} />;
}
