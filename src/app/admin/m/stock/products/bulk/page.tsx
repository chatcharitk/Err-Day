import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { stockLocations } from "@/lib/stock";
import MobileTop from "@/components/stock/MobileTop";
import BulkAddForm from "@/components/stock/BulkAddForm";
import { usedCategories } from "../../retail";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มหลายรายการ — err.day" };

export default async function BulkAddPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock/products/bulk");
  const [locations, categories] = await Promise.all([stockLocations(), usedCategories()]);
  return (
    <div>
      <MobileTop title="เพิ่มหลายรายการ" back="/admin/m/stock" />
      <BulkAddForm locations={locations} categories={categories} defaultCategory="สีย้อมผม" />
    </div>
  );
}
