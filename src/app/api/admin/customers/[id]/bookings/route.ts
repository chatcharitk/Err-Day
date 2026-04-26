import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/customers/[id]/bookings — booking history for one customer
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const bookings = await prisma.booking.findMany({
    where: { customerId: id },
    include: { branch: true, service: true, staff: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 50,
  });

  return NextResponse.json(bookings);
}
