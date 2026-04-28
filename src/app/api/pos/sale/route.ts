import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { branchId, customerName, customerPhone, items, notes, fromBookingId } = body;

    if (!branchId || !customerName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    // Store date as local noon (consistent with all other bookings in this app)
    const localDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const date = new Date(localDateStr + "T12:00:00");

    const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endHour = now.getHours() + 1;
    const endTime = `${pad(endHour % 24)}:${pad(now.getMinutes())}`;

    const totalPrice = items.reduce((s: number, i: { price: number }) => s + i.price, 0);

    // Encode the actual items in notes
    const itemSummary = items
      .map((i: { name: string; price: number }) => `${i.name}: ฿${(i.price / 100).toLocaleString()}`)
      .join("\n");
    const fullNotes = [itemSummary, notes].filter(Boolean).join("\n---\n");

    // If fromBookingId provided: update the existing booking to COMPLETED (no duplicate)
    if (fromBookingId) {
      const existing = await prisma.booking.findUnique({ where: { id: fromBookingId } });
      if (!existing) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      const booking = await prisma.booking.update({
        where: { id: fromBookingId },
        data: {
          status: "COMPLETED",
          totalPrice,
          notes: fullNotes || existing.notes,
          startTime,
          endTime,
        },
        include: { branch: true, customer: true },
      });
      return NextResponse.json(booking, { status: 200 });
    }

    // New walk-in sale — create a fresh booking record
    const walkinBs = await prisma.branchService.findFirst({
      where: { branchId, serviceId: "svc-walkin", isActive: true },
    });
    if (!walkinBs) {
      return NextResponse.json({ error: "Branch not configured" }, { status: 400 });
    }

    const phone = customerPhone?.trim() || `pos-${Date.now()}`;
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: { name: customerName },
      create: { name: customerName, phone },
    });

    const booking = await prisma.booking.create({
      data: {
        branchId,
        serviceId: walkinBs.serviceId,
        staffId: null,
        customerId: customer.id,
        date,
        startTime,
        endTime,
        totalPrice,
        notes: fullNotes || null,
        status: "COMPLETED",
      },
      include: { branch: true, customer: true },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POS sale error:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
