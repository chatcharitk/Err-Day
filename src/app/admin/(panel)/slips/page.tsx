import { prisma } from "@/lib/prisma";
import { getCachedBranches } from "@/lib/branches-cache";
import SlipsReview from "./SlipsReview";

// Live review queue — always render fresh (the admin layout is dynamic anyway).
export const dynamic = "force-dynamic";

/** Bangkok yesterday→today as the UTC range used by Booking.date. */
function pickerRange(): { start: Date; end: Date; todayStr: string } {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear(), m = bkk.getUTCMonth(), d = bkk.getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    start:    new Date(Date.UTC(y, m, d - 1, 0, 0, 0)),
    end:      new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
    todayStr: `${y}-${p(m + 1)}-${p(d)}`,
  };
}

export default async function SlipsPage() {
  // Slips are typically posted in the evening and reviewed either the same
  // night or the next day — so the manual picker covers yesterday + today,
  // including COMPLETED bookings that don't have a receipt attached yet.
  const { start, end, todayStr } = pickerRange();

  const [slips, openBookings, branches] = await Promise.all([
    prisma.paymentSlip.findMany({
      where:   { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take:    100,
    }),
    prisma.booking.findMany({
      where: {
        date:   { gte: start, lte: end },
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      },
      select: {
        id: true, branchId: true, date: true, startTime: true, totalPrice: true, receiptUrl: true,
        customer: { select: { name: true, nickname: true } },
        service:  { select: { nameTh: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    }),
    getCachedBranches(),
  ]);

  const bookingMap = new Map(openBookings.map(b => [b.id, b]));

  return (
    <SlipsReview
      branches={branches}
      slips={slips.map(s => ({
        id:         s.id,
        branchId:   s.branchId,
        imageUrl:   s.imageUrl,
        amount:     s.amount,
        transferAt: s.transferAt,
        bankName:   s.bankName,
        senderName: s.senderName,
        ocrStatus:  s.ocrStatus,
        bookingId:  s.bookingId && bookingMap.has(s.bookingId) ? s.bookingId : null,
        createdAt:  s.createdAt.toISOString(),
      }))}
      openBookings={openBookings.map(b => ({
        id:           b.id,
        branchId:     b.branchId,
        startTime:    b.startTime,
        totalPrice:   b.totalPrice,
        hasReceipt:   !!b.receiptUrl,
        customerName: b.customer.nickname || b.customer.name,
        serviceName:  b.service.nameTh,
        // null = today; otherwise a short Thai date label, e.g. "12 มิ.ย."
        dateLabel: b.date.toISOString().slice(0, 10) === todayStr
          ? null
          : b.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }),
      }))}
    />
  );
}
