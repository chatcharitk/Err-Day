import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { maskPhone } from "@/lib/staff-person";
import StaffDashboard from "./StaffDashboard";

export const dynamic  = "force-dynamic"; // cookie-dependent
export const metadata = { title: "ตารางงานของฉัน — err.day" };

const SALE_ONLY_SKUS = ["svc-membership-30d", "svc-buffet", "svc-pkg5"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = c.getDay();
  c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow));
  c.setHours(0, 0, 0, 0);
  return c;
}

export default async function StaffHome() {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");

  const now    = new Date();
  const monday = mondayOf(now);
  // This week and next, so staff can see their upcoming shifts too.
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 13); sunday.setHours(23, 59, 59, 999);

  // Branch-wide bookings — staff can see every appointment at their branch
  // so they know who is coming in (greeting, prep, coverage). The "ของฉัน"
  // pill on each row still highlights which ones they're assigned to.
  const [weekBookings, shifts] = await Promise.all([
    prisma.booking.findMany({
      where: {
        branchId:  { in: me.person.branchIds },
        date:      { gte: monday, lte: sunday },
        status:    { notIn: ["CANCELLED"] },
        serviceId: { notIn: SALE_ONLY_SKUS },
      },
      select: {
        id:         true,
        date:       true,
        startTime:  true,
        endTime:    true,
        status:     true,
        totalPrice: true,
        internalNotes: true,
        staffId:    true,
        service:    { select: { name: true, nameTh: true } },
        customer:   { select: { name: true, phone: true, nickname: true } },
        staff:      { select: { id: true, name: true } },
        branch:     { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.staffShift.findMany({
      where: { staffId: { in: me.person.staffIds }, date: { gte: monday, lte: sunday } },
      select: { date: true, startTime: true, endTime: true, staff: { select: { branch: { select: { name: true } } } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const todayStr = ymd(now);
  const weekData = {
    todayStr,
    bookings: weekBookings.map(b => ({
      id:               b.id,
      date:             ymd(b.date),
      startTime:        b.startTime,
      endTime:          b.endTime,
      status:           b.status as string,
      totalPrice:       b.totalPrice,
      notes:            b.internalNotes,
      staffId:          b.staffId,
      staffName:        b.staff?.name ?? null,
      isMine:           !!b.staffId && me.person.staffIds.includes(b.staffId),
      serviceName:      b.service.nameTh || b.service.name,
      customerName:     b.customer.name,
      customerPhone:    maskPhone(b.customer.phone),
      customerNickname: b.customer.nickname,
      branchName:       me.person.branchIds.length > 1 ? b.branch.name.replace("err.day ", "") : null,
    })),
    shifts: shifts.map(s => ({
      date:      ymd(s.date),
      startTime: s.startTime,
      endTime:   s.endTime,
      branchName: me.person.branchIds.length > 1 ? s.staff.branch.name.replace("err.day ", "") : null,
    })),
  };

  return <StaffDashboard me={me} week={weekData} />;
}
