import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { addMinutes, SALE_ONLY_SKUS } from "@/lib/capacity";
import { bangkokNowHm, bangkokTodayYmd, bookingDateForYmd } from "@/lib/desk";

// Walk-ins are always "wash & blow" (สระไดร์) — staff don't pick a service at
// the counter. A serviceId in the body still overrides this if ever needed.
const WALKIN_DEFAULT_SERVICE = "svc-walkin";

/**
 * Walk-in: a customer arrives without a booking. Creates an appointment at the
 * current time for the chosen service, optionally already checked-in to the
 * serving staff. Mirrors the placeholder-customer convention used by
 * api/bookings (synthetic `walkin-<ts>` phone). Branch-scoped via the kiosk
 * cookie; bypasses capacity (admin/counter action).
 */
export async function POST(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const staffId = body.staffId;
  const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : WALKIN_DEFAULT_SERVICE;
  if (SALE_ONLY_SKUS.includes(serviceId)) {
    return NextResponse.json({ error: "แพ็กเกจ/สมาชิกต้องขายผ่าน POS" }, { status: 400 });
  }

  // Price + duration from the branch's own service config.
  const bs = await prisma.branchService.findUnique({
    where:  { branchId_serviceId: { branchId: branch.id, serviceId } },
    select: { price: true, duration: true, isActive: true },
  });
  if (!bs || !bs.isActive) {
    return NextResponse.json({ error: "ไม่พบบริการนี้ในสาขา" }, { status: 404 });
  }

  // Validate the serving staff (if one was chosen) belongs to this branch.
  if (staffId) {
    if (typeof staffId !== "string") {
      return NextResponse.json({ error: "Invalid staffId" }, { status: 400 });
    }
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }, select: { branchId: true, isActive: true },
    });
    if (!staff || staff.branchId !== branch.id || !staff.isActive) {
      return NextResponse.json({ error: "Staff not found at this branch" }, { status: 400 });
    }
  }

  const startTime = bangkokNowHm();
  const endTime   = addMinutes(startTime, bs.duration);
  const now       = new Date();

  const customer = await prisma.customer.create({
    data: { name: "Walk-in", phone: `walkin-${now.getTime()}` },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      branchId:   branch.id,
      serviceId,
      customerId: customer.id,
      staffId:    staffId || null,
      date:       bookingDateForYmd(bangkokTodayYmd()),
      startTime,
      endTime,
      totalPrice: bs.price,
      status:     "CONFIRMED",
      // If a staff was chosen, the walk-in is already in service.
      ...(staffId ? { checkedInAt: now } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
}
