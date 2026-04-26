import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { branch: true, service: true, staff: true, customer: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, staffId, notes, startTime, endTime, totalPrice, serviceId } = body;

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(status     !== undefined ? { status }                       : {}),
        ...(staffId    !== undefined ? { staffId: staffId || null }     : {}),
        ...(notes      !== undefined ? { notes: notes || null }         : {}),
        ...(startTime  !== undefined ? { startTime }                    : {}),
        ...(endTime    !== undefined ? { endTime }                      : {}),
        ...(totalPrice !== undefined ? { totalPrice: Number(totalPrice) } : {}),
        ...(serviceId  !== undefined ? { serviceId }                    : {}),
      },
      include: { branch: true, service: true, staff: true, customer: true },
    });
    return NextResponse.json(booking);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
