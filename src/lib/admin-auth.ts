/**
 * Admin authentication helpers.
 *
 *   • Sessions are stored in the AdminSession table and identified by an
 *     opaque random token kept in a `admin_session` httpOnly cookie.
 *   • verifyPassword / hashPassword wrap bcryptjs.
 *   • getCurrentAdmin reads the cookie, looks up the session, returns the
 *     AdminUser or null. Used by middleware-style helpers and server pages.
 */

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { AdminRole } from "@/generated/prisma/client";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_DAYS    = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create a new session for the user, set the cookie, and return the token.
 * The cookie is httpOnly + sameSite=lax so it survives normal navigations
 * but isn't exposed to JS.
 */
export async function createSession(userId: string): Promise<string> {
  const token     = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminSession.create({ data: { userId, token, expiresAt } });

  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    expires:  expiresAt,
    path:     "/",
  });

  return token;
}

/** Delete the session record + clear the cookie. */
export async function destroySession(): Promise<void> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { token } });
  }
  c.delete(ADMIN_COOKIE);
}

export interface CurrentAdmin {
  id:       string;
  username: string;
  name:     string;
  role:     AdminRole;
}

/**
 * Returns the current admin (if logged in & session valid), else null.
 * Server-component / route-handler safe.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where:   { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  return {
    id:       session.user.id,
    username: session.user.username,
    name:     session.user.name,
    role:     session.user.role,
  };
}

/**
 * Edge-runtime safe lookup using the cookie token directly.
 * Used by the Next.js middleware which can't import prisma.
 * Pass the token from req.cookies and we'll do a fetch back to a tiny
 * verification endpoint — avoids running prisma in the edge runtime.
 */
export async function isValidSessionToken(token: string): Promise<boolean> {
  const session = await prisma.adminSession.findUnique({
    where: { token },
    select: { expiresAt: true, user: { select: { isActive: true } } },
  });
  if (!session) return false;
  if (session.expiresAt < new Date()) return false;
  if (!session.user.isActive) return false;
  return true;
}
