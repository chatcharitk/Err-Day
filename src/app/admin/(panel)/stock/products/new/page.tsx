import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockNewProductView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "เพิ่มสินค้า — err.day" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ back?: string; cat?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/stock");
  const { back, cat } = await searchParams;
  return <StockNewProductView base="/admin/stock" desktop back={back} cat={cat} />;
}
