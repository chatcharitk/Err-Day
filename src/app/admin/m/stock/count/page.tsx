import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { HOME, stockLocations, stockRows } from "@/lib/stock";
import MobileTop from "@/components/stock/MobileTop";
import CountForm from "@/components/stock/CountForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "นับสต็อก — err.day" };

export default async function MobileCountPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock/count");
  const { loc } = await searchParams;
  const locations = await stockLocations();
  const here = locations.find(l => l.id === (loc ?? HOME)) ?? locations[0];
  const rows = await stockRows(locations);
  return (
    <div>
      <MobileTop title={`นับสต็อก · ${here.short}`} back={`/admin/m/stock?loc=${here.id}`} />
      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {locations.map(l => (
          <Link key={l.id} href={`/admin/m/stock/count?loc=${l.id}`} className="shrink-0 text-sm px-3 py-1.5 rounded-full"
            style={l.id === here.id ? { background: "#8B1D24", color: "white" } : { border: "1px solid #E8D8CC", color: "#A08070" }}>{l.short}</Link>
        ))}
      </div>
      <CountForm key={here.id} location={here.id} locationName={here.short} rows={rows}
        doneHref={`/admin/m/stock?loc=${here.id}`} addProductHref={`/admin/m/stock/products/new?back=${encodeURIComponent(`/admin/m/stock/count?loc=${here.id}`)}`} />
    </div>
  );
}
