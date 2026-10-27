"use client";

/** Small shared pieces for the colour-record screens (chips, sections). */

export const C = {
  primary: "#8B1D24", text: "#3B2A24", muted: "#A08070", border: "#E8D8CC", bg: "#FDF8F3",
  red: "#B42318", redBg: "#FDE9E7", green: "#166534", greenBg: "#E8F5EC", amber: "#9A3412", amberBg: "#FFF7ED",
};

export function Chips({ options, value, onChange, multi = false, small = false }: {
  options: readonly string[]; value: string | string[] | null; onChange: (v: string | string[] | null) => void; multi?: boolean; small?: boolean;
}) {
  const on = (o: string) => (multi ? (value as string[] | null)?.includes(o) : value === o);
  const toggle = (o: string) => {
    if (multi) { const cur = (value as string[] | null) ?? []; onChange(cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o]); }
    else onChange(value === o ? null : o);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} rounded-full`}
          style={on(o) ? { background: C.primary, color: "white", border: `1px solid ${C.primary}` } : { background: "white", color: C.text, border: `1px solid ${C.border}` }}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold flex-1" style={{ color: C.muted }}>{title}</p>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium" style={{ color: C.text }}>{label}</p>
      {children}
    </div>
  );
}

export function LevelPicker({ value, onChange, max = 10 }: { value: number | null; onChange: (v: number | null) => void; max?: number }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          className="py-1.5 rounded-lg text-sm tabular-nums"
          style={value === n ? { background: C.primary, color: "white" } : { background: "white", color: C.text, border: `1px solid ${C.border}` }}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function fmtThaiDate(d: string | Date) {
  return new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
}
