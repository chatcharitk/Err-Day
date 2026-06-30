import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/** Mark one notification (`{ id }`) or all (`{ all: true }`) read — scoped to the
 *  current admin so one admin can't touch another's feed. */
export async function POST(request: Request) {
  const me = await requireAdmin().catch((e: unknown) => e as Response);
  if (me instanceof Response) return me;

  const { id, all } = await request.json().catch(() => ({}));

  if (all === true) {
    await prisma.adminNotification.updateMany({
      where: { userId: me.id, readAt: null },
      data:  { readAt: new Date() },
    });
  } else if (typeof id === "string") {
    await prisma.adminNotification.updateMany({
      where: { id, userId: me.id, readAt: null },
      data:  { readAt: new Date() },
    });
  } else {
    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
