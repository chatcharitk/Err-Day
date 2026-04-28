"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ArrowLeft,
} from "lucide-react";

const MENU = [
  { href: "/admin",            labelTh: "ภาพรวม",        label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { href: "/admin/pos",        labelTh: "POS",            label: "POS",          icon: ShoppingCart },
  { href: "/admin/calendar",   labelTh: "ปฏิทิน",        label: "Calendar",     icon: Calendar },
  { href: "/admin/customers",  labelTh: "ลูกค้า",         label: "Customers",    icon: Users },
  { href: "/admin/history",    labelTh: "ประวัติการขาย",  label: "Sales History", icon: History },
  { href: "/admin/membership", labelTh: "ระดับสมาชิก",   label: "Membership",   icon: CreditCard },
  { href: "/admin/staff",      labelTh: "พนักงาน",        label: "Staff Mgmt.",  icon: UserCog },
  { href: "/admin/shifts",     labelTh: "ตารางงาน",       label: "Shifts",       icon: CalendarClock },
  { href: "/admin/services",   labelTh: "รายการบริการ",   label: "Services",     icon: Scissors },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 min-h-screen flex-shrink-0 flex flex-col"
      style={{ backgroundColor: "#3B2A24" }}
    >
      {/* Branding */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>err.day</p>
        <p className="text-white font-medium mt-0.5 text-sm">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {MENU.map(({ href, label, labelTh, icon: Icon, exact }) => {
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
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
