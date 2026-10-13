import { NextResponse } from "next/server";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { notifyAdmins } from "@/lib/notify-admin";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/staff/pay-query { date: "YYYY-MM-DD", message }
 * An employee flags a day's pay for the owner to re-check. Lands in the admin
 * notification bell (and web push) with a link to that day's payroll, and is
 * kept in FinanceAudit as the record of the query.
 */
export async function POST(request: Request) {
  const me = await getCurrentStaffPerson();
  if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { date?: unknown; message?: unknown };
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  if (message.length < 3) return NextResponse.json({ error: "กรุณาพิมพ์รายละเอียดที่ต้องการให้ตรวจ" }, { status: 400 });

  // The day's branch, for the payroll deep link (first branch the person worked that day).
  const payout = await prisma.staffDailyPayout.findFirst({
    where: { staffId: { in: me.person.staffIds }, date: new Date(date + "T12:00:00Z") },
    select: { branchId: true },
  });
  const branchId = payout?.branchId ?? me.branchId;
  const dayTh = new Date(date + "T12:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  await prisma.financeAudit.create({
    data: { entity: "PAY_QUERY", recordId: me.id, action: "QUERY", actor: `staff:${me.name}`, after: { date, message, staffIds: me.person.staffIds } },
  });
  await notifyAdmins({
    type: "PAYROLL",
    title: `${me.name} ขอให้ตรวจค่าตอบแทน ${dayTh}`,
    body: message,
    href: `/admin/payroll?branchId=${encodeURIComponent(branchId)}&date=${date}`,
    branchId,
  });
  return NextResponse.json({ ok: true });
}
