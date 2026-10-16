"use client";

import { useEffect, useState } from "react";

/**
 * Discount entry with a ฿ / % switch. The parent keeps the discount in BAHT as
 * before; in % mode the typed percentage is converted against `baseSatang`
 * (and re-converted if the base changes, e.g. an item is added to the cart).
 */
export default function DiscountAmountInput({
  baseSatang, valueBaht, onChange, className, style, autoFocus, onKeyDown,
}: {
  baseSatang: number;
  valueBaht: number;
  onChange: (baht: number) => void;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [mode, setMode] = useState<"baht" | "percent">("baht");
  const [pct, setPct] = useState("");
  const toBaht = (p: number) => Math.round((baseSatang * Math.min(100, Math.max(0, p))) / 100) / 100;

  // Keep a percentage discount in step with its base.
  useEffect(() => {
    if (mode !== "percent" || !pct || valueBaht === 0) return;
    const next = toBaht(Number(pct));
    if (next !== valueBaht) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSatang]);

  return (
    <>
      <input
        type="number"
        min={0}
        max={mode === "percent" ? 100 : undefined}
        step="any"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        // Hide a stale % once the parent clears the discount ("ล้าง"), but let "0"/"0." be typed.
        value={mode === "percent" ? (pct !== "" && (valueBaht > 0 || Number(pct) === 0) ? pct : "") : (valueBaht || "")}
        onChange={e => {
          const n = Math.max(0, Number(e.target.value) || 0);
          if (mode === "percent") { setPct(e.target.value); onChange(toBaht(n)); }
          else onChange(n);
        }}
        placeholder={mode === "percent" ? "0 %" : "0"}
        className={className}
        style={style}
      />
      {mode === "percent" && valueBaht > 0 && (
        <span className="text-[11px] whitespace-nowrap" style={{ color: "#A08070" }}>= ฿{valueBaht.toLocaleString("th-TH")}</span>
      )}
      <span className="inline-flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #E8D8CC" }}>
        {(["baht", "percent"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (m === mode) return;
              setMode(m);
              setPct("");
              onChange(0);
            }}
            className="px-2 py-0.5 text-xs font-semibold"
            style={m === mode ? { background: "#8B1D24", color: "white" } : { background: "white", color: "#A08070" }}
            aria-pressed={m === mode}
          >
            {m === "baht" ? "฿" : "%"}
          </button>
        ))}
      </span>
    </>
  );
}
