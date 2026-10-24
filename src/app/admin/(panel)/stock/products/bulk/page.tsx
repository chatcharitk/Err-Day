import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockBulkView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มหลายรายการ — err.day" };

export default async function BulkAddPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/stock");
  return <StockBulkView base="/admin/stock" desktop />;
}
