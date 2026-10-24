import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, Truck } from "lucide-react";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { pendingTransfers, stockLocations, stockRows } from "@/lib/stock";
import MobileTop from "@/components/stock/MobileTop";
import AllStock from "@/components/stock/AllStock";
import LocationStock from "@/components/stock/LocationStock";
import DeliveryCard from "@/components/stock/DeliveryCard";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สต็อก — err.day" };

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

/** Owner stock home: all places at a glance, or one place (to เบิก / count). */
export default async function MobileStockPage({ searchParams }: { searchParams: Promise<{ loc?: string; inactive?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock");
  const { loc, inactive } = await searchParams;
  const locations = await stockLocations();
  const here = locations.find(l => l.id === loc) ?? null;
  const [rows, deliveries] = await Promise.all([
    stockRows(locations, { includeInactive: !!inactive && !here }),
    pendingTransfers(locations),
  ]);

  const chip = (on: boolean) => on ? { background: PRIMARY, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED };
  const action = "flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium";

  return (
    <div className="pb-10">
      <MobileTop title="สต็อก" back="/admin/m" />
      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        <Link href="/admin/m/stock/products/new" className={action} style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}><Plus size={18} />เพิ่มสินค้า</Link>
        <Link href={`/admin/m/stock/count${here ? `?loc=${here.id}` : ""}`} className={action} style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}><ClipboardList size={18} />นับสต็อก</Link>
        <Link href="/admin/m/stock/send" className={action} style={{ border: `1px solid ${BORDER}`, color: PRIMARY }}><Truck size={18} />ส่งของไปสาขา</Link>
      </div>

      <p className="px-4 pt-2 text-xs text-right">
        <Link href="/admin/m/stock/products/bulk" style={{ color: PRIMARY }}>+ เพิ่มหลายรายการพร้อมกัน (เช่น สีแต่ละเบอร์)</Link>
      </p>

      {deliveries.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {deliveries.map(t => <DeliveryCard key={t.id} t={t} canCancel />)}
        </div>
      )}

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        <Link href="/admin/m/stock" className="shrink-0 text-sm px-3 py-1.5 rounded-full" style={chip(!here)}>ทุกที่</Link>
        {locations.map(l => (
          <Link key={l.id} href={`/admin/m/stock?loc=${l.id}`} className="shrink-0 text-sm px-3 py-1.5 rounded-full" style={chip(here?.id === l.id)}>{l.short}</Link>
        ))}
      </div>

      {here ? <LocationStock location={here.id} rows={rows} /> : <AllStock locations={locations} rows={rows} />}

      {!here && (
        <p className="px-4 pt-4 text-xs text-center">
          <Link href={inactive ? "/admin/m/stock" : "/admin/m/stock?inactive=1"} style={{ color: MUTED }}>
            {inactive ? "ซ่อนสินค้าที่เลิกใช้" : "แสดงสินค้าที่เลิกใช้"}
          </Link>
        </p>
      )}
    </div>
  );
}
