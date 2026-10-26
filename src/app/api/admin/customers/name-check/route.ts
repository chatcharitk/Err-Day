import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/customers/name-check — confirm one customer's name.
 *   { id, action: "save", nickname, name, note? }  set nickname / real name (note text goes to notes)
 *   { id, action: "ok" }                            current name is fine — just mark it checked
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as { id?: string; action?: string; nickname?: string; name?: string; note?: string } | null;
  if (!b?.id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const c = await prisma.customer.findUnique({ where: { id: b.id }, select: { notes: true } });
  if (!c) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });

  if (b.action === "ok") {
    await prisma.customer.update({ where: { id: b.id }, data: { nameCheckedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (b.action !== "save") return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  const nickname = b.nickname?.trim() || null;
  const name = b.name?.trim() || nickname || "";
  if (!name) return NextResponse.json({ error: "ต้องมีชื่อเล่นหรือชื่อจริงอย่างน้อยหนึ่งช่อง" }, { status: 400 });
  const note = b.note?.trim();
  await prisma.customer.update({
    where: { id: b.id },
    data: {
      name, nickname, nameCheckedAt: new Date(),
      ...(note ? { notes: [c.notes?.trim(), `ข้อมูลเดิมในชื่อ: ${note}`].filter(Boolean).join("\n") } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
