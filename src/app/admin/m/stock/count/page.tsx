import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockCountView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "นับสต็อก — err.day" };

export default async function StockCountPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/stock");
  const { loc } = await searchParams;
  return <StockCountView base="/admin/m/stock" loc={loc} />;
}
