import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { bangkokTodayYmd } from "@/lib/desk";

/**
 * Check in / finish / undo from the stylist's own phone — the same three steps
 * as the desk iPad (api/kiosk/*), but authorised by the staff login instead of
 * the kiosk cookie. The desk board picks the change up on its next poll
 * (every step touches Booking.updatedAt).
 *
 *   checkin → I'm serving this customer (sets staffId to my row at that branch)
 *   finish  → service done (COMPLETED)
 *   undo    → one step back (done → in service → waiting)
 *
 * Today's bookings only, at a branch the stylist works at. Once someone has
 * checked a customer in, only that stylist can finish or undo it from a phone;
 * anything else goes through the desk.
 */
export async function POST(request: Request) {
  const me = await getCurrentStaffPerson();
  if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const { bookingId, action } = await request.json().catch(() => ({}));
  if (typeof bookingId !== "string" || !["checkin", "finish", "undo"].includes(action)) {
    return NextResponse.json({ error: "bookingId and action are required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, branchId: true, date: true, status: true,
      staffId: true, checkedInAt: true, completedAt: true,
      staff: { select: { name: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

  if (booking.date.toISOString().slice(0, 10) !== bangkokTodayYmd()) {
    return NextResponse.json({ error: "เช็คอินได้เฉพาะคิววันนี้" }, { status: 400 });
  }
  if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
    return NextResponse.json({ error: "รายการนี้ถูกยกเลิกแล้ว" }, { status: 409 });
  }

  // My Staff row at this booking's branch (a person can work at several).
  const myRow = await prisma.staff.findFirst({
    where:  { id: { in: me.person.staffIds }, branchId: booking.branchId, isActive: true },
    select: { id: true },
  });
  if (!myRow) return NextResponse.json({ error: "คุณไม่ได้ประจำสาขานี้" }, { status: 403 });

  const servedByMe = !!booking.staffId && me.person.staffIds.includes(booking.staffId);
  const now = new Date();

  if (action === "checkin") {
    if (booking.status === "COMPLETED") {
      return NextResponse.json({ error: "รายการนี้เสร็จสิ้นแล้ว" }, { status: 409 });
    }
    if (booking.checkedInAt && !servedByMe) {
      return NextResponse.json({ error: `${booking.staff?.name ?? "ช่างคนอื่น"} เช็คอินลูกค้าคนนี้แล้ว` }, { status: 409 });
    }
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        staffId:     myRow.id,
        checkedInAt: booking.checkedInAt ?? now,
        ...(booking.status === "PENDING" ? { status: "CONFIRMED" } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  // finish / undo — only the stylist who is serving.
  if (!servedByMe || !booking.checkedInAt) {
    return NextResponse.json({ error: "ต้องเช็คอินลูกค้าคนนี้ก่อน" }, { status: 409 });
  }

  if (action === "finish") {
    if (booking.status !== "COMPLETED") {
      await prisma.booking.update({
        where: { id: booking.id },
        data:  { status: "COMPLETED", completedAt: booking.completedAt ?? now },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // undo
  await prisma.booking.update({
    where: { id: booking.id },
    data: booking.status === "COMPLETED"
      ? { status: "CONFIRMED", completedAt: null }
      : { checkedInAt: null },
  });
  return NextResponse.json({ ok: true });
}
