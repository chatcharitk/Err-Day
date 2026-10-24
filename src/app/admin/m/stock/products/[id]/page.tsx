import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { HOME, MOVE_LABEL, USAGE_LABEL, minFor, productLabel, stockLocations } from "@/lib/stock";
import MobileTop from "@/components/stock/MobileTop";
import ProductForm from "@/components/stock/ProductForm";
import MinEditor from "@/components/stock/MinEditor";
import { retailOptions } from "../../retail";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สินค้า — err.day" };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const LOW     = "#B91C1C";

function when(d: Date) {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One product: stock at every place, history (who did what), and edit. */
export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) redirect(`/admin/login?next=/admin/m/stock/products/${id}`);
  const { edit } = await searchParams;
  const p = await prisma.product.findUnique({ where: { id }, include: { levels: true } });
  if (!p) notFound();

  if (edit) {
    return (
      <div>
        <MobileTop title="แก้ไขสินค้า" back={`/admin/m/stock/products/${id}`} />
        <ProductForm
          initial={{
            id, name: p.name, brand: p.brand ?? "", size: p.size ?? "", unit: p.unit, packUnit: p.packUnit ?? "",
            packSize: p.packUnit ? String(p.packSize) : "", costBaht: p.costSatang != null ? String(p.costSatang / 100) : "",
            usage: p.usage, serviceId: p.serviceId ?? "", minQty: p.minQty ? String(p.minQty) : "", notes: p.notes ?? "", isActive: p.isActive,
          }}
          retailOptions={await retailOptions(id)}
          doneHref={`/admin/m/stock/products/${id}`}
        />
      </div>
    );
  }

  const [locations, moves, svc] = await Promise.all([
    stockLocations(),
    prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 80 }),
    p.serviceId ? prisma.service.findUnique({ where: { id: p.serviceId }, select: { name: true, nameTh: true } }) : null,
  ]);
  const locName = (l: string) => locations.find(x => x.id === l)?.short ?? l;
  const total = p.levels.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="pb-10">
      <MobileTop title="สินค้า" back="/admin/m/stock"
        right={<Link href={`/admin/m/stock/products/${id}?edit=1`} className="text-sm font-medium" style={{ color: PRIMARY }}>แก้ไข</Link>} />
      <div className="px-4 pt-4">
        <p className="text-lg font-semibold leading-snug" style={{ color: TEXT }}>{productLabel(p)}</p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          {USAGE_LABEL[p.usage] ?? p.usage} · นับเป็น{p.unit}
          {p.packUnit ? ` · 1 ${p.packUnit} = ${p.packSize} ${p.unit}` : ""}
          {p.costSatang != null ? ` · ทุน ฿${(p.costSatang / 100).toLocaleString()}/${p.unit}` : ""}
          {!p.isActive ? " · เลิกใช้แล้ว" : ""}
        </p>
        {svc && <p className="text-xs mt-1" style={{ color: MUTED }}>ขายที่ POS เป็น “{svc.nameTh || svc.name}” — ขายแล้วตัดสต็อก</p>}
        {p.notes && <p className="text-xs mt-1" style={{ color: MUTED }}>{p.notes}</p>}
      </div>

      <div className="mx-4 mt-4 rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
        {locations.map((l, i) => {
          const lv = p.levels.find(x => x.location === l.id);
          const qty = lv?.qty ?? 0;
          const min = minFor(lv, p, l.id);
          const low = (min > 0 && qty <= min) || qty < 0;
          return (
            <div key={l.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i ? `1px solid ${BORDER}` : undefined }}>
              <Link href={`/admin/m/stock?loc=${l.id}`} className="flex-1 text-sm" style={{ color: TEXT }}>{l.id === HOME ? l.name : l.short}</Link>
              <MinEditor productId={id} location={l.id} min={min} custom={lv?.minQty != null} />
              <span className="w-12 text-right font-semibold" style={{ color: low ? LOW : TEXT }}>{qty}</span>
            </div>
          );
        })}
        <div className="flex px-3 py-2 text-sm" style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}>
          <span className="flex-1">รวมทุกที่</span>
          <span className="font-semibold" style={{ color: TEXT }}>{total} {p.unit}</span>
        </div>
      </div>

      <p className="px-4 pt-5 pb-1 text-xs font-medium" style={{ color: MUTED }}>ประวัติ</p>
      {moves.length === 0 && <p className="px-4 py-4 text-sm" style={{ color: MUTED }}>ยังไม่มีการเคลื่อนไหว — เริ่มด้วย “นับสต็อก”</p>}
      <ul>
        {moves.map(m => (
          <li key={m.id} className="px-4 py-2.5 flex items-start gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: TEXT }}>{MOVE_LABEL[m.type] ?? m.type} · {locName(m.location)}</p>
              <p className="text-[11px]" style={{ color: MUTED }}>{when(m.createdAt)} · {m.actorName}{m.note ? ` · ${m.note}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: m.qty < 0 ? LOW : m.qty > 0 ? "#166534" : MUTED }}>{m.qty > 0 ? `+${m.qty}` : m.qty}</p>
              <p className="text-[11px]" style={{ color: MUTED }}>เหลือ {m.balance}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
