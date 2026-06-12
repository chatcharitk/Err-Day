import { prisma } from "@/lib/prisma";
import { getCachedBranches } from "@/lib/branches-cache";
import SlipsReview from "./SlipsReview";

// Live review queue — always render fresh (the admin layout is dynamic anyway).
export const dynamic = "force-dynamic";

/** Bangkok "today" as the UTC-noon range used by Booking.date. */
function bangkokTodayRange(): { start: Date; end: Date } {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear(), m = bkk.getUTCMonth(), d = bkk.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0)),
    end:   new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

export default async function SlipsPage() {
  const { start, end } = bangkokTodayRange();

  const [slips, openBookings, branches] = await Promise.all([
    prisma.paymentSlip.findMany({
      where:   { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take:    100,
    }),
    // Today's open bookings — candidates for the manual "pick a booking" menu.
    prisma.booking.findMany({
      where: {
        date:   { gte: start, lte: end },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        id: true, branchId: true, startTime: true, totalPrice: true, receiptUrl: true,
        customer: { select: { name: true, nickname: true } },
        service:  { select: { nameTh: true } },
      },
      orderBy: { startTime: "asc" },
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
      }))}
    />
  );
}
