import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CouponsView from "@/app/admin/(panel)/coupons/CouponsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "คูปอง — err.day" };

export default async function MobileCouponsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
        <Link href="/admin/m" className="p-1" style={{ color: "#A08070" }}><ArrowLeft size={18} /></Link>
        <p className="font-medium" style={{ color: "#3B2A24" }}>คูปอง</p>
      </div>
      <CouponsView selectedId={c} basePath="/admin/m/coupons" compact />
    </div>
  );
}
