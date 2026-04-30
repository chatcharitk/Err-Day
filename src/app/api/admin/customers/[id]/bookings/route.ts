import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/customers/[id]/bookings?upcoming=true&limit=N
//   upcoming=true → only future-or-today bookings, sorted ascending
//   else          → full history, descending
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const upcoming = searchParams.get("upcoming") === "true";
  const limit    = Math.min(50, parseInt(searchParams.get("limit") ?? "50", 10) || 50);

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      customerId: id,
      ...(upcoming
        ? {
            date:   { gte: dayStart },
            status: { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] },
          }
        : {}),
    },
    include: { branch: true, service: true, staff: true, customer: true },
    orderBy: upcoming
      ? [{ date: "asc" },  { startTime: "asc" }]
      : [{ date: "desc" }, { startTime: "desc" }],
    take: limit,
  });

  // Return a flat shape for mobile/search consumers, while still exposing the
  // raw nested objects for callers that already rely on them.
  const shaped = bookings.map((b) => ({
    id:            b.id,
    date:          b.date.toISOString(),
    startTime:     b.startTime,
    endTime:       b.endTime,
    status:        b.status,
    totalPrice:    b.totalPrice,
    notes:         b.notes,
    serviceName:   b.service.nameTh,
    branchName:    b.branch.name,
    branchId:      b.branchId,
    staffName:     b.staff?.name ?? null,
    customerName:  b.customer.name,
    customerPhone: b.customer.phone,
    branch:        b.branch,
    service:       b.service,
    staff:         b.staff,
  }));

  return NextResponse.json(shaped);
}
