/**
 * In-app admin notifications — the web-app replacement for owner LINE DMs.
 * `notifyAdmins` writes one AdminNotification row per active admin and fires a
 * Web Push to each admin's devices. Fire-and-forget: it never throws into the
 * caller (mirrors the LINE senders' .catch() style).
 */

import { prisma } from "@/lib/prisma";
import { sendWebPush } from "@/lib/push";

export interface AdminNotifyInput {
  /** Stable kind for icon/grouping, e.g. "BOOKING_NEW" | "BOOKING_CANCELLED" | "SUMMARY" | "PAYROLL". */
  type:     string;
  title:    string;
  body:     string;
  href?:    string;
  branchId?: string;
}

export async function notifyAdmins(input: AdminNotifyInput): Promise<void> {
  try {
    const admins = await prisma.adminUser.findMany({
      where: { isActive: true }, select: { id: true },
    });
    if (admins.length === 0) return;

    await prisma.adminNotification.createMany({
      data: admins.map((a) => ({
        userId:   a.id,
        type:     input.type,
        title:    input.title,
        body:     input.body,
        href:     input.href ?? null,
        branchId: input.branchId ?? null,
      })),
    });

    const subs = await prisma.pushSubscription.findMany({
      where:  { userId: { in: admins.map((a) => a.id) } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    await sendWebPush(subs, { title: input.title, body: input.body, url: input.href, tag: input.type });
  } catch (e) {
    console.error("[notify-admin] failed", e);
  }
}
