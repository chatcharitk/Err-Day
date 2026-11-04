import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import { shortBranchName } from "@/lib/stock";
import { loadRestockRows } from "@/lib/restock-rows";
import RestockForm from "@/components/restock/RestockForm";
import RestockList from "@/components/restock/RestockList";

export const dynamic  = "force-dynamic";
export const metadata = { title: "แจ้งของที่ต้องเติม — err.day" };

export default async function StaffRestockPage() {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");
  const branches = (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }))
    .map(b => ({ id: b.id, name: shortBranchName(b.name) }));
  const mine = branches.some(b => b.id === me.branchId) ? me.branchId : null;
  const rows = await loadRestockRows({ branchId: mine ?? undefined, doneLimit: 5 });
  return (
    <div className="min-h-screen max-w-md mx-auto" style={{ background: "#FDF8F3" }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/staff/stock" className="p-1" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>แจ้งของที่ต้องเติม</p>
      </div>
      <div className="px-4 py-4 space-y-6">
        <p className="text-sm" style={{ color: "#A08070" }}>ติ๊กของที่ร้านหมดหรือใกล้หมด แล้วกดส่ง เจ้าของร้านจะได้รับแจ้งเตือนทันที</p>
        <RestockForm branches={branches} defaultBranchId={mine} />
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: "#3B2A24" }}>ที่แจ้งไว้ล่าสุด</p>
          <RestockList rows={rows} canClose={false} />
        </div>
      </div>
    </div>
  );
}
