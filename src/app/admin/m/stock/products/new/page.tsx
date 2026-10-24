import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import MobileTop from "@/components/stock/MobileTop";
import ProductForm from "@/components/stock/ProductForm";
import { retailOptions } from "../../retail";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มสินค้า — err.day" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock/products/new");
  const { back } = await searchParams;
  const safeBack = back?.startsWith("/admin/m/stock") ? back : null;
  return (
    <div>
      <MobileTop title="เพิ่มสินค้า" back={safeBack ?? "/admin/m/stock"} />
      <ProductForm
        initial={{ name: "", brand: "", size: "", unit: "ขวด", packUnit: "", packSize: "", costBaht: "", usage: "USE", serviceId: "", minQty: "", notes: "", isActive: true }}
        retailOptions={await retailOptions()}
        doneHref={safeBack ?? "/admin/m/stock/products/{id}"}
      />
    </div>
  );
}
