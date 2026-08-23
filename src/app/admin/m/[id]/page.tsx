import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCachedBranchServices, getCachedBranchStaff, getCachedAddons } from "@/lib/branches-cache";
import { findActivePackages } from "@/lib/packages";
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
      notes:      true,
      receiptUrl: true,
      paidAt:     true,
      activatesMembership: true,
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

  // Resolve membership validity server-side
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  const mem = booking.customer.membership;
  const hasActiveMembership = !!mem
    && !mem.pendingActivation
    && !(mem.expiresAt != null && new Date(mem.expiresAt) < todayUTC)
    && !(mem.usagesAllowed > 0 && mem.usagesUsed >= mem.usagesAllowed);
  const hasActivePackage = (await findActivePackages(booking.customerId)).length > 0;
  const isMember = hasActiveMembership || hasActivePackage;

  const [branchServices, branchStaff, allAddons, branches] = await Promise.all([
    getCachedBranchServices(booking.branchId),
    getCachedBranchStaff(booking.branchId),
    getCachedAddons(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Auto-apply the member discount to the saved totalPrice when:
  //   1) the customer is currently a valid member, AND
  //   2) the booking's totalPrice is HIGHER than the member-adjusted total.
  // This keeps overview, detail, and POS in sync without staff having to click
  // "ใช้" on the green banner. Bookings that already have a manual lower price
  // (e.g. comp / extra discount) are preserved — Math.min() takes the smaller.
  let effectiveTotalPrice = booking.totalPrice;
  if (isMember && booking.status !== "COMPLETED") {
    const bs = branchServices.find((s) => s.id === booking.serviceId);
    if (bs) {
      let memberServicePrice = bs.price;
      if (bs.memberPrice != null) {
        memberServicePrice = bs.memberPrice;
      } else if ((bs.memberDiscountPercent ?? 0) > 0) {
        memberServicePrice = Math.round(bs.price * (1 - (bs.memberDiscountPercent ?? 0) / 100));
      }
      const addonsTotal         = booking.addons.reduce((s, a) => s + a.price, 0);
      const memberAdjustedTotal = memberServicePrice + addonsTotal;
      if (memberAdjustedTotal < booking.totalPrice) {
        // Persist the discount so the saved value matches what the customer actually pays.
        await prisma.booking.update({
          where: { id: booking.id },
          data:  { totalPrice: memberAdjustedTotal },
        });
        effectiveTotalPrice = memberAdjustedTotal;
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
    notes:        booking.notes,
    receiptUrl:   booking.receiptUrl,
    paidAt:       booking.paidAt ? booking.paidAt.toISOString() : null,
    activatesMembership: booking.activatesMembership,
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
