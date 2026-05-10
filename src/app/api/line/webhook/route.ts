/**
 * LINE Messaging API webhook.
 * On any event (follow, message, postback) from a LINE user, we fetch their
 * profile and store (userId → displayName) in NotificationLog so admin can
 * retrieve the correct LINE user IDs.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface LineEvent {
  type: string;
  source?: { type: string; userId?: string };
}

export async function POST(request: Request) {
  let body: { events?: LineEvent[] };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: true }); }

  for (const event of body.events ?? []) {
    const userId = event.source?.userId;
    if (!userId) continue;

    try {
      const profile = await fetchProfile(userId);
      const displayName = profile?.displayName ?? "unknown";

      // Store using NotificationLog — kind=BOOKING_REMINDER_4H, targetId=line-cap-{userId}
      // so it doesn't conflict with real booking notifications.
      await prisma.notificationLog.upsert({
        where:  { kind_targetId: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}` } },
        create: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}`, status: "SKIPPED", recipient: userId, error: displayName },
        update: { recipient: userId, error: displayName },
      });

      console.log(`[webhook] captured userId=${userId} displayName=${displayName}`);
    } catch (e) {
      console.error("[webhook] error processing event", e);
    }
  }

  return NextResponse.json({ ok: true });
}

async function fetchProfile(userId: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ userId: string; displayName: string }>;
}
