import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import MobileTop from "@/components/stock/MobileTop";
import ProductForm from "@/components/stock/ProductForm";
import { retailOptions, usedCategories } from "../../retail";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มสินค้า — err.day" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ back?: string; cat?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock/products/new");
  const { back, cat } = await searchParams;
  const safeBack = back?.startsWith("/admin/m/stock") ? back : null;
  return (
    <div>
      <MobileTop title="เพิ่มสินค้า" back={safeBack ?? "/admin/m/stock"} />
      <ProductForm
        initial={{ name: "", brand: "", size: "", unit: "ขวด", packUnit: "", packSize: "", category: cat ?? "", costBaht: "", usage: "USE", serviceId: "", minQty: "", notes: "", isActive: true }}
        retailOptions={await retailOptions()}
        categories={await usedCategories()}
        doneHref={safeBack ?? "/admin/m/stock/products/{id}"}
      />
    </div>
  );
}
