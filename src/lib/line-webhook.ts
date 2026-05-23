/**
 * Shared LINE webhook handler used by both the production and test webhook
 * routes. The two routes only differ in which env vars they read (so the
 * salon can run a sandbox LINE OA alongside the live one).
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { replyText } from "@/lib/line-messaging";

export interface WebhookConfig {
  /** Human-readable name for logs (e.g. "prod" / "test"). */
  label:        string;
  /** Channel secret (HMAC signing key from LINE Developers Console). */
  channelSecret: string | undefined;
  /** Channel access token (used for fetching profile + sending replies). */
  accessToken:   string | undefined;
  /** Async function that produces the reply text for a given inbound message. */
  buildReply:    (event: TextMessageEvent) => Promise<string>;
}

export interface LineEvent {
  type:        string;
  replyToken?: string;
  source?:     { type: string; userId?: string };
  message?:    { type: string; text?: string };
}
export interface TextMessageEvent extends LineEvent {
  type: "message";
  replyToken: string;
  source: { type: string; userId?: string };
  message: { type: "text"; text: string };
}


/**
 * Build a Next.js POST handler for a LINE webhook with the given config.
 * Verifies the signature, captures lineUserId → displayName, and replies
 * to text messages using the config's buildReply function.
 */
export function createLineWebhookHandler(config: WebhookConfig) {
  return async function POST(request: Request) {
    const rawBody = await request.text();

    if (!verifySignature(request, rawBody, config.channelSecret, config.label)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    let body: { events?: LineEvent[] };
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

    for (const event of body.events ?? []) {
      const userId = event.source?.userId;

      if (userId) {
        captureProfile(userId, config.accessToken, config.label)
          .catch(e => console.error(`[webhook:${config.label}] capture failed`, e));
      }

      if (isTextMessage(event)) {
        // Don't block the LINE retry timeout — fire reply in the background.
        (async () => {
          try {
            const text = await config.buildReply(event);
            const result = await replyText(event.replyToken, text, { token: config.accessToken });
            if (!result.ok) console.error(`[webhook:${config.label}] reply failed`, result.error);
          } catch (e) {
            console.error(`[webhook:${config.label}] reply pipeline error`, e);
            // Fallback: send a generic apology so the customer isn't left hanging.
            replyText(event.replyToken,
              "ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาติดต่อร้านโดยตรงได้เลยค่ะ",
              { token: config.accessToken },
            ).catch(() => {});
          }
        })();
      }
    }

    return NextResponse.json({ ok: true });
  };
}


// ─── helpers ────────────────────────────────────────────────────────────────

function isTextMessage(event: LineEvent): event is TextMessageEvent {
  return event.type === "message"
      && event.message?.type === "text"
      && typeof event.message?.text === "string"
      && typeof event.replyToken === "string";
}

function verifySignature(
  request: Request,
  rawBody: string,
  channelSecret: string | undefined,
  label: string,
): boolean {
  const secret = channelSecret?.trim();
  if (!secret) {
    console.warn(`[webhook:${label}] channel secret not set — skipping signature verification`);
    return true;
  }

  const provided = request.headers.get("x-line-signature");
  if (!provided) {
    console.warn(`[webhook:${label}] missing x-line-signature header`);
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function captureProfile(userId: string, accessToken: string | undefined, label: string) {
  const profile = await fetchProfile(userId, accessToken);
  const displayName = profile?.displayName ?? "unknown";

  await prisma.notificationLog.upsert({
    where:  { kind_targetId: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}` } },
    create: { kind: "BOOKING_REMINDER_4H", targetId: `line-cap-${userId}`, status: "SKIPPED", recipient: userId, error: `[${label}] ${displayName}` },
    update: { recipient: userId, error: `[${label}] ${displayName}` },
  });
}

async function fetchProfile(userId: string, accessToken: string | undefined) {
  const token = accessToken?.trim();
  if (!token) return null;
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ userId: string; displayName: string }>;
}
