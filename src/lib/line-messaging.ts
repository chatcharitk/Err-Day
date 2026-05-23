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

function getToken(override?: string | null): string | null {
  // Allow callers (e.g. the test webhook) to pass their own channel token so a
  // single deployment can serve multiple LINE Messaging API channels.
  const candidate = override ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const t = candidate?.trim();
  return t && t.length > 0 ? t : null;
}

/** Options accepted by all push/reply helpers. */
export interface LineOptions {
  /** Override the default channel access token (defaults to LINE_CHANNEL_ACCESS_TOKEN env). */
  token?: string | null;
}

/**
 * Push one or more messages to a single LINE userId.
 * If `LINE_CHANNEL_ACCESS_TOKEN` is missing, returns { ok: false, error: "no_token" }
 * without making a request — handy in dev / preview deployments.
 */
export async function pushLine(
  toLineUserId: string,
  messages: LineMessage[],
  options?: LineOptions,
): Promise<PushResult> {
  const token = getToken(options?.token);
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
export async function pushText(toLineUserId: string, text: string, options?: LineOptions): Promise<PushResult> {
  return pushLine(toLineUserId, [{ type: "text", text }], options);
}

/**
 * Reply to an inbound LINE message using its `replyToken`.
 *
 * Replies vs push: reply messages are **free** and don't count toward the
 * monthly push-message quota. Each replyToken is valid for ~30 seconds and
 * can only be used once — if the user expects a follow-up message later,
 * use pushLine() instead.
 *
 * Used by /api/line/webhook to send AI agent / auto-reply messages.
 */
export async function replyLine(
  replyToken: string,
  messages: LineMessage[],
  options?: LineOptions,
): Promise<PushResult> {
  const token = getToken(options?.token);
  if (!token)                  return { ok: false, error: "no_token" };
  if (!replyToken)             return { ok: false, error: "no_reply_token" };
  if (messages.length === 0)   return { ok: false, error: "no_messages" };
  if (messages.length > 5)     return { ok: false, error: "too_many_messages" };

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

/** Convenience: reply with a single text message. */
export async function replyText(replyToken: string, text: string, options?: LineOptions): Promise<PushResult> {
  return replyLine(replyToken, [{ type: "text", text }], options);
}
