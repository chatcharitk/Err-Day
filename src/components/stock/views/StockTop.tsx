import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MobileTop from "../MobileTop";

/** Page header: the phone's sticky bar, or a desktop title row. */
export default function StockTop({ title, back, right, desktop }: { title: string; back: string; right?: React.ReactNode; desktop?: boolean }) {
  if (!desktop) return <MobileTop title={title} back={back} right={right} />;
  return (
    <div className="flex items-center gap-3 px-8 pt-8 pb-4">
      <Link href={back} className="p-1.5 rounded-lg hover:bg-white" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={20} /></Link>
      <h1 className="text-2xl font-semibold flex-1" style={{ color: "#3B2A24" }}>{title}</h1>
      {right}
    </div>
  );
}

/** Desktop pages keep forms at a readable width. */
export function StockBody({ desktop, wide, children }: { desktop?: boolean; wide?: boolean; children: React.ReactNode }) {
  if (!desktop) return <>{children}</>;
  return (
    <div className={`px-8 pb-10 ${wide ? "" : "max-w-2xl"}`}>
      <div className="bg-white rounded-2xl overflow-y-auto max-h-[calc(100vh-7.5rem)]" style={{ border: "1px solid #E8D8CC" }}>{children}</div>
    </div>
  );
}
