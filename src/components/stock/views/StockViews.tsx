import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Plus, Truck, ListPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  HOME, MOVE_LABEL, USAGE_LABEL, minFor, pendingTransfers, productLabel, stockLocations, stockRows,
} from "@/lib/stock";
import { retailOptions, usedCategories } from "@/lib/stock-options";
import AllStock from "../AllStock";
import DesktopStockTable from "../DesktopStockTable";
import LocationStock from "../LocationStock";
import DeliveryCard from "../DeliveryCard";
import CountForm from "../CountForm";
import SendForm from "../SendForm";
import ProductForm from "../ProductForm";
import BulkAddForm from "../BulkAddForm";
import MinEditor from "../MinEditor";
import StockTop, { StockBody } from "./StockTop";

/**
 * Admin stock pages, shared by the phone app (/admin/m/stock) and the desktop
 * panel (/admin/stock). `base` is the route prefix; `desktop` switches layout.
 */
type Common = { base: string; desktop?: boolean };

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const LOW     = "#B91C1C";

const chip = (on: boolean) => on ? { background: PRIMARY, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED, background: "white" };

export async function StockHomeView({ base, desktop, loc, inactive }: Common & { loc?: string; inactive?: string }) {
  const locations = await stockLocations();
  const here = locations.find(l => l.id === loc) ?? null;
  const [rows, deliveries] = await Promise.all([
    stockRows(locations, { includeInactive: !!inactive && !here }),
    pendingTransfers(locations),
  ]);
  const back = desktop ? "/admin" : "/admin/m";

  const actions = [
    { href: `${base}/products/new`, icon: Plus, text: "เพิ่มสินค้า" },
    { href: `${base}/products/bulk`, icon: ListPlus, text: "เพิ่มหลายรายการ" },
    { href: `${base}/count${here ? `?loc=${here.id}` : ""}`, icon: ClipboardList, text: "นับสต็อก" },
    { href: `${base}/send`, icon: Truck, text: "ส่งของไปสาขา" },
  ];

  const tabs = (
    <div className={`flex gap-2 overflow-x-auto ${desktop ? "" : "px-4 pt-3"}`}>
      <Link href={base} className="shrink-0 text-sm px-3 py-1.5 rounded-full" style={chip(!here)}>ทุกที่</Link>
      {locations.map(l => (
        <Link key={l.id} href={`${base}?loc=${l.id}`} className="shrink-0 text-sm px-3 py-1.5 rounded-full" style={chip(here?.id === l.id)}>{l.short}</Link>
      ))}
    </div>
  );
  const inactiveLink = !here && (
    <p className="px-4 py-4 text-xs text-center">
      <Link href={inactive ? base : `${base}?inactive=1`} style={{ color: MUTED }}>{inactive ? "ซ่อนสินค้าที่เลิกใช้" : "แสดงสินค้าที่เลิกใช้"}</Link>
    </p>
  );

  if (desktop) {
    return (
      <div>
        <StockTop desktop title="สต็อก" back={back} right={
          <div className="flex gap-2">
            {actions.map(a => (
              <Link key={a.href} href={a.href} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white" style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}>
                <a.icon size={16} />{a.text}
              </Link>
            ))}
          </div>
        } />
        <div className="px-8 pb-10 space-y-4">
          {deliveries.length > 0 && (
            <div className="grid grid-cols-2 gap-3">{deliveries.map(t => <DeliveryCard key={t.id} t={t} canCancel />)}</div>
          )}
          {tabs}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            {here
              ? <div className="max-w-3xl"><LocationStock location={here.id} rows={rows} /></div>
              : <DesktopStockTable locations={locations} rows={rows} base={base} />}
            {inactiveLink}
          </div>
        </div>
      </div>
    );
  }

  const action = "flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium";
  return (
    <div className="pb-10">
      <StockTop title="สต็อก" back={back} />
      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        {actions.filter(a => !a.href.includes("/bulk")).map(a => (
          <Link key={a.href} href={a.href} className={action} style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}><a.icon size={18} />{a.text}</Link>
        ))}
      </div>
      <p className="px-4 pt-2 text-xs text-right">
        <Link href={`${base}/products/bulk`} style={{ color: PRIMARY }}>+ เพิ่มหลายรายการพร้อมกัน (เช่น สีแต่ละเบอร์)</Link>
      </p>
      {deliveries.length > 0 && (
        <div className="px-4 pt-3 space-y-2">{deliveries.map(t => <DeliveryCard key={t.id} t={t} canCancel />)}</div>
      )}
      {tabs}
      {here ? <LocationStock location={here.id} rows={rows} /> : <AllStock locations={locations} rows={rows} base={base} />}
      {inactiveLink}
    </div>
  );
}

export async function StockCountView({ base, desktop, loc }: Common & { loc?: string }) {
  const locations = await stockLocations();
  const here = locations.find(l => l.id === (loc ?? HOME)) ?? locations[0];
  const rows = await stockRows(locations);
  return (
    <div>
      <StockTop desktop={desktop} title={`นับสต็อก · ${here.short}`} back={`${base}?loc=${here.id}`} />
      <StockBody desktop={desktop}>
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {locations.map(l => (
            <Link key={l.id} href={`${base}/count?loc=${l.id}`} className="shrink-0 text-sm px-3 py-1.5 rounded-full" style={chip(l.id === here.id)}>{l.short}</Link>
          ))}
        </div>
        <CountForm key={here.id} location={here.id} locationName={here.short} rows={rows}
          doneHref={`${base}?loc=${here.id}`} addProductHref={`${base}/products/new?back=${encodeURIComponent(`${base}/count?loc=${here.id}`)}`} />
      </StockBody>
    </div>
  );
}

export async function StockSendView({ base, desktop }: Common) {
  const locations = await stockLocations();
  const rows = await stockRows(locations);
  const firstBranch = locations.find(l => l.id !== HOME && !/เซ็นทรัล|central/i.test(l.name)) ?? locations[1];
  return (
    <div>
      <StockTop desktop={desktop} title="ส่งของไปสาขา" back={base} />
      <StockBody desktop={desktop}>
        <SendForm locations={locations} rows={rows} defaultFrom={HOME} defaultTo={firstBranch?.id ?? HOME} base={base} />
      </StockBody>
    </div>
  );
}

export async function StockNewProductView({ base, desktop, back, cat }: Common & { back?: string; cat?: string }) {
  const safeBack = back?.startsWith(base) ? back : null;
  const [opts, cats] = await Promise.all([retailOptions(), usedCategories()]);
  return (
    <div>
      <StockTop desktop={desktop} title="เพิ่มสินค้า" back={safeBack ?? base} />
      <StockBody desktop={desktop}>
        <ProductForm
          initial={{ name: "", brand: "", size: "", unit: "ขวด", packUnit: "", packSize: "", category: cat ?? "", costBaht: "", usage: "USE", serviceId: "", minQty: "", notes: "", isActive: true }}
          retailOptions={opts} categories={cats}
          doneHref={safeBack ?? `${base}/products/{id}`}
        />
      </StockBody>
    </div>
  );
}

export async function StockBulkView({ base, desktop }: Common) {
  const [locations, categories] = await Promise.all([stockLocations(), usedCategories()]);
  return (
    <div>
      <StockTop desktop={desktop} title="เพิ่มหลายรายการ" back={base} />
      <StockBody desktop={desktop}>
        <BulkAddForm locations={locations} categories={categories} defaultCategory="สีย้อมผม" base={base} />
      </StockBody>
    </div>
  );
}

function when(d: Date) {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function StockProductView({ base, desktop, id, edit }: Common & { id: string; edit?: string }) {
  const p = await prisma.product.findUnique({ where: { id }, include: { levels: true } });
  if (!p) notFound();
  const self = `${base}/products/${id}`;

  if (edit) {
    const [opts, cats] = await Promise.all([retailOptions(id), usedCategories()]);
    return (
      <div>
        <StockTop desktop={desktop} title="แก้ไขสินค้า" back={self} />
        <StockBody desktop={desktop}>
          <ProductForm
            initial={{
              id, name: p.name, brand: p.brand ?? "", size: p.size ?? "", unit: p.unit, packUnit: p.packUnit ?? "",
              packSize: p.packUnit ? String(p.packSize) : "", category: p.category ?? "", costBaht: p.costSatang != null ? String(p.costSatang / 100) : "",
              usage: p.usage, serviceId: p.serviceId ?? "", minQty: p.minQty ? String(p.minQty) : "", notes: p.notes ?? "", isActive: p.isActive,
            }}
            retailOptions={opts} categories={cats} doneHref={self}
          />
        </StockBody>
      </div>
    );
  }

  const [locations, moves, svc] = await Promise.all([
    stockLocations(),
    prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: desktop ? 200 : 80 }),
    p.serviceId ? prisma.service.findUnique({ where: { id: p.serviceId }, select: { name: true, nameTh: true } }) : null,
  ]);
  const locName = (l: string) => locations.find(x => x.id === l)?.short ?? l;
  const total = p.levels.reduce((s, l) => s + l.qty, 0);
  const editLink = <Link href={`${self}?edit=1`} className="text-sm font-medium" style={{ color: PRIMARY }}>แก้ไข</Link>;

  const info = (
    <div className="px-4 pt-4">
      <p className="text-lg font-semibold leading-snug" style={{ color: TEXT }}>{productLabel(p)}</p>
      <p className="text-xs mt-1" style={{ color: MUTED }}>
        {p.category ? `${p.category} · ` : ""}{USAGE_LABEL[p.usage] ?? p.usage} · นับเป็น{p.unit}
        {p.packUnit ? ` · 1 ${p.packUnit} = ${p.packSize} ${p.unit}` : ""}
        {p.costSatang != null ? ` · ทุน ฿${(p.costSatang / 100).toLocaleString()}/${p.unit}` : ""}
        {!p.isActive ? " · เลิกใช้แล้ว" : ""}
      </p>
      {svc && <p className="text-xs mt-1" style={{ color: MUTED }}>ขายที่ POS เป็น “{svc.nameTh || svc.name}” — ขายแล้วตัดสต็อก</p>}
      {p.notes && <p className="text-xs mt-1" style={{ color: MUTED }}>{p.notes}</p>}
    </div>
  );
  const levels = (
    <div className={`${desktop ? "" : "mx-4 mt-4"} rounded-xl bg-white`} style={{ border: `1px solid ${BORDER}` }}>
      {locations.map((l, i) => {
        const lv = p.levels.find(x => x.location === l.id);
        const qty = lv?.qty ?? 0;
        const min = minFor(lv, p, l.id);
        const low = (min > 0 && qty <= min) || qty < 0;
        return (
          <div key={l.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i ? `1px solid ${BORDER}` : undefined }}>
            <Link href={`${base}?loc=${l.id}`} className="flex-1 text-sm" style={{ color: TEXT }}>{l.id === HOME ? l.name : l.short}</Link>
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
  );
  const history = (
    <div className={desktop ? "bg-white rounded-xl" : ""} style={desktop ? { border: `1px solid ${BORDER}` } : undefined}>
      <p className="px-4 pt-4 pb-1 text-xs font-medium" style={{ color: MUTED }}>ประวัติ</p>
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

  if (desktop) {
    return (
      <div>
        <StockTop desktop title="สินค้า" back={base} right={editLink} />
        <div className="px-8 pb-10 grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-4">
            <div className="bg-white rounded-xl pb-4" style={{ border: `1px solid ${BORDER}` }}>{info}</div>
            {levels}
          </div>
          {history}
        </div>
      </div>
    );
  }
  return (
    <div className="pb-10">
      <StockTop title="สินค้า" back={base} right={editLink} />
      {info}
      {levels}
      <div className="pt-1">{history}</div>
    </div>
  );
}
