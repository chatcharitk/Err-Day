import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { loadRestockRows } from "@/lib/restock-rows";
import RestockList from "@/components/restock/RestockList";

export const dynamic  = "force-dynamic";
export const metadata = { title: "ของที่ต้องเติม — err.day" };

export default async function AdminRestockPage() {
  if (!await getCurrentAdmin()) redirect("/admin/login?next=/admin/m/restock");
  const rows = await loadRestockRows({ doneLimit: 15 });
  const open = rows.filter(r => r.status === "OPEN").length;
  return (
    <div className="min-h-screen max-w-md mx-auto" style={{ background: "#FDF8F3" }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/admin/m" className="p-1" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={18} /></Link>
        <p className="font-medium flex-1" style={{ color: "#3B2A24" }}>ของที่ต้องเติม</p>
        {open > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: "#8B1D24" }}>รอ {open}</span>}
      </div>
      <div className="px-4 py-4"><RestockList rows={rows} canClose /></div>
    </div>
  );
}
