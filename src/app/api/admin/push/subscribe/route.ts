import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Save (upsert) a Web Push subscription for the current admin's device. Accepts
 * the raw PushSubscription JSON (either at the top level or under `subscription`).
 */
export async function POST(request: Request) {
  const me = await requireAdmin().catch((e: unknown) => e as Response);
  if (me instanceof Response) return me;

  const body = await request.json().catch(() => ({}));
  const sub = body?.subscription ?? body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;

  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    update: { userId: me.id, p256dh, auth, userAgent, lastSeenAt: new Date() },
    create: { userId: me.id, endpoint, p256dh, auth, userAgent },
  });

  return NextResponse.json({ ok: true });
}
