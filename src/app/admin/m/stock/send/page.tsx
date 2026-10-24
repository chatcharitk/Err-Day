import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { HOME, stockLocations, stockRows } from "@/lib/stock";
import MobileTop from "@/components/stock/MobileTop";
import SendForm from "@/components/stock/SendForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ส่งของไปสาขา — err.day" };

export default async function MobileSendPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock/send");
  const locations = await stockLocations();
  const rows = await stockRows(locations);
  const firstBranch = locations.find(l => l.id !== HOME && !/เซ็นทรัล|central/i.test(l.name)) ?? locations[1];
  return (
    <div>
      <MobileTop title="ส่งของไปสาขา" back="/admin/m/stock" />
      <SendForm locations={locations} rows={rows} defaultFrom={HOME} defaultTo={firstBranch?.id ?? HOME} />
    </div>
  );
}
