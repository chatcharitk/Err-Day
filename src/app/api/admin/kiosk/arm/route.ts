import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, destroySession } from "@/lib/admin-auth";
import { KIOSK_COOKIE, mintKioskToken } from "@/lib/kiosk-auth";

/**
 * Arm this device as the front-desk kiosk for a branch. Admin-only (the owner
 * does this once per device). Sets the long-lived signed kiosk cookie; after
 * this, `/desk` works with no further login.
 *
 * The admin session used to arm is destroyed on success: the kiosk is a shared
 * staff device, and leaving the owner's session on it would let anyone open
 * /admin (other branches, BI, payroll) from the front desk.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  const { branchId } = await request.json().catch(() => ({}));
  if (!branchId || typeof branchId !== "string") {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, isActive: true },
  });
  if (!branch || !branch.isActive) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  // Log the arming admin out of THIS device (session row deleted + cookie
  // cleared) — the desk keeps only the kiosk cookie.
  await destroySession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(KIOSK_COOKIE.name, mintKioskToken(branch.id), {
    httpOnly: KIOSK_COOKIE.httpOnly,
    sameSite: KIOSK_COOKIE.sameSite,
    secure:   KIOSK_COOKIE.secure,
    path:     KIOSK_COOKIE.path,
    maxAge:   KIOSK_COOKIE.maxAge,
  });
  return res;
}
