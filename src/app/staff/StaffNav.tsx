import Link from "next/link";
import { CalendarDays, FileText, Users, Wallet } from "lucide-react";

const PRIMARY = "#8B1D24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

const ITEMS = [
  { key: "schedule", href: "/staff",          label: "ของฉัน",            icon: CalendarDays },
  { key: "team",     href: "/staff/team",     label: "ตารางทีม",          icon: Users },
  { key: "pay",      href: "/staff/pay",      label: "ค่าตอบแทน",        icon: Wallet },
  { key: "payslips", href: "/staff/payslips", label: "สลิปเงินเดือน",      icon: FileText },
] as const;

/** Section switcher for the staff portal — sits under each page's header. */
export default function StaffNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {ITEMS.map(({ key, href, label, icon: Icon }) => {
          const on = key === active;
          return (
            <Link key={key} href={href} aria-current={on ? "page" : undefined}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              style={{ color: on ? PRIMARY : MUTED, borderBottom: `2px solid ${on ? PRIMARY : "transparent"}` }}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
