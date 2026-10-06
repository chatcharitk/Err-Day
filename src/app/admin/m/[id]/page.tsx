import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCachedBranchServices, getCachedBranchStaff, getCachedAddons } from "@/lib/branches-cache";
import { bangkokYmdOf, hasMemberPricingOnDate, serviceMemberRate } from "@/lib/member-pricing";
import { resolveServicePrice } from "@/lib/promotions";
import BookingDetail from "./BookingDetail";

export const revalidate = 30;

export default async function MobileBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id:         true,
      branchId:   true,
      customerId: true,
      serviceId:  true,
      staffId:    true,
      date:       true,
      startTime:  true,
      endTime:    true,
      status:     true,
      totalPrice: true,
      commissionSatang: true,
      tipSatang: true,
      notes:      true,
      internalNotes: true,
      receiptUrl: true,
      paidAt:     true,
      createdAt:  true,
      completedAt: true,
      activatesMembership: true,
      // The actual issued sales receipt — distinct from receiptUrl above,
      // which is a customer-uploaded payment slip image.
      receipts: { where: { voidedAt: null }, take: 1, select: { number: true, publicToken: true } },
      branch:   { select: { name: true } },
      service:  { select: { nameTh: true } },
      staff:    { select: { name: true } },
      customer: {
        select: {
          name:     true,
          nickname: true,
          phone:    true,
          membership: {
            select: { expiresAt: true, usagesUsed: true, usagesAllowed: true, pendingActivation: true },
          },
        },
      },
      addons: {
        select: {
          id:      true,
          addonId: true,
          price:   true,
          addon:   { select: { nameTh: true } },
        },
      },
    },
  });
  if (!booking) notFound();

  // Member pricing is judged on the booking's own date — a membership/package
  // that expires before the visit gives no discount, one that starts before it
  // does — so it is correct whenever the booking is made or viewed.
  const bookingYmd = bangkokYmdOf(booking.date);
  const isMember = await hasMemberPricingOnDate(prisma, booking.customerId, bookingYmd);

  const [branchServices, branchStaff, allAddons, branches] = await Promise.all([
    getCachedBranchServices(booking.branchId),
    getCachedBranchStaff(booking.branchId),
    getCachedAddons(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Keep the saved price in step with the customer's status ON the booking date,
  // so overview, detail and POS agree without staff clicking anything. Only unpaid
  // bookings are touched (a finished-but-unpaid one included — COMPLETED ≠ paid), and a manual price is never overridden:
  //   - eligible on the date and saved higher than the member total → lower it;
  //   - NOT eligible but the saved price is exactly the member total (a stale
  //     member price, e.g. the membership expired before the visit) → restore
  //     the regular total.
  let effectiveTotalPrice = booking.totalPrice;
  if ((booking.status === "PENDING" || booking.status === "CONFIRMED" || booking.status === "COMPLETED") && !booking.paidAt) {
    const bs = branchServices.find((s) => s.id === booking.serviceId);
    if (bs) {
      const rate = serviceMemberRate({
        price: bs.price, memberPrice: bs.memberPrice ?? null, memberDiscountPercent: bs.memberDiscountPercent ?? 0,
      });
      const addonsTotal = booking.addons.reduce((s, a) => s + a.price, 0);
      const priceFor = (member: boolean) => resolveServicePrice({
        serviceId: booking.serviceId, appointmentDate: bookingYmd,
        listPrice: bs.price, memberPrice: rate, isMember: member,
      }) + addonsTotal;
      const memberTotal  = priceFor(true);
      const regularTotal = priceFor(false);
      let corrected: number | null = null;
      if (isMember && memberTotal < booking.totalPrice) corrected = memberTotal;
      else if (!isMember && memberTotal < regularTotal && booking.totalPrice === memberTotal) corrected = regularTotal;
      if (corrected != null) {
        await prisma.booking.update({ where: { id: booking.id }, data: { totalPrice: corrected } });
        effectiveTotalPrice = corrected;
      }
    }
  }

  const data = {
    id:           booking.id,
    branchId:     booking.branchId,
    branchName:   booking.branch.name,
    customerId:   booking.customerId,
    serviceId:    booking.serviceId,
    serviceName:  booking.service.nameTh,
    staffId:      booking.staffId,
    staffName:    booking.staff?.name ?? null,
    customerName: booking.customer.name,
    customerNickname: booking.customer.nickname,
    customerPhone:booking.customer.phone,
    isMember,
    date:         `${booking.date.getFullYear()}-${String(booking.date.getMonth() + 1).padStart(2, "0")}-${String(booking.date.getDate()).padStart(2, "0")}`,
    startTime:    booking.startTime,
    endTime:      booking.endTime,
    status:       booking.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
    totalPrice:   effectiveTotalPrice,
    commissionSatang: booking.commissionSatang,
    tipSatang: booking.tipSatang,
    notes:        booking.notes,
    internalNotes: booking.internalNotes,
    receiptUrl:   booking.receiptUrl,
    paidAt:       booking.paidAt ? booking.paidAt.toISOString() : null,
    createdAt:    booking.createdAt.toISOString(),
    completedAt:  booking.completedAt ? booking.completedAt.toISOString() : null,
    activatesMembership: booking.activatesMembership,
    receipt: booking.receipts[0]
      ? { number: booking.receipts[0].number, publicToken: booking.receipts[0].publicToken }
      : null,
    addons:       booking.addons.map((a) => ({
      id:      a.id,
      addonId: a.addonId,
      name:    a.addon.nameTh,
      price:   a.price,
    })),
  };

  return (
    <BookingDetail
      booking={data}
      branchServices={branchServices.map((bs) => ({
        id:                    bs.id,
        nameTh:                bs.nameTh,
        price:                 bs.price,
        duration:              bs.duration,
        memberPrice:           bs.memberPrice ?? null,
        memberDiscountPercent: bs.memberDiscountPercent ?? 0,
      }))}
      branchStaff={branchStaff}
      allAddons={allAddons}
      branches={branches}
    />
  );
}
