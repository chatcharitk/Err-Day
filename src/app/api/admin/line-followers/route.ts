import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/line-followers — show LINE user IDs captured from webhook events
export async function GET() {
  const rows = await prisma.notificationLog.findMany({
    where: {
      kind:     "BOOKING_REMINDER_4H",
      targetId: { startsWith: "line-cap-" },
    },
    select: { recipient: true, error: true, sentAt: true },
    orderBy: { sentAt: "desc" },
  });

  const users = rows.map(r => ({
    userId:      r.recipient,
    displayName: r.error,
    capturedAt:  r.sentAt,
  }));

  return NextResponse.json({ count: users.length, users });
}
