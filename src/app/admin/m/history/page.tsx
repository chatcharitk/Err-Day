import { prisma } from "@/lib/prisma";
import MobileSalesHistory from "./MobileSalesHistory";

export const dynamic = "force-dynamic";

function bkkNow(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

export default async function MobileHistoryPage() {
  const now = bkkNow();

  // Month-to-date bounds (UTC noon for appointment date matching)
  const todayStr     = now.toISOString().slice(0, 10);
  const monthStart   = new Date(todayStr.slice(0, 7) + "-01T00:00:00.000Z");
  const todayEnd     = new Date(todayStr + "T23:59:59.999Z");

  // Fetch last 14 days of all bookings + month-to-date completed revenue
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
  fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

  const [sales, mtdAgg] = await Promise.all([
    prisma.booking.findMany({
      where: {
        date:      { gte: fourteenDaysAgo, lte: todayEnd },
        status:    "COMPLETED",
        totalPrice: { gt: 0 },
      },
      select: {
        id:          true,
        date:        true,
        startTime:   true,
        totalPrice:  true,
        completedAt: true,
        service:  { select: { nameTh: true } },
        customer: { select: { name: true, nickname: true } },
        staff:    { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),

    prisma.booking.aggregate({
      where: {
        date:      { gte: monthStart, lte: todayEnd },
        status:    "COMPLETED",
        totalPrice: { gt: 0 },
      },
      _sum:   { totalPrice: true },
      _count: true,
    }),
  ]);

  const rows = sales.map(b => ({
    id:           b.id,
    date:         b.date.toISOString().slice(0, 10),
    startTime:    b.startTime,
    totalPrice:   b.totalPrice,
    serviceName:  b.service.nameTh,
    customerName: b.customer.nickname || b.customer.name,
    staffName:    b.staff?.name ?? null,
  }));

  return (
    <MobileSalesHistory
      sales={rows}
      mtdRevenue={mtdAgg._sum.totalPrice ?? 0}
      mtdCount={mtdAgg._count}
      todayStr={todayStr}
    />
  );
}
