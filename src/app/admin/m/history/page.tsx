import { prisma } from "@/lib/prisma";
import MobileSalesHistory from "./MobileSalesHistory";

export const revalidate = 30;

function bkkNow(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

const PERIODS = ["today", "week", "month", "last_month", "year"] as const;
export type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  today:      "วันนี้",
  week:       "สัปดาห์นี้",
  month:      "เดือนนี้",
  last_month: "เดือนที่แล้ว",
  year:       "ปีนี้",
};

// Bookings store `date` as UTC-noon of the Bangkok calendar day, so we bound
// each period by UTC day-edges of the Bangkok Y/M/D (noon always falls inside).
function rangeFor(period: Period, now: Date): { gte: Date; lte: Date } {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const startOfDay = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd, 0, 0, 0, 0));
  const endOfDay   = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd, 23, 59, 59, 999));
  const todayEnd = endOfDay(y, m, d);

  switch (period) {
    case "today":
      return { gte: startOfDay(y, m, d), lte: todayEnd };
    case "week": {
      const dow = now.getUTCDay();               // 0=Sun … 6=Sat
      const backToMon = dow === 0 ? 6 : dow - 1; // ISO week starts Monday
      return { gte: startOfDay(y, m, d - backToMon), lte: todayEnd };
    }
    case "month":
      return { gte: startOfDay(y, m, 1), lte: todayEnd };
    case "last_month":
      return { gte: startOfDay(y, m - 1, 1), lte: endOfDay(y, m, 0) }; // day 0 = last day of prev month
    case "year":
      return { gte: startOfDay(y, 0, 1), lte: todayEnd };
  }
}

// The detailed list is capped; the summary (sum/count) always covers the whole
// period via a separate aggregate, so long periods (year) stay fast + accurate.
const LIST_CAP = 500;

export default async function MobileHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : "month";

  const now      = bkkNow();
  const todayStr = now.toISOString().slice(0, 10);
  const { gte, lte } = rangeFor(period, now);

  const where = {
    date:       { gte, lte },
    status:     "COMPLETED" as const,
    totalPrice: { gt: 0 },
  };

  const [sales, agg] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id:         true,
        date:       true,
        startTime:  true,
        totalPrice: true,
        service:  { select: { nameTh: true } },
        customer: { select: { name: true, nickname: true } },
        staff:    { select: { name: true } },
        // Just a presence indicator here — full access to it lives on the
        // booking detail screen (row tap), matching the desktop table.
        receipts: { where: { voidedAt: null }, take: 1, select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: LIST_CAP,
    }),
    prisma.booking.aggregate({ where, _sum: { totalPrice: true }, _count: true }),
  ]);

  const rows = sales.map(b => ({
    id:           b.id,
    date:         b.date.toISOString().slice(0, 10),
    startTime:    b.startTime,
    totalPrice:   b.totalPrice,
    serviceName:  b.service.nameTh,
    customerName: b.customer.nickname || b.customer.name,
    staffName:    b.staff?.name ?? null,
    hasReceipt:   b.receipts.length > 0,
  }));

  const totalCount = agg._count;

  return (
    <MobileSalesHistory
      sales={rows}
      period={period}
      periodLabel={PERIOD_LABELS[period]}
      totalRevenue={agg._sum.totalPrice ?? 0}
      totalCount={totalCount}
      truncated={totalCount > rows.length}
      todayStr={todayStr}
    />
  );
}
