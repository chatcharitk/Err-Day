import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseProductInput } from "@/lib/stock-products";
import { isValidLocation } from "@/lib/stock";

/**
 * PATCH /api/admin/stock/products/[id] — edit fields (partial), or set one
 * location's low-stock minimum with { location, minQty } (null = default).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (typeof b.location === "string") {
    if (!(await isValidLocation(b.location))) return NextResponse.json({ error: "ไม่พบสถานที่" }, { status: 400 });
    const min = b.minQty == null || b.minQty === "" ? null : Number(b.minQty);
    if (min != null && (!Number.isInteger(min) || min < 0)) return NextResponse.json({ error: "จำนวนขั้นต่ำไม่ถูกต้อง" }, { status: 400 });
    await prisma.stockLevel.upsert({
      where: { productId_location: { productId: id, location: b.location } },
      create: { productId: id, location: b.location, qty: 0, minQty: min },
      update: { minQty: min },
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = parseProductInput(b, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const product = await prisma.product.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ product });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return NextResponse.json({ error: "สินค้าขายนี้ผูกกับสินค้าอื่นแล้ว" }, { status: 409 });
    if (code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw e;
  }
}
