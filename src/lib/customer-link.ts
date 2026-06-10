/**
 * Signed, expiring tokens for the "link your LINE account" flow.
 *
 * Staff generate a per-customer link (admin → customer profile). The token
 * identifies which Customer record to link, so when the customer opens the link
 * in LINE and logs in once, their `lineUserId` is attached to *that* record —
 * no phone typing. HMAC-signed (same secret as the staff session) so the token
 * is unguessable and stateless — no DB column or migration required.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_DAYS = 14;

function getSecret(): string {
  const s = process.env.STAFF_SESSION_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("STAFF_SESSION_SECRET (or CRON_SECRET fallback) is not set");
  return s;
}

interface LinkPayload {
  customerId: string;
  exp:        number;  // unix seconds
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/** Sign a customer-link token (HMAC-SHA256). Default 14-day expiry. */
export function signLinkToken(customerId: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const exp  = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const body = b64urlEncode(Buffer.from(JSON.stringify({ customerId, exp } satisfies LinkPayload)));
  const sig  = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Verify a customer-link token; returns the customerId, or null if invalid/expired. */
export function verifyLinkToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { return null; }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as LinkPayload;
    if (typeof payload.customerId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.customerId;
  } catch {
    return null;
  }
}
