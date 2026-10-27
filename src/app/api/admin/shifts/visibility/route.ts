import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { mondayKey } from "@/lib/shift-visibility";

/** GET ?week=YYYY-MM-DD → { week, hidden } · POST { week, hidden } — show/hide a week's roster in the staff app. */
export async function GET(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const w = new URL(request.url).searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) return NextResponse.json({ error: "invalid week" }, { status: 400 });
  const week = mondayKey(w);
  const row = await prisma.shiftWeekVisibility.findUnique({ where: { weekStart: week } });
  return NextResponse.json({ week, hidden: !!row?.hidden });
}

export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as { week?: string; hidden?: boolean } | null;
  if (!b?.week || !/^\d{4}-\d{2}-\d{2}$/.test(b.week)) return NextResponse.json({ error: "invalid week" }, { status: 400 });
  const week = mondayKey(b.week);
  const row = await prisma.shiftWeekVisibility.upsert({
    where: { weekStart: week },
    create: { weekStart: week, hidden: !!b.hidden, updatedBy: gate.name },
    update: { hidden: !!b.hidden, updatedBy: gate.name },
  });
  return NextResponse.json({ week, hidden: row.hidden });
}
