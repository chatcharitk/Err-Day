import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { sendWebPush, isPushConfigured } from "@/lib/push";

/** Fire a test push to the current admin's own devices — lets the owner confirm
 *  push works without waiting for a real booking. */
export async function POST() {
  const me = await requireAdmin().catch((e: unknown) => e as Response);
  if (me instanceof Response) return me;

  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, configured: false, sent: 0 });
  }

  const subs = await prisma.pushSubscription.findMany({
    where:  { userId: me.id },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await sendWebPush(subs, {
    title: "ทดสอบ err.day 🔔",
    body:  "การแจ้งเตือนทำงานปกติ — พร้อมรับการจองใหม่แล้ว",
    url:   "/admin/m",
    tag:   "test",
  });

  return NextResponse.json({ ok: true, configured: true, sent: subs.length });
}
