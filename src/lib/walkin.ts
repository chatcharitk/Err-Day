import { prisma } from "@/lib/prisma";
import { addMinutes, SALE_ONLY_SKUS } from "@/lib/capacity";
import { bangkokNowHm, bangkokTodayYmd, bookingDateForYmd } from "@/lib/desk";
import { findActivePackages } from "@/lib/packages";
import { hasActiveMembershipForBooking } from "@/lib/membership";
import { resolveServicePrice } from "@/lib/promotions";

// Walk-ins are always "wash & blow" (สระไดร์) unless a serviceId says otherwise.
export const WALKIN_DEFAULT_SERVICE = "svc-walkin";

export class WalkinError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/**
 * Create a walk-in booking at the current Bangkok time. Shared by the desk iPad
 * (api/kiosk/walkin) and the staff phone (api/staff/walkin).
 *   • customerId null → anonymous placeholder customer (`walkin-<ts>` phone);
 *   • customerId set  → that customer; a valid membership/package gets the member price.
 * staffId set → already checked in to that stylist. Bypasses capacity (counter action).
 * The caller has already checked that staffId (if any) works at branchId.
 */
export async function createWalkin(opts: {
  branchId: string;
  staffId: string | null;
  customerId: string | null;
  serviceId?: string | null;
}): Promise<{ id: string }> {
  const { branchId, staffId, customerId } = opts;
  const serviceId = opts.serviceId || WALKIN_DEFAULT_SERVICE;
  if (SALE_ONLY_SKUS.includes(serviceId)) throw new WalkinError("แพ็กเกจ/สมาชิกต้องขายผ่าน POS");

  const bs = await prisma.branchService.findUnique({
    where:  { branchId_serviceId: { branchId, serviceId } },
    select: {
      price: true, duration: true, isActive: true,
      service: { select: { memberPrice: true, memberDiscountPercent: true } },
    },
  });
  if (!bs || !bs.isActive) throw new WalkinError("ไม่พบบริการนี้ในสาขา", 404);

  if (customerId) {
    const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!exists) throw new WalkinError("ไม่พบลูกค้า", 404);
  }

  const startTime   = bangkokNowHm();
  const endTime     = addMinutes(startTime, bs.duration);
  const now         = new Date();
  const todayYmd    = bangkokTodayYmd();
  const bookingDate = bookingDateForYmd(todayYmd);

  // A booking is not payment evidence, so pending signups remain pending.
  return prisma.$transaction(async (tx) => {
    let bookingCustomerId: string;
    let isMemberPricing = false;
    if (customerId) {
      bookingCustomerId = customerId;
      const isActiveMember = await hasActiveMembershipForBooking(tx, customerId);
      const hasActivePackage = (await findActivePackages(customerId)).length > 0;
      isMemberPricing = isActiveMember || hasActivePackage;
    } else {
      const customer = await tx.customer.create({
        data: { name: "Walk-in", phone: `walkin-${now.getTime()}` },
        select: { id: true },
      });
      bookingCustomerId = customer.id;
    }

    // Promotion first, then member price, then list (see resolveServicePrice).
    const memberRate = bs.service.memberPrice != null
      ? bs.service.memberPrice
      : bs.service.memberDiscountPercent > 0
        ? Math.round(bs.price * (1 - bs.service.memberDiscountPercent / 100))
        : null;
    const totalPrice = resolveServicePrice({
      serviceId, appointmentDate: todayYmd,
      listPrice: bs.price, memberPrice: memberRate, isMember: isMemberPricing,
    });

    return tx.booking.create({
      data: {
        branchId,
        serviceId,
        customerId: bookingCustomerId,
        staffId:    staffId || null,
        date:       bookingDate,
        startTime,
        endTime,
        totalPrice,
        status:     "CONFIRMED",
        ...(staffId ? { checkedInAt: now } : {}),
      },
      select: { id: true },
    });
  });
}
