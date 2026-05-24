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
  /**
   * Async function that produces the reply text for an inbound message.
   * **Return `null` to skip sending any reply** — useful for "silent mode"
   * where staff replies manually and the bot should be invisible to
   * customers (no auto-reply leaks that an AI is involved).
   */
  buildReply:    (event: TextMessageEvent) => Promise<string | null>;
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

    const events = body.events ?? [];
    console.log(`[webhook:${config.label}] received ${events.length} event(s)`);

    // Process all events. Reply must be AWAITED — Vercel terminates the
    // function shortly after the response is sent, so fire-and-forget
    // async work isn't guaranteed to complete.
    await Promise.all(events.map(event => processEvent(event, config)));

    return NextResponse.json({ ok: true });
  };
}

async function processEvent(event: LineEvent, config: WebhookConfig): Promise<void> {
  const userId = event.source?.userId;

  // Profile capture is independent of the reply path — fire it off in parallel.
  const captureP = userId
    ? captureProfile(userId, config.accessToken, config.label).catch(e =>
        console.error(`[webhook:${config.label}] capture failed`, e))
    : Promise.resolve();

  if (isTextMessage(event)) {
    console.log(`[webhook:${config.label}] text from ${userId}: "${event.message.text.slice(0, 60)}"`);
    try {
      const text = await config.buildReply(event);

      // null = silent mode — buildReply explicitly opted out of replying.
      // Used in production where staff handle replies manually and we don't
      // want any visible auto-message to the customer.
      if (text === null) {
        console.log(`[webhook:${config.label}] silent — no reply sent`);
      } else {
        const result = await replyText(event.replyToken, text, { token: config.accessToken });
        if (!result.ok) {
          console.error(`[webhook:${config.label}] reply failed:`, result.error);
        } else {
          console.log(`[webhook:${config.label}] reply sent ok`);
        }
      }
    } catch (e) {
      console.error(`[webhook:${config.label}] reply pipeline error`, e);
      // No fallback message here — if the agent errored on the prod channel
      // in silent mode, we still don't want to leak "AI" to the customer.
      // The test channel handles its own fallback inside buildReply.
    }
  }

  await captureP;
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
