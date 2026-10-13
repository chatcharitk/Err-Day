"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const PRIMARY = "#8B1D24";

/** Red top bar shared by the staff-portal pages. */
export default function StaffHeader({ name, subtitle }: { name: string; subtitle: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }
  return (
    <header className="px-4 pt-4 pb-3 print:hidden" style={{ background: PRIMARY }}>
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs">สวัสดี · พนักงาน</p>
          <h1 className="text-white text-lg font-bold leading-tight">{name}</h1>
          <p className="text-white/70 text-[11px] mt-0.5">{subtitle}</p>
        </div>
        <button onClick={logout}
          className="flex items-center gap-1 text-xs text-white/80 hover:text-white px-3 py-1.5 rounded-full"
          style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
          <LogOut size={12} />
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
