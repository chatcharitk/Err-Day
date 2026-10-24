import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isValidLocation, submitCount, StockError } from "@/lib/stock";

/**
 * POST /api/admin/stock/products/bulk — add many products sharing category /
 * brand / size / unit (e.g. every shade of one color line).
 *   { category, brand, size, unit, usage, items: [{ name, qty? }], location? }
 * Existing products (same name + brand + size) are reused, not duplicated.
 * When any qty is given and `location` is set, those are recorded as a count there.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b || !Array.isArray(b.items)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "") || null;
  const category = str("category"), brand = str("brand"), size = str("size");
  const unit = str("unit") || "ชิ้น";
  const usage = ["USE", "SALE", "BOTH"].includes(String(b.usage)) ? String(b.usage) : "USE";
  const items = (b.items as { name?: unknown; qty?: unknown }[])
    .map(i => ({ name: String(i.name ?? "").trim(), qty: i.qty == null || i.qty === "" ? null : Number(i.qty) }))
    .filter(i => i.name);
  if (!items.length) return NextResponse.json({ error: "ยังไม่ได้ใส่ชื่อสินค้า" }, { status: 400 });
  if (items.length > 300) return NextResponse.json({ error: "ครั้งละไม่เกิน 300 รายการ" }, { status: 400 });
  if (items.some(i => i.qty != null && (!Number.isInteger(i.qty) || i.qty < 0))) return NextResponse.json({ error: "จำนวนต้องเป็นเลขจำนวนเต็ม" }, { status: 400 });
  const location = typeof b.location === "string" && b.location ? b.location : null;
  if (location && !(await isValidLocation(location))) return NextResponse.json({ error: "ไม่พบสถานที่" }, { status: 400 });

  let created = 0;
  const lines: { productId: string; counted: number }[] = [];
  for (const i of items) {
    let p = await prisma.product.findFirst({ where: { name: i.name, brand, size }, select: { id: true } });
    if (!p) { p = await prisma.product.create({ data: { name: i.name, brand, size, unit, usage, category }, select: { id: true } }); created++; }
    else if (category) await prisma.product.update({ where: { id: p.id }, data: { category } });
    if (i.qty != null) lines.push({ productId: p.id, counted: i.qty });
  }
  let counted = 0;
  if (location && lines.length) {
    try {
      await submitCount(location, lines, { name: gate.name, adminId: gate.id }, "เพิ่มสินค้าหลายรายการ");
      counted = lines.length;
    } catch (e) {
      if (e instanceof StockError) return NextResponse.json({ error: e.message, created }, { status: 400 });
      throw e;
    }
  }
  return NextResponse.json({ ok: true, created, reused: items.length - created, counted });
}
