import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/** Remove a Web Push subscription for the current admin (on disable / logout). */
export async function POST(request: Request) {
  const me = await requireAdmin().catch((e: unknown) => e as Response);
  if (me instanceof Response) return me;

  const { endpoint } = await request.json().catch(() => ({}));
  if (typeof endpoint === "string") {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
  }

  return NextResponse.json({ ok: true });
}
