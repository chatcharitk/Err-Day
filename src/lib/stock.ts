import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Inventory core. Every stock change goes through `applyMoves`, which writes
 * the ledger row (StockMovement) and updates the running total (StockLevel)
 * in the same transaction. Locations: "HOME" (owner's home = central
 * warehouse) or a Branch id.
 */

export const HOME = "HOME";

export type Location = { id: string; name: string; short: string };

export const MOVE_LABEL: Record<string, string> = {
  OPENING: "ยอดตั้งต้น",
  COUNT: "นับสต็อก",
  RECEIVE: "รับจากซัพพลายเออร์",
  TRANSFER_OUT: "ส่งไปสาขา",
  TRANSFER_IN: "รับจากคลัง",
  USE: "เบิกใช้",
  SALE: "ขาย",
  SALE_VOID: "ยกเลิกการขาย",
  DAMAGE: "เสีย / หมดอายุ",
  ADJUST: "ปรับยอด",
};

export const USAGE_LABEL: Record<string, string> = { USE: "ใช้ในร้าน", SALE: "ขาย", BOTH: "ใช้ + ขาย" };

export function shortBranchName(name: string): string {
  const s = name.replace(/^err\.day\s*/i, "").replace(/^สาขา/, "").replace(/เซ็นทรัลเวิลด์/, "เซ็นทรัล").trim();
  return s || name;
}

/** Home first, then every branch (incl. ones not yet open for booking — they can still hold stock). */
export async function stockLocations(): Promise<Location[]> {
  const branches = await prisma.branch.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  return [
    { id: HOME, name: "บ้าน (คลังกลาง)", short: "บ้าน" },
    ...branches.map(b => ({ id: b.id, name: b.name, short: shortBranchName(b.name) })),
  ];
}

export async function locationName(id: string): Promise<string> {
  if (id === HOME) return "บ้าน (คลังกลาง)";
  const b = await prisma.branch.findUnique({ where: { id }, select: { name: true } });
  return b ? shortBranchName(b.name) : id;
}

export async function isValidLocation(id: string): Promise<boolean> {
  if (id === HOME) return true;
  return !!(await prisma.branch.findUnique({ where: { id }, select: { id: true } }));
}

export type Actor = { name: string; staffId?: string; adminId?: string };

export type Move = {
  productId: string;
  location: string;
  /** Signed change. Ignored when `setTo` is given. */
  qty?: number;
  /** Set the level to this number (counts); the movement records the difference. */
  setTo?: number;
  type: string;
  note?: string | null;
  expenseId?: string;
  receiptId?: string;
  transferId?: string;
  countId?: string;
};

export class StockError extends Error {}

/** Apply moves inside an existing transaction. Returns the new levels. */
export async function applyMovesTx(tx: Prisma.TransactionClient, moves: Move[], actor: Actor) {
  const out: { productId: string; location: string; before: number; after: number }[] = [];
  for (const m of moves) {
    if (!Number.isInteger(m.qty ?? 0) || (m.setTo != null && (!Number.isInteger(m.setTo) || m.setTo < 0))) {
      throw new StockError("จำนวนต้องเป็นจำนวนเต็ม");
    }
    const level = await tx.stockLevel.upsert({
      where: { productId_location: { productId: m.productId, location: m.location } },
      create: { productId: m.productId, location: m.location, qty: 0 },
      update: {},
      select: { qty: true },
    });
    const before = level.qty;
    const delta = m.setTo != null ? m.setTo - before : (m.qty ?? 0);
    const after = before + delta;
    if (delta !== 0 || m.type === "OPENING" || m.type === "COUNT") {
      await tx.stockLevel.update({
        where: { productId_location: { productId: m.productId, location: m.location } },
        data: { qty: after },
      });
      await tx.stockMovement.create({
        data: {
          productId: m.productId, location: m.location, qty: delta, type: m.type, balance: after,
          note: m.note?.trim() || null, actorName: actor.name, staffId: actor.staffId, adminId: actor.adminId,
          expenseId: m.expenseId, receiptId: m.receiptId, transferId: m.transferId, countId: m.countId,
        },
      });
    }
    out.push({ productId: m.productId, location: m.location, before, after });
  }
  return out;
}

export async function applyMoves(moves: Move[], actor: Actor) {
  return prisma.$transaction(tx => applyMovesTx(tx, moves, actor));
}

/**
 * A shelf count at one location. Lines not listed are left alone. The first
 * count of a product at a place is recorded as its opening stock.
 */
export async function submitCount(location: string, lines: { productId: string; counted: number }[], actor: Actor, note?: string) {
  const clean = lines.filter(l => Number.isInteger(l.counted) && l.counted >= 0);
  if (!clean.length) throw new StockError("ยังไม่ได้กรอกจำนวน");
  return prisma.$transaction(async tx => {
    const count = await tx.stockCount.create({ data: { location, countedBy: actor.name, note: note?.trim() || null } });
    const seen = new Set(
      (await tx.stockMovement.findMany({
        where: { location, productId: { in: clean.map(l => l.productId) } },
        select: { productId: true }, distinct: ["productId"],
      })).map(r => r.productId),
    );
    const res = await applyMovesTx(tx, clean.map(l => ({
      productId: l.productId, location, setTo: l.counted, countId: count.id,
      type: seen.has(l.productId) ? "COUNT" : "OPENING",
    })), actor);
    await tx.stockCountLine.createMany({
      data: res.map(r => ({ countId: count.id, productId: r.productId, expected: r.before, counted: r.after })),
    });
    return { countId: count.id, lines: res };
  }, { timeout: 30_000 });
}

/** Send stock from one place to another; it leaves the sender now. */
export async function createTransfer(from: string, to: string, items: { productId: string; qty: number }[], actor: Actor, note?: string) {
  const clean = items.filter(i => Number.isInteger(i.qty) && i.qty > 0);
  if (!clean.length) throw new StockError("ยังไม่ได้เลือกสินค้า");
  if (from === to) throw new StockError("ต้นทางกับปลายทางต้องต่างกัน");
  const toName = await locationName(to);
  return prisma.$transaction(async tx => {
    const t = await tx.stockTransfer.create({
      data: { fromLocation: from, toLocation: to, sentBy: actor.name, note: note?.trim() || null,
        items: { create: clean.map(i => ({ productId: i.productId, qtySent: i.qty })) } },
    });
    await applyMovesTx(tx, clean.map(i => ({
      productId: i.productId, location: from, qty: -i.qty, type: "TRANSFER_OUT", transferId: t.id, note: `ส่งไป ${toName}`,
    })), actor);
    return t;
  }, { timeout: 30_000 });
}

/** Branch confirms a delivery; `received` overrides per item when short. */
export async function receiveTransfer(transferId: string, received: Record<string, number> | null, actor: Actor) {
  return prisma.$transaction(async tx => {
    const t = await tx.stockTransfer.findUnique({ where: { id: transferId }, include: { items: true } });
    if (!t) throw new StockError("ไม่พบรายการส่งของ");
    if (t.status !== "SENT") throw new StockError("รายการนี้รับไปแล้ว");
    const fromName = await locationName(t.fromLocation);
    const moves: Move[] = [];
    for (const it of t.items) {
      const r = received?.[it.id];
      const qty = r != null && Number.isInteger(r) && r >= 0 ? r : it.qtySent;
      await tx.stockTransferItem.update({ where: { id: it.id }, data: { qtyReceived: qty } });
      moves.push({
        productId: it.productId, location: t.toLocation, qty, type: "TRANSFER_IN", transferId: t.id,
        note: qty === it.qtySent ? `จาก ${fromName}` : `จาก ${fromName} (ส่งมา ${it.qtySent} ได้รับ ${qty})`,
      });
    }
    await applyMovesTx(tx, moves, actor);
    return tx.stockTransfer.update({
      where: { id: t.id },
      data: { status: "RECEIVED", receivedBy: actor.name, receivedAt: new Date() },
    });
  }, { timeout: 30_000 });
}

/** Cancel a delivery that hasn't been received: stock goes back to the sender. */
export async function cancelTransfer(transferId: string, actor: Actor) {
  return prisma.$transaction(async tx => {
    const t = await tx.stockTransfer.findUnique({ where: { id: transferId }, include: { items: true } });
    if (!t) throw new StockError("ไม่พบรายการส่งของ");
    if (t.status !== "SENT") throw new StockError("ยกเลิกได้เฉพาะรายการที่ยังไม่ได้รับ");
    await applyMovesTx(tx, t.items.map(it => ({
      productId: it.productId, location: t.fromLocation, qty: it.qtySent, type: "ADJUST", transferId: t.id, note: "ยกเลิกการส่ง",
    })), actor);
    return tx.stockTransfer.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
  }, { timeout: 30_000 });
}

/** Effective low-stock minimum at a location. */
export function minFor(level: { minQty: number | null } | undefined, product: { minQty: number }, location: string): number {
  if (level?.minQty != null) return level.minQty;
  return location === HOME ? 0 : product.minQty;
}

export function productLabel(p: { name: string; brand?: string | null; size?: string | null }): string {
  return [p.brand, p.name, p.size].filter(Boolean).join(" · ");
}

/** Products with their level at every location (for overview and pickers). */
export async function stockTable(opts: { includeInactive?: boolean } = {}) {
  const products = await prisma.product.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    include: { levels: true },
  });
  return products;
}

export type StockRow = {
  id: string; name: string; brand: string | null; size: string | null; unit: string;
  packUnit: string | null; packSize: number; usage: string; isActive: boolean;
  /** location id → qty / effective minimum */
  levels: Record<string, { qty: number; min: number }>;
};

/** Plain rows for client components. */
export async function stockRows(locations: Location[], opts: { includeInactive?: boolean } = {}): Promise<StockRow[]> {
  const products = await stockTable(opts);
  return products.map(p => ({
    id: p.id, name: p.name, brand: p.brand, size: p.size, unit: p.unit, packUnit: p.packUnit, packSize: p.packSize,
    usage: p.usage, isActive: p.isActive,
    levels: Object.fromEntries(locations.map(l => {
      const lv = p.levels.find(x => x.location === l.id);
      return [l.id, { qty: lv?.qty ?? 0, min: minFor(lv, p, l.id) }];
    })),
  }));
}

export type PendingTransfer = {
  id: string; from: string; to: string; fromName: string; toName: string; sentBy: string; sentAt: string; note: string | null;
  items: { id: string; productId: string; label: string; unit: string; qtySent: number }[];
};

export async function pendingTransfers(locations: Location[], toLocations?: string[]): Promise<PendingTransfer[]> {
  const ts = await prisma.stockTransfer.findMany({
    where: { status: "SENT", ...(toLocations ? { toLocation: { in: toLocations } } : {}) },
    orderBy: { sentAt: "asc" },
    include: { items: true },
  });
  if (!ts.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ts.flatMap(t => t.items.map(i => i.productId)) } },
    select: { id: true, name: true, brand: true, size: true, unit: true },
  });
  const pm = new Map(products.map(p => [p.id, p]));
  const name = (id: string) => locations.find(l => l.id === id)?.short ?? id;
  return ts.map(t => ({
    id: t.id, from: t.fromLocation, to: t.toLocation, fromName: name(t.fromLocation), toName: name(t.toLocation),
    sentBy: t.sentBy, sentAt: t.sentAt.toISOString(), note: t.note,
    items: t.items.map(i => {
      const p = pm.get(i.productId);
      return { id: i.id, productId: i.productId, label: p ? productLabel(p) : "สินค้าที่ลบแล้ว", unit: p?.unit ?? "", qtySent: i.qtySent };
    }),
  }));
}
