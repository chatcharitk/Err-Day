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

  const today        = toLocalDateStr(new Date());
  const selectedDate = date ?? today;

  // Fetch branches and bookings in parallel — the booking query depends on
  // activeBranchId, but we can speculatively run it against the requested branch
  // and short-circuit if none was provided.
  const [branches, branchToUse] = await Promise.all([
    prisma.branch.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    Promise.resolve(branchId),
  ]);
  const activeBranchId = branchToUse ?? branches[0]?.id ?? "";

  const { start, end } = dayBounds(selectedDate);

  // Slim select: only the columns the UI actually renders
  const bookings = activeBranchId
    ? await prisma.booking.findMany({
        where: {
          branchId: activeBranchId,
          date:     { gte: start, lte: end },
        },
        select: {
          id:         true,
          startTime:  true,
          endTime:    true,
          status:     true,
          totalPrice: true,
          notes:      true,
          service:    { select: { nameTh: true } },
          customer:   { select: { name: true, nickname: true, phone: true } },
          staff:      { select: { name: true } },
          _count:     { select: { addons: true } },
        },
        orderBy: { startTime: "asc" },
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
    addonCount:   b._count.addons,
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
