import { prisma } from "@/lib/prisma";
import CalendarView from "./CalendarView";

export const dynamic = "force-dynamic";

/**
 * Parse a "YYYY-MM-DD" string as LOCAL noon to avoid UTC-offset
 * issues (e.g. Thailand UTC+7 midnight = previous day in UTC).
 */
function parseLocal(dateStr: string) {
  return new Date(dateStr + "T12:00:00");
}

function getWeekBounds(dateStr: string) {
  const date = parseLocal(dateStr);
  const dow  = date.getDay(); // 0=Sun
  // Monday of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  // Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branchId?: string }>;
}) {
  const { date, branchId } = await searchParams;

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // Use local date (not UTC) so Thailand UTC+7 midnight doesn't give yesterday
  const now   = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const selectedDate = date ?? today;
  const activeBranchId = branchId ?? branches[0]?.id ?? "";

  const { monday, sunday } = getWeekBounds(selectedDate);

  const [staff, bookings] = await Promise.all([
    prisma.staff.findMany({
      where: { branchId: activeBranchId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        branchId: activeBranchId,
        date: { gte: monday, lte: sunday },
        status: { notIn: ["CANCELLED"] },
      },
      include: { service: true, customer: true, staff: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const weekBookings = bookings.map((b) => ({
    id: b.id,
    date: b.date.toISOString(),
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status as string,
    totalPrice: b.totalPrice,
    notes: b.notes,
    serviceId: b.serviceId,
    service: {
      name: b.service.name,
      nameTh: b.service.nameTh,
      category: b.service.category,
    },
    customer: { name: b.customer.name, phone: b.customer.phone },
    staff: b.staff ? { id: b.staff.id, name: b.staff.name } : null,
  }));

  return (
    <CalendarView
      weekBookings={weekBookings}
      staff={staff.map((s) => ({ id: s.id, name: s.name }))}
      selectedDate={selectedDate}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      activeBranchId={activeBranchId}
    />
  );
}
