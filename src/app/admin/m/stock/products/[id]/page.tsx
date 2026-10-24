import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockProductView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สินค้า — err.day" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock");
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  return <StockProductView base="/admin/m/stock" id={id} edit={edit} />;
}
