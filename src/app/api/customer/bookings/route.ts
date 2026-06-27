import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SALE_ONLY_SKUS } from "@/lib/capacity";

/**
 * GET /api/customer/bookings?lineUserId=xxx
 * Returns the customer's appointment bookings (sale-only membership/package
 * PURCHASES are excluded — they're transactions, not appointments).
 * Sorted upcoming-first, then past.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId")?.trim();

  if (!lineUserId) {
    return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ bookings: [] });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id, serviceId: { notIn: SALE_ONLY_SKUS } },
    include: {
      branch:  { select: { id: true, name: true, address: true, phone: true } },
      service: { select: { id: true, name: true, nameTh: true, category: true } },
      addons:  { include: { addon: { select: { id: true, name: true, nameTh: true } } } },
    },
    orderBy: [{ date: "desc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ bookings });
}
