/**
 * Front-desk kiosk auth (the shared `/desk` board).
 *
 * Unlike the per-staff portal (`staff-auth.ts`), the kiosk is a *device*
 * session, not a person. The owner arms a device ONCE — picking which branch
 * it belongs to from `/desk/setup` while logged in as admin — and we drop a
 * long-lived HMAC-signed cookie `{ branchId, exp }`. After that, any staff can
 * walk up and use the board with no login; they identify themselves per-booking
 * by tapping their name.
 *
 * Same HMAC-SHA256-over-JSON scheme as staff-auth: only our server reads the
 * cookie, so a signed payload is enough and keeps the dependency surface small.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME   = "kiosk_session";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year — it's a fixed in-store device

function getSecret(): string {
  const s = process.env.STAFF_SESSION_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("STAFF_SESSION_SECRET (or CRON_SECRET fallback) is not set");
  return s;
}

// ── Signed cookie ────────────────────────────────────────────────────────────

interface KioskPayload {
  branchId: string;
  exp:      number; // unix seconds
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signKiosk(payload: KioskPayload): string {
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  const sig  = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyKiosk(token: string | undefined): KioskPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { return null; }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as KioskPayload;
    if (typeof payload.branchId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const KIOSK_COOKIE = {
  name:     COOKIE_NAME,
  maxAge:   COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure:   process.env.NODE_ENV === "production",
  path:     "/",
};

/** Build a fresh signed token for `branchId` (expiring COOKIE_MAX_AGE from now). */
export function mintKioskToken(branchId: string): string {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  return signKiosk({ branchId, exp });
}

// ── Current-kiosk helper ─────────────────────────────────────────────────────

export type KioskBranch = { id: string; name: string };

// Per-Lambda cache of the branch-validation lookup. The kiosk devices poll
// every ~45s all day, and the branchId is already HMAC-signed in the cookie —
// re-verifying "branch still active" against the DB once a minute per Lambda
// is plenty (a deactivated branch's device falls back to setup within the TTL).
const kioskBranchCache = new Map<string, { value: KioskBranch | null; expires: number }>();
const KIOSK_BRANCH_CACHE_MS = 60_000;

/**
 * Reads + validates the kiosk cookie and returns the armed branch. Returns null
 * on missing/invalid/expired cookie OR if the branch has since been deactivated
 * (so a retired branch's device falls back to the setup screen).
 */
export async function getKioskBranch(): Promise<KioskBranch | null> {
  const jar = await cookies();
  const payload = verifyKiosk(jar.get(COOKIE_NAME)?.value);
  if (!payload) return null;

  const cached = kioskBranchCache.get(payload.branchId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const branch = await prisma.branch.findUnique({
    where:  { id: payload.branchId },
    select: { id: true, name: true, isActive: true },
  });
  const value = branch && branch.isActive ? { id: branch.id, name: branch.name } : null;
  kioskBranchCache.set(payload.branchId, { value, expires: Date.now() + KIOSK_BRANCH_CACHE_MS });
  return value;
}
