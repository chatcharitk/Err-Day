import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentStaff } from "@/lib/staff-auth";
import {
  HOME, StockError, applyMoves, cancelTransfer, createTransfer, isValidLocation, receiveTransfer, submitCount, type Actor,
} from "@/lib/stock";

/**
 * POST /api/stock — every stock change from the admin or staff apps.
 *   { action: "count",    location, lines: [{ productId, counted }], note? }
 *   { action: "use",      location, productId, qty, note? }     เบิกใช้
 *   { action: "damage",   location, productId, qty, note }      เสีย / หมดอายุ
 *   { action: "transfer", from, to, items: [{ productId, qty }], note? }   (admin)
 *   { action: "receive",  transferId, received?: { [itemId]: qty } }
 *   { action: "cancel",   transferId }                                     (admin)
 * Staff may act on any branch; the home warehouse is admin-only.
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  const staff = admin ? null : await getCurrentStaff();
  if (!admin && !staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const actor: Actor = admin ? { name: admin.name, adminId: admin.id } : { name: staff!.name, staffId: staff!.id };

  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  async function place(v: unknown): Promise<string> {
    const id = typeof v === "string" ? v : "";
    if (!(await isValidLocation(id))) throw new StockError("ไม่พบสถานที่เก็บสต็อก");
    if (id === HOME && !admin) throw new StockError("เฉพาะแอดมินเท่านั้น");
    return id;
  }
  const int = (v: unknown) => (typeof v === "number" ? v : Number(v));

  try {
    switch (b.action) {
      case "count": {
        const location = await place(b.location);
        const lines = Array.isArray(b.lines) ? (b.lines as { productId: string; counted: unknown }[]).map(l => ({ productId: String(l.productId), counted: int(l.counted) })) : [];
        const r = await submitCount(location, lines, actor, typeof b.note === "string" ? b.note : undefined);
        return NextResponse.json({ ok: true, countId: r.countId, changed: r.lines.filter(l => l.before !== l.after).length });
      }
      case "use":
      case "damage": {
        const location = await place(b.location);
        const qty = int(b.qty);
        if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new StockError("จำนวนไม่ถูกต้อง");
        const note = typeof b.note === "string" ? b.note : null;
        if (b.action === "damage" && !note?.trim()) throw new StockError("กรุณาใส่เหตุผล");
        const [r] = await applyMoves([{ productId: String(b.productId), location, qty: -qty, type: b.action === "use" ? "USE" : "DAMAGE", note }], actor);
        return NextResponse.json({ ok: true, balance: r.after });
      }
      case "transfer": {
        if (!admin) throw new StockError("เฉพาะแอดมินเท่านั้น");
        const from = await place(b.from), to = await place(b.to);
        const items = Array.isArray(b.items) ? (b.items as { productId: string; qty: unknown }[]).map(i => ({ productId: String(i.productId), qty: int(i.qty) })) : [];
        const t = await createTransfer(from, to, items, actor, typeof b.note === "string" ? b.note : undefined);
        return NextResponse.json({ ok: true, transferId: t.id });
      }
      case "receive": {
        const received = b.received && typeof b.received === "object" ? Object.fromEntries(Object.entries(b.received as Record<string, unknown>).map(([k, v]) => [k, int(v)])) : null;
        await receiveTransfer(String(b.transferId), received, actor);
        return NextResponse.json({ ok: true });
      }
      case "cancel": {
        if (!admin) throw new StockError("เฉพาะแอดมินเท่านั้น");
        await cancelTransfer(String(b.transferId), actor);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof StockError) return NextResponse.json({ error: e.message }, { status: 400 });
    if ((e as { code?: string }).code === "P2003") return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 400 });
    throw e;
  }
}
