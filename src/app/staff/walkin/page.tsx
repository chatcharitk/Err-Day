import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import { shortBranchName } from "@/lib/stock";
import WalkinFinder from "./WalkinFinder";

export const dynamic  = "force-dynamic";
export const metadata = { title: "หาลูกค้า · วอร์คอิน — err.day" };

export default async function StaffWalkinPage() {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");
  const branches = (await prisma.branch.findMany({
    where:   { isActive: true, id: { in: me.person.branchIds } },
    select:  { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })).map(b => ({ id: b.id, name: shortBranchName(b.name) }));
  const defaultBranchId = branches.some(b => b.id === me.branchId) ? me.branchId : branches[0]?.id ?? "";

  return (
    <div className="min-h-screen max-w-md mx-auto" style={{ background: "#FDF8F3" }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/staff" className="p-1" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>หาลูกค้า · รับวอร์คอิน</p>
      </div>
      <WalkinFinder branches={branches} defaultBranchId={defaultBranchId} />
    </div>
  );
}
