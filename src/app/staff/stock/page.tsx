import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { HOME, pendingTransfers, stockLocations, stockRows } from "@/lib/stock";
import StaffHeader from "../StaffHeader";
import StaffNav from "../StaffNav";
import LocationStock from "@/components/stock/LocationStock";
import DeliveryCard from "@/components/stock/DeliveryCard";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สต็อก — err.day" };

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

/** Staff stock: see what's at a branch, เบิกของ, confirm deliveries, count. */
export default async function StaffStockPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");
  const { loc } = await searchParams;

  // Staff can look at every place incl. the home warehouse (view-only there).
  const locations = await stockLocations();
  const here = locations.find(l => l.id === loc) ?? locations.find(l => l.id === me.branchId) ?? locations.find(l => l.id !== HOME)!;
  const atHome = here.id === HOME;
  const [rows, deliveries] = await Promise.all([
    stockRows(locations),
    pendingTransfers(locations, [here.id]),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "#FDF8F3" }}>
      <StaffHeader name={me.name} subtitle={me.branchName} />
      <StaffNav active="stock" />
      <div className="max-w-2xl mx-auto pb-10">
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {locations.map(l => (
            <Link key={l.id} href={`/staff/stock?loc=${l.id}`} className="shrink-0 text-sm px-3 py-1.5 rounded-full"
              style={l.id === here.id ? { background: PRIMARY, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED, background: "white" }}>
              {l.short}
            </Link>
          ))}
        </div>

        {deliveries.length > 0 && (
          <div className="px-4 pt-3 space-y-2">
            {deliveries.map(t => <DeliveryCard key={t.id} t={t} />)}
          </div>
        )}

        {atHome ? (
          <p className="px-4 pt-3 text-xs" style={{ color: MUTED }}>ของที่บ้าน (คลังกลาง) — ดูได้อย่างเดียว · ถ้าต้องการของ แจ้งแอดมินให้ส่งไปสาขา</p>
        ) : (
        <div className="px-4 pt-3">
          <Link href={`/staff/stock/count?loc=${here.id}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-white"
            style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY }}>
            <ClipboardList size={16} /> นับสต็อก {here.short}
          </Link>
        </div>
        )}

        <LocationStock location={here.id} rows={rows} readOnly={atHome} />
      </div>
    </div>
  );
}
