import { prisma } from "@/lib/prisma";
import MobileHome from "./MobileHome";

export const dynamic = "force-dynamic";

/** Build "YYYY-MM-DD" from a local Date (no UTC offset). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBounds(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default async function MobileHomePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  const { branchId, date } = await searchParams;

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const today        = toLocalDateStr(new Date());
  const selectedDate = date ?? today;
  const activeBranchId = branchId ?? branches[0]?.id ?? "";

  const { start, end } = dayBounds(selectedDate);

  const bookings = activeBranchId
    ? await prisma.booking.findMany({
        where: {
          branchId: activeBranchId,
          date:     { gte: start, lte: end },
        },
        include: {
          service:  true,
          customer: true,
          staff:    true,
          addons:   { include: { addon: true } },
        },
        orderBy: [{ startTime: "asc" }],
      })
    : [];

  const data = bookings.map((b) => ({
    id:           b.id,
    startTime:    b.startTime,
    endTime:      b.endTime,
    status:       b.status,
    totalPrice:   b.totalPrice,
    notes:        b.notes,
    serviceName:  b.service.nameTh,
    customerName: b.customer.nickname || b.customer.name,
    customerPhone:b.customer.phone,
    staffName:    b.staff?.name ?? null,
    addonCount:   b.addons.length,
  }));

  return (
    <MobileHome
      branches={branches}
      activeBranchId={activeBranchId}
      selectedDate={selectedDate}
      bookings={data}
      todayDate={today}
    />
  );
}
