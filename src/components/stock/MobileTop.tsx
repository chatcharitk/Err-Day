import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MobileTop({ title, back, right }: { title: string; back: string; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white" style={{ borderBottom: "1px solid #E8D8CC" }}>
      <Link href={back} className="p-1" style={{ color: "#A08070" }} aria-label="กลับ"><ArrowLeft size={18} /></Link>
      <p className="font-medium flex-1" style={{ color: "#3B2A24" }}>{title}</p>
      {right}
    </div>
  );
}
