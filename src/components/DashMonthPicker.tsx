"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dashHref, type MonthOption } from "@/lib/dashboard-month";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const BORDER  = "#E8D8CC";

/** ‹ [month ▾] › — switches the BI dashboard to another month, keeping the branch. */
export default function DashMonthPicker({
  base, branchId, monthKey, options,
}: {
  base: string;
  branchId: string;
  monthKey: string;
  options: MonthOption[];   // newest first
}) {
  const router = useRouter();
  const currentKey = options[0]?.key ?? monthKey;
  const idx = options.findIndex(o => o.key === monthKey);
  const older = idx >= 0 && idx < options.length - 1 ? options[idx + 1].key : null;
  const newer = idx > 0 ? options[idx - 1].key : null;
  const go = (k: string) => router.push(dashHref(base, branchId, k, currentKey));

  const arrow = (k: string | null, label: string, icon: React.ReactNode) => (
    <button type="button" aria-label={label} disabled={!k} onClick={() => k && go(k)}
      className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-30"
      style={{ color: TEXT, border: `1px solid ${BORDER}`, background: "white" }}>
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5">
      {arrow(older, "เดือนก่อน", <ChevronLeft size={16} />)}
      <select value={monthKey} onChange={e => go(e.target.value)}
        className="h-8 rounded-full px-3 text-xs font-semibold bg-white"
        style={{ color: monthKey === currentKey ? TEXT : PRIMARY, border: `1px solid ${monthKey === currentKey ? BORDER : PRIMARY}` }}>
        {options.map((o, i) => (
          <option key={o.key} value={o.key}>{o.label}{i === 0 ? " (เดือนนี้)" : ""}</option>
        ))}
      </select>
      {arrow(newer, "เดือนถัดไป", <ChevronRight size={16} />)}
    </div>
  );
}
