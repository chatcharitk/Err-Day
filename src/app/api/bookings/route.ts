import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMins(aStart) < timeToMins(bEnd) && timeToMins(aEnd) > timeToMins(bStart);
}

async function checkCapacity(
  branchId: string,
  date: string,
  startTime: string,
  endTime: string,
  staffId: string | null,
  excludeBookingId?: string,
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  if (staffId) {
    // Specific staff: reject if that staff has any overlapping booking
    const conflict = await prisma.booking.findFirst({
      where: {
        staffId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED"] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startTime: true, endTime: true },
    });
    return conflict && overlaps(startTime, endTime, conflict.startTime, conflict.endTime)
      ? "selected_staff"
      : null;
  }

  // No specific staff: reject if all staff at the branch are simultaneously booked
  const [staffCount, existing] = await Promise.all([
    prisma.staff.count({ where: { branchId } }),
    prisma.booking.findMany({
      where: {
        branchId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED"] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startTime: true, endTime: true, staffId: true },
    }),
  ]);

  if (staffCount === 0) return null; // no staff configured — allow

  const conflicting = existing.filter((b) => overlaps(startTime, endTime, b.startTime, b.endTime));
  const uniqueStaff = new Set(conflicting.filter((b) => b.staffId).map((b) => b.staffId)).size;
  const nullStaff = conflicting.filter((b) => !b.staffId).length;

  return uniqueStaff + nullStaff >= staffCount ? "no_staff_available" : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      branchId, serviceId, staffId, date, startTime, endTime,
      totalPrice, name, phone, email, notes, addonIds,
      lineUserId,         // from Line LIFF — links customer to their Line account
      skipConflictCheck,  // trusted flag for POS / admin use
    } = body;

    if (!branchId || !serviceId || !date || !startTime || !endTime || !name || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!skipConflictCheck) {
      const conflict = await checkCapacity(branchId, date, startTime, endTime, staffId ?? null);
      if (conflict === "selected_staff") {
        return NextResponse.json({ error: "Time slot not available for selected staff" }, { status: 409 });
      }
      if (conflict === "no_staff_available") {
        return NextResponse.json({ error: "No available staff at this time. Please choose a different time." }, { status: 409 });
      }
    }

    // Upsert customer by phone, linking Line account if provided
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        name,
        email: email || undefined,
        ...(lineUserId ? { lineUserId } : {}),
      },
      create: {
        name,
        phone,
        email: email || undefined,
        ...(lineUserId ? { lineUserId } : {}),
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
