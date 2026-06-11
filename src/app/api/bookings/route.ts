import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCapacity } from "@/lib/capacity";
import { sendBookingCreated, sendStaffBookingAlert, sendGroupBookingNotice } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      branchId, serviceId, staffId, date, startTime, endTime,
      totalPrice, name, nickname, phone, email, notes, addonIds,
      lineUserId, linePictureUrl, lineDisplayName, // from Line LIFF
      skipConflictCheck,            // trusted flag for POS / admin use
      isWalkin,                     // admin flag — skip customer info, use placeholder
      extraStaffIds,                // optional array of additional staff IDs
    } = body;

    // For walk-in bookings name/phone are optional; everything else is required
    if (!branchId || !serviceId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isWalkin && (!name || !phone)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Walk-in: use whatever was provided; fall back to placeholder if blank
    const finalName  = name?.trim()  || "Walk-in";
    const finalPhone = phone?.trim() || `walkin-${Date.now()}`;

    // Resolve add-on prices up front (read-only, safe outside the transaction).
    const addonCreates = Array.isArray(addonIds) && addonIds.length > 0
      ? (await prisma.serviceAddon.findMany({ where: { id: { in: addonIds } }, select: { id: true, price: true } }))
          .map((a) => ({ addonId: a.id, price: a.price }))
      : [];

    // Critical section: capacity check + customer upsert + booking insert run in
    // ONE transaction guarded by a per-branch-day advisory lock. Without this,
    // two simultaneous requests for the last slot could both pass the capacity
    // check and both insert (TOCTOU double-booking). The lock serializes
    // concurrent online bookings for the same branch+day; it's released when the
    // transaction commits. Admin/POS bookings (skipConflictCheck) bypass both the
    // lock and the check, exactly as before.
    const outcome = await prisma.$transaction(async (tx) => {
      if (!skipConflictCheck) {
        // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns void, which
        // $queryRaw can't deserialize. The lock is still taken as a side effect.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${branchId}:${date}`})::int8)`;
        const result = await checkCapacity({
          branchId, date, startTime, endTime, staffId: staffId ?? null,
          online: true, db: tx,
        });
        if (!result.ok) return { ok: false as const, result };
      }

      // Upsert customer by phone, linking Line account + picture if provided
      const customer = await tx.customer.upsert({
        where: { phone: finalPhone },
        update: {
          name: finalName,
          ...(nickname          ? { nickname }                      : {}),
          email: email || undefined,
          ...(lineUserId        ? { lineUserId }                    : {}),
          ...(linePictureUrl    ? { pictureUrl: linePictureUrl }    : {}),
          ...(lineDisplayName   ? { lineDisplayName }               : {}),
        },
        create: {
          name: finalName,
          phone: finalPhone,
          ...(nickname          ? { nickname }                      : {}),
          email: email || undefined,
          ...(lineUserId        ? { lineUserId }                    : {}),
          ...(linePictureUrl    ? { pictureUrl: linePictureUrl }    : {}),
          ...(lineDisplayName   ? { lineDisplayName }               : {}),
        },
      });

      const created = await tx.booking.create({
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
          ...(addonCreates.length > 0 ? { addons: { create: addonCreates } } : {}),
          ...(Array.isArray(extraStaffIds) && extraStaffIds.length > 0
            ? { extraStaff: { create: extraStaffIds.map((sid: string) => ({ staffId: sid })) } }
            : {}),
        },
        // Lean response: callers (CalendarView, NewBookingForm, BookingFlow) just
        // use this to redirect or refresh — they don't need the full Customer
        // (lineUserId, dateOfBirth, pictureUrl, etc.) or full Branch/Service.
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          totalPrice: true,
          status: true,
          branchId: true,
          serviceId: true,
          staffId: true,
          customerId: true,
          customer: { select: { id: true, name: true, phone: true } },
          service:  { select: { id: true, name: true, nameTh: true, category: true } },
          staff:    { select: { id: true, name: true } },
        },
      });

      return { ok: true as const, booking: created };
    });

    if (!outcome.ok) {
      const { result } = outcome;
      const msg =
        result.reason === "selected_staff_busy"      ? "Time slot not available for selected staff"
      : result.reason === "selected_staff_off_shift" ? "Selected staff is not on shift at this time"
      :                                                "No available staff at this time. Please choose a different time.";
      return NextResponse.json(
        { error: msg, scheduledCount: result.scheduledCount, occupiedCount: result.occupiedCount },
        { status: 409 },
      );
    }
    const booking = outcome.booking;

    // Fire-and-forget: customer confirmation (skipped if no LINE link) + staff alert + branch group.
    sendBookingCreated(booking.id).catch(e => console.error("[notify] booking created failed", e));
    sendStaffBookingAlert(booking.id).catch(e => console.error("[notify] staff alert failed", e));
    sendGroupBookingNotice(booking.id, "created").catch(e => console.error("[notify] group new booking failed", e));

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  // Capped at 500 rows — without a cap the unfiltered fetch could pull every
  // booking ever made. Callers needing more should paginate via ?cursor/?take.
  const bookings = await prisma.booking.findMany({
    where:   branchId ? { branchId } : undefined,
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      status: true,
      totalPrice: true,
      notes: true,
      branchId: true,
      serviceId: true,
      staffId: true,
      customer: { select: { id: true, name: true, phone: true } },
      service:  { select: { id: true, name: true, nameTh: true, category: true } },
      staff:    { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 500,
  });

  return NextResponse.json(bookings);
}
