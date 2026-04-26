import { prisma } from "@/lib/prisma";
import SalesHistory from "./SalesHistory";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [sales, branches, allStaff, allServices] = await Promise.all([
    prisma.booking.findMany({
      include: { branch: true, service: true, staff: true, customer: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { nameTh: "asc" }] }),
  ]);

  return (
    <SalesHistory
      sales={sales.map(b => ({
        id:         b.id,
        date:       b.date.toISOString(),
        startTime:  b.startTime,
        endTime:    b.endTime,
        status:     b.status as string,
        totalPrice: b.totalPrice,
        notes:      b.notes,
        branchId:   b.branchId,
        serviceId:  b.serviceId,
        branch:   { id: b.branch.id,   name: b.branch.name },
        service:  { name: b.service.name, nameTh: b.service.nameTh },
        staff:    b.staff ? { id: b.staff.id, name: b.staff.name } : null,
        customer: { name: b.customer.name, phone: b.customer.phone },
      }))}
      branches={branches.map(b => ({ id: b.id, name: b.name }))}
      allStaff={allStaff.map(s => ({ id: s.id, name: s.name, branchId: s.branchId }))}
      allServices={allServices.map(s => ({ id: s.id, name: s.name, nameTh: s.nameTh }))}
    />
  );
}
