import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockSendView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ส่งของไปสาขา — err.day" };

export default async function StockSendPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock");
  return <StockSendView base="/admin/m/stock" />;
}
