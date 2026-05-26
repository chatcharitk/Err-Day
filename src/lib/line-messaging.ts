/**
 * Thin wrapper around the LINE Messaging API.
 *
 * Reads `LINE_CHANNEL_ACCESS_TOKEN` from the environment. If the token is
 * not set, every push call resolves with { ok: false, error: "no_token" } so
 * the rest of the system can keep working in development without LINE
 * credentials configured.
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/
 */

const PUSH_URL  = "https://api.line.me/v2/bot/message/push";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export type LineMessage =
  | { type: "text"; text: string }
  | { type: "flex"; altText: string; contents: unknown };

export interface PushResult {
  ok:    boolean;
  error?: string;
}

function getToken(): string | null {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

/**
 * Push one or more messages to a single LINE userId.
 * If `LINE_CHANNEL_ACCESS_TOKEN` is missing, returns { ok: false, error: "no_token" }
 * without making a request — handy in dev / preview deployments.
 */
export async function pushLine(
  toLineUserId: string,
  messages: LineMessage[],
): Promise<PushResult> {
  const token = getToken();
  if (!token) return { ok: false, error: "no_token" };
  if (!toLineUserId) return { ok: false, error: "no_recipient" };
  if (messages.length === 0) return { ok: false, error: "no_messages" };
  if (messages.length > 5)   return { ok: false, error: "too_many_messages" }; // LINE caps at 5 per push

  try {
    const res = await fetch(PUSH_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ to: toLineUserId, messages }),
    });

    if (res.ok) return { ok: true };

    // LINE returns 4xx with { message: "...", details: [...] } on user-facing errors.
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    return { ok: false, error: `${res.status} ${body.slice(0, 300)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}

/** Convenience helper for the common single-text-message case. */
export async function pushText(toLineUserId: string, text: string): Promise<PushResult> {
  return pushLine(toLineUserId, [{ type: "text", text }]);
}


/**
 * Reply to an inbound LINE message using the replyToken from the webhook event.
 *
 * Replies vs push: reply is **free** and doesn't count toward the monthly
 * push quota. ReplyTokens are valid for ~30 seconds and one-shot only.
 *
 * Used by /api/line/webhook for tarot QR responses ONLY — never for general
 * chat (other messages stay silent so staff reply manually).
 */
export async function replyLine(
  replyToken: string,
  messages: LineMessage[],
): Promise<PushResult> {
  const token = getToken();
  if (!token)                return { ok: false, error: "no_token" };
  if (!replyToken)           return { ok: false, error: "no_reply_token" };
  if (messages.length === 0) return { ok: false, error: "no_messages" };
  if (messages.length > 5)   return { ok: false, error: "too_many_messages" };

  try {
    const res = await fetch(REPLY_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });

    if (res.ok) return { ok: true };

    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    return { ok: false, error: `${res.status} ${body.slice(0, 300)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}
