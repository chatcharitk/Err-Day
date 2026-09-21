"use client";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BG      = "#FDF7F2";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Heading above the rules, e.g. "ข้อตกลงการจอง". */
  title: string;
  /** The rules themselves — rendered as a visible numbered list. */
  rules: string[];
  /** Checkbox label, e.g. "ฉันได้อ่านและยอมรับข้อตกลงนี้". */
  label: string;
}

/**
 * Terms acceptance. Unlike PdpaConsentBlock the rules are always visible rather
 * than hidden behind a disclosure — they are short, and a term the customer has
 * to expand before seeing is a term they can credibly say they never saw.
 */
export default function TermsConsentBlock({ checked, onChange, title, rules, label }: Props) {
  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{ borderColor: checked ? PRIMARY : BORDER, background: checked ? "#FFF8F4" : BG }}
    >
      <p className="text-sm font-medium" style={{ color: TEXT }}>{title}</p>

      <ol className="space-y-1.5 list-none">
        {rules.map((rule, i) => (
          <li key={i} className="flex gap-2 text-xs" style={{ color: MUTED }}>
            <span className="flex-shrink-0 font-semibold" style={{ color: PRIMARY }}>{i + 1}.</span>
            <span className="flex-1">{rule}</span>
          </li>
        ))}
      </ol>

      <label
        className="flex items-start gap-2.5 cursor-pointer select-none pt-1.5 border-t"
        style={{ borderColor: BORDER }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-800 flex-shrink-0"
        />
        <span className="flex-1 text-sm font-medium" style={{ color: TEXT }}>{label}</span>
      </label>
    </div>
  );
}
