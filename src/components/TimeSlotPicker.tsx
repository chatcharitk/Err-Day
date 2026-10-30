"use client";

/**
 * Customer time picker for 15-minute start times. Slots are grouped into
 * เช้า / บ่าย / เย็น and laid out one hour per row with the quarters in fixed
 * columns (:00 :15 :30 :45), so the eye can run down a column or across an
 * hour. Unavailable times stay in place, greyed, with the word "จอง".
 */
const PERIODS = [
  { th: "เช้า",  en: "Morning",   from: 0,  to: 12 },
  { th: "บ่าย",  en: "Afternoon", from: 12, to: 17 },
  { th: "เย็น",  en: "Evening",   from: 17, to: 24 },
];

export default function TimeSlotPicker({
  slots, taken, selected, onSelect, disabled = false, lang = "th", takenLabel,
}: {
  slots:     string[];
  /** Start times that cannot be booked. */
  taken:     Set<string>;
  selected:  string;
  onSelect:  (t: string) => void;
  /** Whole picker inert (e.g. while availability loads). */
  disabled?: boolean;
  lang?:     "th" | "en";
  takenLabel?: string;
}) {
  const label = takenLabel ?? (lang === "th" ? "จอง" : "Booked");
  const hourOf = (t: string) => Number(t.slice(0, 2));

  return (
    <div className="space-y-4">
      {PERIODS.map((p) => {
        const inPeriod = slots.filter((t) => hourOf(t) >= p.from && hourOf(t) < p.to);
        if (inPeriod.length === 0) return null;
        const free  = inPeriod.filter((t) => !taken.has(t)).length;
        const hours = [...new Set(inPeriod.map(hourOf))];
        return (
          <div key={p.th}>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-sm font-semibold" style={{ color: "#45352F" }}>{lang === "th" ? p.th : p.en}</p>
              <p className="text-xs" style={{ color: free > 0 ? "#166534" : "#C4B0A4" }}>
                {free > 0
                  ? (lang === "th" ? `ว่าง ${free} เวลา` : `${free} open`)
                  : (lang === "th" ? "เต็ม" : "Full")}
              </p>
            </div>
            <div className="space-y-1.5">
              {hours.map((h) => (
                <div key={h} className="grid grid-cols-4 gap-1.5">
                  {[0, 15, 30, 45].map((m) => {
                    const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    if (!inPeriod.includes(t)) return <div key={m} />;
                    const isTaken = taken.has(t);
                    const isSel   = selected === t;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => !isTaken && onSelect(t)}
                        disabled={isTaken || disabled}
                        className="h-12 rounded-lg border-2 flex flex-col items-center justify-center leading-tight transition-all"
                        style={
                          isTaken
                            ? { backgroundColor: "#F5F0EC", borderColor: "#F5F0EC", color: "#C4B0A4", cursor: "not-allowed" }
                            : isSel
                            ? { backgroundColor: "#B52F3A", borderColor: "#B52F3A", color: "white" }
                            : { backgroundColor: "white", borderColor: "#EADDD4", color: "#45352F" }
                        }
                      >
                        <span className={isTaken ? "text-[11px]" : "text-[15px] font-semibold"}>{t}</span>
                        {isTaken && <span className="text-xs font-semibold" style={{ color: "#A08F86" }}>{label}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
