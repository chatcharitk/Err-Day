import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isPushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Recent in-app notifications + unread count for the current admin. */
export async function GET() {
  const me = await requireAdmin().catch((e: unknown) => e as Response);
  if (me instanceof Response) return me;

  const [items, unread] = await Promise.all([
    prisma.adminNotification.findMany({
      where:   { userId: me.id },
      orderBy: { createdAt: "desc" },
      take:    20,
      select:  { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.adminNotification.count({ where: { userId: me.id, readAt: null } }),
  ]);

  return NextResponse.json({
    unread,
    pushReady: isPushConfigured(),
    items: items.map(i => ({
      ...i,
      readAt:    i.readAt ? i.readAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
