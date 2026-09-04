import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { addMinutes, SALE_ONLY_SKUS } from "@/lib/capacity";
import { bangkokNowHm, bangkokTodayYmd, bookingDateForYmd } from "@/lib/desk";
import { findActivePackages } from "@/lib/packages";
import { hasActiveMembershipForBooking } from "@/lib/membership";

// Walk-ins are always "wash & blow" (สระไดร์) — staff don't pick a service at
// the counter. A serviceId in the body still overrides this if ever needed.
const WALKIN_DEFAULT_SERVICE = "svc-walkin";

/**
 * Walk-in: a customer arrives without a booking. Creates an appointment at the
 * current time for the chosen service, optionally already checked-in to the
 * serving staff. Two customer shapes:
 *   • anonymous (default) — placeholder customer with a synthetic
 *     `walkin-<ts>` phone, same convention as api/bookings;
 *   • member walk-in — body.customerId points at a real customer (looked up
 *     via /api/kiosk/member); a valid membership gets the member price.
 * Branch-scoped via the kiosk cookie; bypasses capacity (counter action).
 */
export async function POST(request: Request) {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const staffId = body.staffId;
  const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId : null;
  const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : WALKIN_DEFAULT_SERVICE;
  if (SALE_ONLY_SKUS.includes(serviceId)) {
    return NextResponse.json({ error: "แพ็กเกจ/สมาชิกต้องขายผ่าน POS" }, { status: 400 });
  }

  // Price + duration from the branch's own service config (+ member pricing
  // fields for the member walk-in path).
  const bs = await prisma.branchService.findUnique({
    where:  { branchId_serviceId: { branchId: branch.id, serviceId } },
    select: {
      price: true, duration: true, isActive: true,
      service: { select: { memberPrice: true, memberDiscountPercent: true } },
    },
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

  if (customerId) {
    const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
  }

  const bookingDate = bookingDateForYmd(bangkokTodayYmd());

  // Resolve the customer + effective price and create the booking atomically.
  // A booking is not payment evidence, so pending signups remain pending.
  const booking = await prisma.$transaction(async (tx) => {
    let bookingCustomerId: string;
    let totalPrice = bs!.price;
    if (customerId) {
      bookingCustomerId = customerId;

      const isActiveMember = await hasActiveMembershipForBooking(tx, customerId);
      const hasActivePackage = (await findActivePackages(customerId)).length > 0;
      if (isActiveMember || hasActivePackage) {
        let memberPrice = bs!.price;
        if (bs!.service.memberPrice != null) {
          memberPrice = bs!.service.memberPrice;
        } else if (bs!.service.memberDiscountPercent > 0) {
          memberPrice = Math.round(bs!.price * (1 - bs!.service.memberDiscountPercent / 100));
        }
        totalPrice = Math.min(bs!.price, memberPrice);
      }
    } else {
      const customer = await tx.customer.create({
        data: { name: "Walk-in", phone: `walkin-${now.getTime()}` },
        select: { id: true },
      });
      bookingCustomerId = customer.id;
    }

    return tx.booking.create({
      data: {
        branchId:   branch.id,
        serviceId,
        customerId: bookingCustomerId,
        staffId:    staffId || null,
        date:       bookingDate,
        startTime,
        endTime,
        totalPrice,
        status:     "CONFIRMED",
        // If a staff was chosen, the walk-in is already in service.
        ...(staffId ? { checkedInAt: now } : {}),
      },
      select: { id: true },
    });
  });

  return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
}
