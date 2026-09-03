/**
 * PATCH /api/admin/receipts/[id]  { void: true, reason? }
 *
 * Void an issued receipt. A tax document is never deleted and its number is
 * never reused — the row stays, the public page keeps resolving, and it renders
 * with a ยกเลิก mark so a customer holding the paper can see it was cancelled.
 * Owner-only.
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const admin = gate;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({} as { void?: boolean; reason?: string }));

    const existing = await prisma.receipt.findUnique({ where: { id }, select: { id: true, voidedAt: true } });
    if (!existing) return NextResponse.json({ error: "ไม่พบใบเสร็จ" }, { status: 404 });

    // Un-voiding would let a cancelled document be presented as valid again.
    if (body.void === false) {
      return NextResponse.json({ error: "ใบเสร็จที่ยกเลิกแล้วไม่สามารถกู้คืนได้" }, { status: 400 });
    }
    if (existing.voidedAt) {
      return NextResponse.json({ error: "ใบเสร็จนี้ถูกยกเลิกไปแล้ว" }, { status: 409 });
    }

    const receipt = await prisma.receipt.update({
      where: { id },
      data: {
        voidedAt:   new Date(),
        voidReason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
        voidedBy:   admin.name,
      },
      select: { id: true, number: true, voidedAt: true, voidReason: true },
    });
    return NextResponse.json(receipt);
  } catch (e) {
    console.error("[receipts PATCH]", e);
    return NextResponse.json({ error: "ยกเลิกใบเสร็จไม่สำเร็จ" }, { status: 500 });
  }
}
