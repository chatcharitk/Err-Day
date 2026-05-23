/**
 * LINE Messaging API webhook.
 *
 * Two jobs:
 *   1. Capture (lineUserId → displayName) from any event so admin can
 *      look up the right LINE user IDs for staff alerts.
 *   2. Reply to inbound TEXT messages (Phase 1: a stub; Phase 2+: routed
 *      to the Claude AI agent).
 *
 * Security: LINE signs every webhook payload with HMAC-SHA256(channelSecret,
 * body). We verify when LINE_CHANNEL_SECRET is set, and log + skip when it
 * isn't (so dev environments without the secret still work).
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { replyText } from "@/lib/line-messaging";

interface LineEvent {
  type:        string;                    // "message" | "follow" | "unfollow" | "postback" | …
  replyToken?: string;                    // present on message/postback/follow
  source?:     { type: string; userId?: string };
  message?:    { type: string; text?: string };
}

// Stub reply while the AI agent is being set up. Will be replaced in Phase 2.
const STUB_REPLY =
  "สวัสดีค่ะ 🌸 ขอบคุณที่ติดต่อ err.day\n\n" +
  "ขณะนี้ระบบ AI ผู้ช่วยกำลังเตรียมพร้อม\n" +
  "📅 จองคิวออนไลน์: https://err-day.vercel.app/book\n" +
  "👥 สมาชิก: https://err-day.vercel.app/membership\n\n" +
  "หรือพิมพ์ข้อความรอแอดมินตอบกลับได้เลยค่ะ";


export async function POST(request: Request) {
  // Read raw body once (needed for signature verification).
  const rawBody = await request.text();

  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  for (const event of body.events ?? []) {
    const userId = event.source?.userId;

    // ── Profile capture (preserves existing behavior) ────────────────────────
    if (userId) {
      captureProfile(userId).catch(e => console.error("[webhook] capture failed", e));
    }

    // ── Text message → stub reply ───────────────────────────────────────────
    if (event.type === "message"
        && event.message?.type === "text"
        && event.replyToken) {
      // Fire-and-forget — don't block returning 200 to LINE (they retry on slow responses).
      replyText(event.replyToken, STUB_REPLY).catch(e =>
        console.error("[webhook] reply failed", e),
      );
    }
  }

  return NextResponse.json({ ok: true });
}


// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates LINE's x-line-signature header against HMAC-SHA256(secret, body).
 * Returns true if the signature is valid OR if no secret is configured
 * (graceful dev-mode behavior — logs a warning).
 */
function verifySignature(request: Request, rawBody: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!secret) {
    console.warn("[webhook] LINE_CHANNEL_SECRET not set — skipping signature verification");
    return true;
  }

  const provided = request.headers.get("x-line-signature");
  if (!provided) {
    console.warn("[webhook] missing x-line-signature header");
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Look up the LINE user's profile and stash (userId → displayName) so admin
 * can find the right ID when sending manual notifications.
 */
async function captureProfile(userId: string) {
  const profile = await fetchProfile(userId);
  const displayName = profile?.displayName ?? "unknown";

  await prisma.notificationLog.upsert({
    where:  { kind_targetId: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}` } },
    create: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}`, status: "SKIPPED", recipient: userId, error: displayName },
    update: { recipient: userId, error: displayName },
  });
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
