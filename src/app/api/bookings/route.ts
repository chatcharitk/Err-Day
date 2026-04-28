import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCapacity } from "@/lib/capacity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      branchId, serviceId, staffId, date, startTime, endTime,
      totalPrice, name, phone, email, notes, addonIds,
      lineUserId, linePictureUrl,  // from Line LIFF — links customer + profile pic
      skipConflictCheck,            // trusted flag for POS / admin use
    } = body;

    if (!branchId || !serviceId || !date || !startTime || !endTime || !name || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!skipConflictCheck) {
      const result = await checkCapacity({
        branchId, date, startTime, endTime, staffId: staffId ?? null,
      });
      if (!result.ok) {
        const msg =
          result.reason === "selected_staff_busy"      ? "Time slot not available for selected staff"
        : result.reason === "selected_staff_off_shift" ? "Selected staff is not on shift at this time"
        :                                                "No available staff at this time. Please choose a different time.";
        return NextResponse.json(
          { error: msg, scheduledCount: result.scheduledCount, occupiedCount: result.occupiedCount },
          { status: 409 },
        );
      }
    }

    // Upsert customer by phone, linking Line account + picture if provided
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        name,
        email: email || undefined,
        ...(lineUserId     ? { lineUserId }                : {}),
        ...(linePictureUrl ? { pictureUrl: linePictureUrl } : {}),
      },
      create: {
        name,
        phone,
        email: email || undefined,
        ...(lineUserId     ? { lineUserId }                : {}),
        ...(linePictureUrl ? { pictureUrl: linePictureUrl } : {}),
      },
    });

    const booking = await prisma.booking.create({
      data: {
        branchId,
        serviceId,
        staffId: staffId || null,
        customerId: customer.id,
        date: new Date(date + "T12:00:00"), // noon local avoids UTC-midnight = prev-day-in-Thailand bug
        startTime,
        endTime,
        totalPrice,
        notes: notes || null,
        status: body.status ?? "PENDING",
        ...(Array.isArray(addonIds) && addonIds.length > 0
          ? {
              addons: {
                create: await prisma.serviceAddon
                  .findMany({ where: { id: { in: addonIds } }, select: { id: true, price: true } })
                  .then((addons) => addons.map((a) => ({ addonId: a.id, price: a.price }))),
              },
            }
          : {}),
      },
      include: { branch: true, service: true, staff: true, customer: true },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  const bookings = await prisma.booking.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: true, service: true, staff: true, customer: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(bookings);
}
