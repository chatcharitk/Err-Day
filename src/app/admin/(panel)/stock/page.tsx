import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { StockHomeView } from "@/components/stock/views/StockViews";

export const dynamic  = "force-dynamic";
export const metadata = { title: "สต็อก — err.day" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ loc?: string; inactive?: string }> }) {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/stock");
  const { loc, inactive } = await searchParams;
  return <StockHomeView base="/admin/stock" desktop loc={loc} inactive={inactive} />;
}
