import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta Messenger Platform — Facebook Page messages and Instagram DMs (Instagram
 * through the Facebook Page it is linked to). Used by the AI inbox only.
 *
 * Env: META_APP_SECRET (webhook signature), META_VERIFY_TOKEN (webhook setup),
 * META_PAGE_ACCESS_TOKEN (send + profiles), optional META_GRAPH_VERSION.
 */

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION?.trim() || "v23.0"}`;
const TIMEOUT_MS = 10_000;

export type MetaChannel = "FACEBOOK" | "INSTAGRAM";

function pageToken(): string | null {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || null;
}

/** X-Hub-Signature-256 = "sha256=" + HMAC(app secret, raw body). Refuses when no secret is set. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function fetchMetaProfile(channel: MetaChannel, userId: string): Promise<{ name: string | null; pictureUrl: string | null }> {
  const token = pageToken();
  if (!token) return { name: null, pictureUrl: null };
  const fields = channel === "INSTAGRAM" ? "name,username,profile_pic" : "first_name,last_name,profile_pic";
  const res = await fetch(`${GRAPH}/${userId}?fields=${fields}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
  if (!res?.ok) return { name: null, pictureUrl: null };
  const p = await res.json() as { name?: string; username?: string; first_name?: string; last_name?: string; profile_pic?: string };
  const name = channel === "INSTAGRAM"
    ? (p.name || (p.username ? `@${p.username}` : null))
    : [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
  return { name, pictureUrl: p.profile_pic ?? null };
}

export type MetaOutgoing = { type: "text"; text: string } | { type: "image"; url: string };

/**
 * Send one message. Inside 24 h of the customer's last message it is a normal
 * reply; later it needs the HUMAN_AGENT tag (allowed up to 7 days, and only once
 * Meta has granted the app that feature).
 */
export async function sendMetaMessage(recipientId: string, msg: MetaOutgoing, opts: { humanAgent: boolean }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = pageToken();
  if (!token) return { ok: false, error: "META_PAGE_ACCESS_TOKEN is not set" };
  const body = {
    recipient: { id: recipientId },
    ...(opts.humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : { messaging_type: "RESPONSE" }),
    message: msg.type === "text" ? { text: msg.text } : { attachment: { type: "image", payload: { url: msg.url, is_reusable: true } } },
  };
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((e: unknown) => ({ ok: false, text: async () => String(e) }) as const);
  const text = await res.text().catch(() => "");
  if (res.ok) {
    try { return { ok: true, messageId: (JSON.parse(text) as { message_id?: string }).message_id }; } catch { return { ok: true }; }
  }
  let message = text.slice(0, 300);
  try { message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message; } catch { /* keep raw */ }
  return { ok: false, error: message };
}
