"use client";

import { PartyPopper } from "lucide-react";

export interface CheerLine {
  /** Cart row id — the key in `value`. */
  key: string;
  branchServiceId: string;
  name: string;
  qty: number;
  /** ค่าเชียร์ per unit, satang. */
  cheerSatang: number;
}

/**
 * "ใครเชียร์?" at checkout — for each cart line whose service pays ค่าเชียร์,
 * pick the staff member who talked the customer into it. Renders nothing when
 * the cart has no cheer-eligible service.
 */
export default function CheerPicker({ lines, staff, value, onChange }: {
  lines: CheerLine[];
  staff: { id: string; name: string }[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl px-3 py-2.5" style={{ border: "1px solid #FDE68A", background: "#FFFBEB" }}>
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: "#92400E" }}>
        <PartyPopper size={14} /> เชียร์ — ใครชวนลูกค้าซื้อ? (ได้ค่าเชียร์)
      </p>
      {lines.map(l => (
        <div key={l.key} className="mb-1.5 last:mb-0">
          <p className="text-[11px] mb-1" style={{ color: "#3B2A24" }}>
            {l.name}{l.qty > 1 ? ` ×${l.qty}` : ""} · ฿{((l.cheerSatang * l.qty) / 100).toLocaleString("th-TH")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "", name: "ไม่มี" }, ...staff].map(s => {
              const on = (value[l.key] ?? "") === s.id;
              return (
                <button key={s.id || "none"} type="button"
                  onClick={() => onChange({ ...value, [l.key]: s.id })}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={on ? { background: "#92400E", color: "white" } : { background: "white", color: "#92400E", border: "1px solid #FCD34D" }}
                  aria-pressed={on}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cheer picks for the sale API — only lines that still exist and have a staff chosen. */
export function cheersPayload(lines: CheerLine[], value: Record<string, string>) {
  return lines.filter(l => value[l.key]).map(l => ({ branchServiceId: l.branchServiceId, staffId: value[l.key], qty: l.qty }));
}
