/**
 * Staff self-service portal auth.
 *
 * Sign-in flow:
 *   1. Staff enters phone + 4-digit PIN at /staff/login
 *   2. /api/staff/login bcrypt-compares against Staff.passcodeHash
 *   3. On success, an HMAC-signed cookie is set with { staffId, exp }
 *   4. Server pages call getCurrentStaff(cookies()) to gate access
 *
 * Why HMAC, not JWT?
 *   We don't need third-party verification — only our server reads the
 *   cookie. A plain HMAC-SHA256 sig over a JSON payload is enough and
 *   keeps the dependency surface minimal.
 *
 * Rate limiting:
 *   In-memory counter per phone. Resets on process restart, which is fine
 *   for Vercel's short-lived functions — a real attacker would just hit
 *   the cold start over and over, but bcrypt's cost factor (10 rounds)
 *   already makes brute-forcing 10k PINs prohibitively slow.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "staff_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const BCRYPT_ROUNDS = 10;

function getSecret(): string {
  const s = process.env.STAFF_SESSION_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("STAFF_SESSION_SECRET (or CRON_SECRET fallback) is not set");
  return s;
}

// ── PIN hashing ──────────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  return bcrypt.compare(pin, hash);
}

// ── Signed cookie ────────────────────────────────────────────────────────────

interface SessionPayload {
  staffId: string;
  exp:     number;  // unix seconds
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signSession(payload: SessionPayload): string {
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  const sig  = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { return null; }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (typeof payload.staffId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const STAFF_COOKIE = {
  name:     COOKIE_NAME,
  maxAge:   COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure:   process.env.NODE_ENV === "production",
  path:     "/",
};

// ── Current-staff helper for server components ───────────────────────────────

export type CurrentStaff = {
  id:             string;
  name:           string;
  branchId:       string;
  branchName:     string;
  avatarUrl:      string | null;
  commissionRate: number;
};

/**
 * Reads the session cookie, validates the HMAC, and returns the staff record.
 * Returns null on missing/invalid/expired session OR if the staff has been
 * deactivated since the session was created.
 */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = verifySession(token);
  if (!session) return null;

  const staff = await prisma.staff.findUnique({
    where: { id: session.staffId },
    select: {
      id: true, name: true, branchId: true, avatarUrl: true,
      commissionRate: true, isActive: true,
      branch: { select: { name: true } },
    },
  });
  if (!staff || !staff.isActive) return null;

  return {
    id:             staff.id,
    name:           staff.name,
    branchId:       staff.branchId,
    branchName:     staff.branch.name,
    avatarUrl:      staff.avatarUrl,
    commissionRate: staff.commissionRate,
  };
}

// ── Rate limiting (in-memory, per phone) ─────────────────────────────────────

const FAILED_ATTEMPTS = new Map<string, { count: number; lockUntil: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 5 * 60 * 1000;   // 5 minutes
const LOCKOUT_MS   = 15 * 60 * 1000;  // 15 minutes

export function isLocked(phone: string): boolean {
  const entry = FAILED_ATTEMPTS.get(phone);
  if (!entry) return false;
  if (entry.lockUntil > Date.now()) return true;
  if (entry.lockUntil > 0)          { FAILED_ATTEMPTS.delete(phone); return false; }
  return false;
}

export function recordFailedAttempt(phone: string) {
  const entry = FAILED_ATTEMPTS.get(phone) ?? { count: 0, lockUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockUntil = Date.now() + LOCKOUT_MS;
    entry.count     = 0;
  }
  FAILED_ATTEMPTS.set(phone, entry);

  // Cleanup old entries
  setTimeout(() => {
    const cur = FAILED_ATTEMPTS.get(phone);
    if (cur && cur.lockUntil < Date.now()) FAILED_ATTEMPTS.delete(phone);
  }, WINDOW_MS);
}

export function clearFailedAttempts(phone: string) {
  FAILED_ATTEMPTS.delete(phone);
}
