import Link from "next/link";
import { MapPin, Phone, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LangSwitcher } from "@/components/LangSwitcher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FDF8F3" }}>
      {/* Nav */}
      <nav className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: "#8B1D24" }}>
        <span className="font-medium tracking-tight text-white text-lg">err.day</span>
        <div className="flex items-center gap-5">
          <Link href="/membership" className="text-white/80 hover:text-white text-sm transition-colors">
            สมาชิก
          </Link>
          <Link href="/admin" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Admin
          </Link>
          <LangSwitcher />
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center" style={{ backgroundColor: "#8B1D24" }}>
        <p className="text-sm tracking-widest uppercase mb-3" style={{ color: "#D6BCAE" }}>ยินดีต้อนรับสู่</p>
        <h1 className="text-5xl font-light tracking-tight mb-4 text-white">err.day</h1>
        <p className="text-lg max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.8)" }}>
          ประสบการณ์ความงามระดับพรีเมียม<br />
          <span className="text-base" style={{ color: "#D6BCAE" }}>เลือกสาขาใกล้คุณและจองคิวได้เลย</span>
        </p>
      </section>

      {/* Wave divider */}
      <div style={{ backgroundColor: "#8B1D24", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 40 }}>
          <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill="#FDF8F3" />
        </svg>
      </div>

      {/* Branch list */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-medium mb-1" style={{ color: "#3B2A24" }}>สาขาของเรา</h2>
        <p className="text-sm mb-8" style={{ color: "#A08070" }}>Our Locations — เลือกสาขาเพื่อดูบริการและจองคิว</p>

        <div className="grid gap-4">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-2xl bg-white overflow-hidden transition-shadow hover:shadow-md"
              style={{ border: "1.5px solid #E8D8CC" }}
            >
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-medium" style={{ color: "#3B2A24" }}>{branch.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFF0E8", color: "#8B1D24" }}>เปิดให้บริการ</span>
                </div>
                <p className="flex items-start gap-1.5 text-sm mb-1" style={{ color: "#6B5245" }}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {branch.address}
                </p>
                <p className="flex items-center gap-1.5 text-sm" style={{ color: "#6B5245" }}>
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {branch.phone}
                </p>
              </div>
              <div className="px-6 pb-6">
                <Link
                  href={`/book/${branch.id}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#8B1D24" }}
                >
                  จองคิวที่สาขานี้ <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
