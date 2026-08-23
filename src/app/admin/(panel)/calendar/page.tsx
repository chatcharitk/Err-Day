import { prisma } from "@/lib/prisma";
import { defaultBranchId } from "@/lib/utils";
import { getCachedBranches, getCachedBranchStaff, getCachedBranchServices, getCachedAddons } from "@/lib/branches-cache";
import CalendarView from "./CalendarView";

export const revalidate = 30;

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
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
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

  const branches = await getCachedBranches();

  const now   = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const selectedDate = date ?? today;
  const activeBranchId = branchId ?? defaultBranchId(branches);

  const { monday, sunday } = getWeekBounds(selectedDate);

  const [staff, bookings, branchServices, addons] = await Promise.all([
    getCachedBranchStaff(activeBranchId),
    prisma.booking.findMany({
      where: {
        branchId: activeBranchId,
        date: { gte: monday, lte: sunday },
        status: { notIn: ["CANCELLED"] },
        serviceId: { notIn: ["svc-membership-30d", "svc-buffet", "svc-pkg5"] },
      },
      // Slim select: only the fields rendered by the calendar.
      select: {
        id:         true,
        date:       true,
        startTime:  true,
        endTime:    true,
        status:     true,
        totalPrice: true,
        commissionSatang: true,
        notes:      true,
        paidAt:     true,
        activatesMembership: true,
        serviceId:  true,
        service:    { select: { name: true, nameTh: true, category: true } },
        customer:   { select: { id: true, name: true, nickname: true, phone: true } },
        staff:      { select: { id: true, name: true } },
        addons:     { select: { addonId: true, price: true, addon: { select: { nameTh: true, name: true } } } },
        extraStaff: { select: { staffId: true, staff: { select: { id: true, name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    getCachedBranchServices(activeBranchId),
    getCachedAddons(),
  ]);

  const weekBookings = bookings.map((b) => ({
    id: b.id,
    date: b.date.toISOString(),
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status as string,
    totalPrice: b.totalPrice,
    commissionSatang: b.commissionSatang,
    notes: b.notes,
    paidAt: b.paidAt ? b.paidAt.toISOString() : null,
    activatesMembership: b.activatesMembership,
    serviceId: b.serviceId,
    service: { name: b.service.name, nameTh: b.service.nameTh, category: b.service.category },
    customer: { id: b.customer.id, name: b.customer.name, nickname: b.customer.nickname, phone: b.customer.phone },
    staff: b.staff ? { id: b.staff.id, name: b.staff.name } : null,
    extraStaff: b.extraStaff.map((es) => ({ id: es.staff.id, name: es.staff.name })),
    addons: b.addons.map((a) => ({ id: a.addonId, nameTh: a.addon.nameTh, name: a.addon.name, price: a.price })),
  }));

  return (
    <CalendarView
      weekBookings={weekBookings}
      staff={staff}
      selectedDate={selectedDate}
      branches={branches}
      activeBranchId={activeBranchId}
      branchServices={branchServices}
      addons={addons}
    />
  );
}
