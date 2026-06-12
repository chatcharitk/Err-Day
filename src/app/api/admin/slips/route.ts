import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/slips — pending payment slips for the review queue,
 * each with its suggested booking (when auto-match found a unique one).
 */
export async function GET() {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

  const slips = await prisma.paymentSlip.findMany({
    where:   { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take:    100,
  });

  // Join the suggested bookings manually (bookingId is a loose reference).
  const bookingIds = slips.map(s => s.bookingId).filter((x): x is string => !!x);
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where:  { id: { in: bookingIds } },
        select: {
          id: true, startTime: true, totalPrice: true, status: true,
          customer: { select: { name: true, nickname: true } },
          service:  { select: { nameTh: true } },
        },
      })
    : [];
  const bookingMap = new Map(bookings.map(b => [b.id, b]));

  return NextResponse.json({
    slips: slips.map(s => ({
      id:         s.id,
      branchId:   s.branchId,
      imageUrl:   s.imageUrl,
      amount:     s.amount,
      transferAt: s.transferAt,
      bankName:   s.bankName,
      senderName: s.senderName,
      ocrStatus:  s.ocrStatus,
      createdAt:  s.createdAt.toISOString(),
      booking:    s.bookingId && bookingMap.has(s.bookingId)
        ? (() => {
            const b = bookingMap.get(s.bookingId!)!;
            return {
              id:           b.id,
              startTime:    b.startTime,
              totalPrice:   b.totalPrice,
              status:       b.status,
              customerName: b.customer.nickname || b.customer.name,
              serviceName:  b.service.nameTh,
            };
          })()
        : null,
    })),
  });
}
