/**
 * LINE Messaging API webhook for @err.day.
 *
 * REPLY POLICY (very narrow on purpose):
 *
 *   ✓ Reply WITH 2 Flex messages — tarot card + Google review CTA —
 *     ONLY when the inbound text exactly matches a tarot keyword
 *     ("คำทำนาย <English card name>"). This is what the printed QR codes
 *     send when scanned.
 *
 *   ✗ For ANY other message (regular customer chat, stickers, photos,
 *     unrelated text), the webhook stays SILENT. Staff continue to reply
 *     manually — there is no AI auto-reply, no fallback message, nothing.
 *
 * Also captures (lineUserId → displayName) into NotificationLog so admin
 * can look up the right LINE userIds — invisible to the customer.
 *
 * Signature verification runs only if LINE_CHANNEL_SECRET is set, so dev
 * environments still work. Production should set the secret.
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { replyLine } from "@/lib/line-messaging";
import { findCardByKeyword } from "@/lib/flex/tarot-cards";
import { buildTarotFlex, buildReviewFlex } from "@/lib/flex/tarot";

interface LineEvent {
  type:        string;
  replyToken?: string;
  source?:     { type: string; userId?: string; groupId?: string; roomId?: string };
  message?:    { type: string; text?: string; id?: string };
}

// Profile names change rarely. LINE group traffic can contain many events from
// the same staff/customer, so avoid repeating one external profile request +
// one database upsert for every message. Fluid instances may serve concurrent
// requests; the in-flight map also coalesces duplicates that arrive together.
const PROFILE_CAPTURE_TTL_MS = 24 * 60 * 60 * 1000;
const capturedProfiles = new Map<string, number>();
const profileCapturesInFlight = new Map<string, Promise<void>>();


export async function POST(request: Request) {
  // Read raw body once (needed for signature verification).
  const rawBody = await request.text();

  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  const events = body.events ?? [];

  // Process all events in parallel. Vercel terminates the function shortly
  // after the response is returned, so we MUST await everything before
  // returning the 200 OK.
  await Promise.all(events.map(processEvent));

  return NextResponse.json({ ok: true });
}


async function processEvent(event: LineEvent): Promise<void> {
  const userId = event.source?.userId;

  // Profile capture and reply processing run in parallel, but both are awaited.
  // Previously captureProfile was fire-and-forget, allowing work and errors to
  // spill into a later, unrelated request on the same Fluid instance.
  const profileTask = userId
    ? captureProfileOnce(userId).catch(e => console.error("[webhook] capture failed", e))
    : Promise.resolve();
  await Promise.all([profileTask, processReply(event, userId)]);
}

async function processReply(event: LineEvent, userId: string | undefined): Promise<void> {
  // Narrow reply rule: ONLY tarot keywords. Everything else is silent.
  if (event.type !== "message")               return;
  if (event.message?.type !== "text")         return;
  if (!event.replyToken)                      return;

  const text = event.message.text?.trim() ?? "";

  // Group/room helper: reply with the chat id on demand, so staff can wire the
  // branch → group notifications. Works in any group/room the OA is a member of.
  const groupId = event.source?.groupId ?? event.source?.roomId;
  if (groupId && /^(groupid|group\s*id|ไอดีกลุ่ม|\/id)$/i.test(text)) {
    console.log(`[webhook] group id requested: ${groupId}`);
    await replyLine(event.replyToken, [{ type: "text", text: `Group ID:\n${groupId}` }]);
    return;
  }

  const card = findCardByKeyword(text);
  if (!card) {
    // Not a tarot keyword — stay silent (let staff reply manually).
    return;
  }

  console.log(`[webhook] tarot keyword matched: "${text}" → card=${card.id} user=${userId}`);
  try {
    const messages = [
      buildTarotFlex(card),
      buildReviewFlex(),
    ];
    const result = await replyLine(event.replyToken, messages);
    if (!result.ok) {
      console.error("[webhook] tarot reply failed:", result.error);
    }
  } catch (e) {
    console.error("[webhook] tarot reply error:", e);
    // No fallback message — never leak that the bot is processing.
  }
}


// ─── Helpers ───────────────────────────────────────────────────────────────

function verifySignature(request: Request, rawBody: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!secret) {
    // No secret configured → skip verification (dev / unconfigured env)
    return true;
  }
  const provided = request.headers.get("x-line-signature");
  if (!provided) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}


async function captureProfile(userId: string) {
  const profile = await fetchProfile(userId);
  const displayName = profile?.displayName ?? "unknown";

  await prisma.notificationLog.upsert({
    where:  { kind_targetId: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}` } },
    create: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}`, status: "SKIPPED", recipient: userId, error: displayName },
    update: { recipient: userId, error: displayName },
  });
}

async function captureProfileOnce(userId: string): Promise<void> {
  const now = Date.now();
  if ((capturedProfiles.get(userId) ?? 0) > now) return;

  const existing = profileCapturesInFlight.get(userId);
  if (existing) return existing;

  const task = captureProfile(userId)
    .then(() => {
      capturedProfiles.set(userId, Date.now() + PROFILE_CAPTURE_TTL_MS);
      // Keep a long-lived Fluid instance bounded even if many LINE users write.
      if (capturedProfiles.size > 1_000) {
        for (const [id, expires] of capturedProfiles) {
          if (expires <= Date.now()) capturedProfiles.delete(id);
        }
        while (capturedProfiles.size > 1_000) {
          const oldestId = capturedProfiles.keys().next().value as string | undefined;
          if (!oldestId) break;
          capturedProfiles.delete(oldestId);
        }
      }
    })
    .finally(() => {
      profileCapturesInFlight.delete(userId);
    });

  profileCapturesInFlight.set(userId, task);
  return task;
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
