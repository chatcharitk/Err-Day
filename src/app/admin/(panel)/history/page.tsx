import { prisma } from "@/lib/prisma";
import SalesHistory from "./SalesHistory";

export const revalidate = 30;

// Default to a rolling 12-month window so this query stays bounded as bookings
// grow. It covers every date preset up to "year"; `?range=all` loads everything
// for deep custom look-ups (surfaced as a toggle in the UI).
const WINDOW_MONTHS = 12;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const showAll = range === "all";

  const since = new Date();
  since.setMonth(since.getMonth() - WINDOW_MONTHS);

  const [sales, branches, allStaff, allServices] = await Promise.all([
    prisma.booking.findMany({
      where: showAll ? undefined : { date: { gte: since } },
      // Slim select — only the columns SalesHistory renders (was `include` of 4
      // full relations, which pulled addresses, image URLs, descriptions, etc.).
      select: {
        id:          true,
        date:        true,
        startTime:   true,
        endTime:     true,
        status:      true,
        totalPrice:  true,
        internalNotes: true,
        branchId:    true,
        serviceId:   true,
        completedAt: true,
        paidAt:      true,
        branch:   { select: { id: true, name: true } },
        service:  { select: { name: true, nameTh: true } },
        staff:    { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, branchId: true } }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { nameTh: "asc" }], select: { id: true, name: true, nameTh: true } }),
  ]);

  return (
    <SalesHistory
      windowMonths={showAll ? null : WINDOW_MONTHS}
      sales={sales.map(b => ({
        id:          b.id,
        date:        b.date.toISOString(),
        startTime:   b.startTime,
        endTime:     b.endTime,
        status:      b.status as string,
        totalPrice:  b.totalPrice,
        notes:       b.internalNotes,
        branchId:    b.branchId,
        serviceId:   b.serviceId,
        completedAt: b.completedAt?.toISOString() ?? null,
        paidAt:      b.paidAt?.toISOString() ?? null,
        branch:   { id: b.branch.id,   name: b.branch.name },
        service:  { name: b.service.name, nameTh: b.service.nameTh },
        staff:    b.staff ? { id: b.staff.id, name: b.staff.name } : null,
        customer: { id: b.customer.id, name: b.customer.name, phone: b.customer.phone },
      }))}
      branches={branches.map(b => ({ id: b.id, name: b.name }))}
      allStaff={allStaff.map(s => ({ id: s.id, name: s.name, branchId: s.branchId }))}
      allServices={allServices.map(s => ({ id: s.id, name: s.name, nameTh: s.nameTh }))}
    />
  );
}
