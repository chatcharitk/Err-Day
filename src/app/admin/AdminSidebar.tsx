"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  CalendarClock,
  Users,
  History,
  UserCog,
  Scissors,
  CreditCard,
  Settings,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";

const MENU = [
  { href: "/admin",            labelTh: "ภาพรวม",        label: "Dashboard",    icon: LayoutDashboard, exact: true,             ownerOnly: false },
  { href: "/admin/pos",        labelTh: "POS",            label: "POS",          icon: ShoppingCart,                              ownerOnly: false },
  { href: "/admin/calendar",   labelTh: "ปฏิทิน",        label: "Calendar",     icon: Calendar,                                   ownerOnly: false },
  { href: "/admin/customers",  labelTh: "ลูกค้า",         label: "Customers",    icon: Users,                                     ownerOnly: false },
  { href: "/admin/history",    labelTh: "ประวัติการขาย",  label: "Sales History", icon: History,                                  ownerOnly: false },
  { href: "/admin/membership", labelTh: "ระดับสมาชิก",   label: "Membership",   icon: CreditCard,                                 ownerOnly: false },
  { href: "/admin/staff",      labelTh: "พนักงาน",        label: "Staff Mgmt.",  icon: UserCog,                                    ownerOnly: false },
  { href: "/admin/shifts",     labelTh: "ตารางงาน",       label: "Shifts",       icon: CalendarClock,                              ownerOnly: false },
  { href: "/admin/services",   labelTh: "รายการบริการ",   label: "Services",     icon: Scissors,                                   ownerOnly: false },
  { href: "/admin/settings",   labelTh: "ตั้งค่าร้าน",    label: "Shop Settings",icon: Settings,                                   ownerOnly: false },
  { href: "/admin/users",      labelTh: "จัดการผู้ใช้",   label: "Users",        icon: ShieldCheck,                                ownerOnly: true  },
];

interface AdminSidebarProps {
  role?: "OWNER" | "ADMIN";
  name?: string;
}

export default function AdminSidebar({ role = "ADMIN", name }: AdminSidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const visibleMenu = MENU.filter((m) => !m.ownerOnly || role === "OWNER");

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <aside
      className="w-56 min-h-screen flex-shrink-0 flex flex-col"
      style={{ backgroundColor: "#3B2A24" }}
    >
      {/* Branding */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <BrandLogo light size="lg" />
        <p className="text-white/40 font-medium mt-1 text-xs tracking-widest uppercase">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {visibleMenu.map(({ href, label, labelTh, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
              style={
                isActive
                  ? { backgroundColor: "#8B1D24", color: "white" }
                  : { color: "rgba(255,255,255,0.55)" }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="leading-tight">{labelTh}</p>
                <p className="text-xs opacity-50 leading-tight">{label}</p>
              </div>
              {isActive && (
                <div
                  className="w-1 h-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#D6BCAE" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {name && (
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            <span className="opacity-50">เข้าสู่ระบบในชื่อ </span>
            <span className="font-medium">{name}</span>
            <span className="opacity-40 ml-1">({role})</span>
          </p>
        )}
        <Link
          href="/admin/m"
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          <Smartphone className="w-3 h-3" />
          มุมมองมือถือ
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80 w-full"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          <LogOut className="w-3 h-3" />
          ออกจากระบบ
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          <ArrowLeft className="w-3 h-3" />
          กลับหน้าหลัก
        </Link>
      </div>
    </aside>
  );
}
