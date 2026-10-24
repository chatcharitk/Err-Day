"use client";

import { groupByCategory } from "@/lib/stock-categories";
import { BORDER, MUTED, PRIMARY, TEXT } from "./theme";

/** Horizontal category filter: ทั้งหมด + one chip per group that has products. */
export default function CategoryChips<T extends { category: string | null }>({ rows, value, onChange }: {
  rows: T[]; value: string | null; onChange: (c: string | null) => void;
}) {
  const groups = groupByCategory(rows);
  if (groups.length < 2) return null;
  const chip = (on: boolean) => on ? { background: TEXT, color: "white" } : { border: `1px solid ${BORDER}`, color: MUTED, background: "white" };
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
      <button type="button" onClick={() => onChange(null)} className="shrink-0 text-xs px-2.5 py-1 rounded-full" style={chip(!value)}>ทั้งหมด</button>
      {groups.map(g => (
        <button key={g.category} type="button" onClick={() => onChange(g.category)} className="shrink-0 text-xs px-2.5 py-1 rounded-full" style={chip(value === g.category)}>
          {g.category} <span style={{ opacity: 0.7 }}>{g.rows.length}</span>
        </button>
      ))}
    </div>
  );
}

export function GroupHeader({ title }: { title: string }) {
  return (
    <li className="px-4 pt-3 pb-1 text-[11px] font-semibold" style={{ color: PRIMARY, background: "#FDF8F3", borderTop: `1px solid ${BORDER}` }}>
      {title}
    </li>
  );
}
