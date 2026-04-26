import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { branchId, customerName, customerPhone, items, notes } = body;

    if (!branchId || !customerName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find walk-in service for this branch as the primary service placeholder
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

    const totalPrice = items.reduce((s: number, i: { price: number }) => s + i.price, 0);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endHour = now.getHours() + 1;
    const endTime = `${pad(endHour % 24)}:${pad(now.getMinutes())}`;

    // Encode the actual items in notes
    const itemSummary = items.map((i: { name: string; price: number }) => `${i.name}: ฿${(i.price / 100).toLocaleString()}`).join("\n");
    const fullNotes = [itemSummary, notes].filter(Boolean).join("\n---\n");

    const booking = await prisma.booking.create({
      data: {
        branchId,
        serviceId: walkinBs.serviceId,
        staffId: null,
        customerId: customer.id,
        date: now,
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
