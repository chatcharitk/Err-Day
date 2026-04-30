import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingDetail from "./BookingDetail";

export const dynamic = "force-dynamic";

export default async function MobileBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      branch:   true,
      service:  true,
      customer: true,
      staff:    true,
      addons:   { include: { addon: true } },
    },
  });
  if (!booking) notFound();

  // For switching service / staff / add-ons inline
  const [branchServices, branchStaff, allAddons] = await Promise.all([
    prisma.branchService.findMany({
      where:   { branchId: booking.branchId, isActive: true },
      include: { service: true },
      orderBy: { service: { category: "asc" } },
    }),
    prisma.staff.findMany({
      where:   { branchId: booking.branchId, isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.serviceAddon.findMany({
      where:   { isActive: true },
      orderBy: { price: "asc" },
    }),
  ]);

  const data = {
    id:           booking.id,
    branchId:     booking.branchId,
    branchName:   booking.branch.name,
    serviceId:    booking.serviceId,
    serviceName:  booking.service.nameTh,
    staffId:      booking.staffId,
    staffName:    booking.staff?.name ?? null,
    customerName: booking.customer.name,
    customerNickname: booking.customer.nickname,
    customerPhone:booking.customer.phone,
    date:         `${booking.date.getFullYear()}-${String(booking.date.getMonth() + 1).padStart(2, "0")}-${String(booking.date.getDate()).padStart(2, "0")}`,
    startTime:    booking.startTime,
    endTime:      booking.endTime,
    status:       booking.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
    totalPrice:   booking.totalPrice,
    notes:        booking.notes,
    addons:       booking.addons.map((a) => ({
      id:        a.id,         // BookingAddon.id (used to delete)
      addonId:   a.addonId,
      name:      a.addon.nameTh,
      price:     a.price,
    })),
  };

  return (
    <BookingDetail
      booking={data}
      branchServices={branchServices.map((bs) => ({
        id:       bs.serviceId,
        nameTh:   bs.service.nameTh,
        price:    bs.price,
        duration: bs.duration,
      }))}
      branchStaff={branchStaff}
      allAddons={allAddons.map((a) => ({ id: a.id, nameTh: a.nameTh, price: a.price }))}
    />
  );
}
