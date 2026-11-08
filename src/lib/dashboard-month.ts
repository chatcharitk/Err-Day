// Month selection for the BI dashboards (?month=YYYY-MM).
// Current month = month-to-date compared with the same days last month.
// A past month = the whole month compared with the whole previous month.

export const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
export const THAI_MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

/** First month offered in the picker (first bookings in the system). */
const FIRST_MONTH = "2026-01";

/** Hours shown on the "busy hours" chart. */
export const BI_HOUR_FROM = 7;
export const BI_HOUR_TO = 22;

export interface MonthOption { key: string; label: string }

export interface DashPeriod {
  monthKey: string;         // YYYY-MM
  isCurrent: boolean;
  year: number;
  monthIdx: number;         // 0–11
  endDay: number;           // last day counted (today for current month)
  fullMonthEnd: number;
  lastYear: number;
  lastMonthIdx: number;
  lastEndDay: number;       // same range in the previous month (clamped)
  monthLabel: string;       // "ตุลาคม 2569"
  rangeLabel: string;       // "1–31 ต.ค."
  lastRangeLabel: string;
  options: MonthOption[];   // newest first
}

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** todayStr = Bangkok date "YYYY-MM-DD"; raw = the ?month= param. */
export function dashPeriod(todayStr: string, raw?: string): DashPeriod {
  const ty = Number(todayStr.slice(0, 4));
  const tm = Number(todayStr.slice(5, 7)) - 1;
  const td = Number(todayStr.slice(8, 10));
  const currentKey = key(ty, tm);

  let monthKey = currentKey;
  if (raw && /^\d{4}-\d{2}$/.test(raw) && raw >= FIRST_MONTH && raw < currentKey) {
    const mm = Number(raw.slice(5, 7));
    if (mm >= 1 && mm <= 12) monthKey = raw;
  }
  const year = Number(monthKey.slice(0, 4));
  const monthIdx = Number(monthKey.slice(5, 7)) - 1;
  const isCurrent = monthKey === currentKey;
  const fullMonthEnd = daysIn(year, monthIdx);
  const endDay = isCurrent ? td : fullMonthEnd;

  const lastMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
  const lastYear = monthIdx === 0 ? year - 1 : year;
  const lastDays = daysIn(lastYear, lastMonthIdx);
  const lastEndDay = isCurrent ? Math.min(endDay, lastDays) : lastDays;

  const options: MonthOption[] = [];
  for (let y = ty, m = tm; key(y, m) >= FIRST_MONTH; m === 0 ? (y--, m = 11) : m--) {
    options.push({ key: key(y, m), label: `${THAI_MONTHS[m]} ${y + 543}` });
  }

  return {
    monthKey, isCurrent, year, monthIdx, endDay, fullMonthEnd,
    lastYear, lastMonthIdx, lastEndDay,
    monthLabel: `${THAI_MONTHS[monthIdx]} ${year + 543}`,
    rangeLabel: `1–${endDay} ${THAI_MONTHS_SHORT[monthIdx]}`,
    lastRangeLabel: `1–${lastEndDay} ${THAI_MONTHS_SHORT[lastMonthIdx]}`,
    options,
  };
}

/** Dashboard URL keeping branch + month (current month / all branches omitted). */
export function dashHref(base: string, branchId: string, monthKey: string, currentKey: string) {
  const p = new URLSearchParams();
  if (branchId !== "all") p.set("branchId", branchId);
  if (monthKey !== currentKey) p.set("month", monthKey);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
