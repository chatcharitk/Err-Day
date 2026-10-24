import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentStaffPerson } from "@/lib/staff-auth";
import { HOME, stockLocations, stockRows } from "@/lib/stock";
import CountForm from "@/components/stock/CountForm";

export const dynamic  = "force-dynamic";
export const metadata = { title: "นับสต็อก — err.day" };

export default async function StaffCountPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const me = await getCurrentStaffPerson();
  if (!me) redirect("/staff/login");
  const { loc } = await searchParams;
  const locations = (await stockLocations()).filter(l => l.id !== HOME);
  const here = locations.find(l => l.id === loc) ?? locations.find(l => l.id === me.branchId) ?? locations[0];
  const rows = await stockRows(locations);
  const back = `/staff/stock?loc=${here.id}`;
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href={back} className="p-1" style={{ color: "#A08070" }}><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>นับสต็อก · {here.short}</p>
      </div>
      <CountForm location={here.id} locationName={here.short} rows={rows} doneHref={back} />
    </div>
  );
}
