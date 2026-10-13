/**
 * Pay-slip types and pure helpers — no database access, so client components
 * (the owner's slip editor) can import them. Data assembly lives in payslip.ts.
 */
export type PayslipLineKind =
  | "BASE" | "COMMISSION" | "OT" | "TIP" | "TRAVEL" | "ADJUSTMENT" | "OTHER" | "DEDUCTION";

export interface PayslipLine {
  kind: PayslipLineKind;
  label: string;
  /** Satang. Positive for earnings and for deductions alike (DEDUCTION subtracts). */
  amountSatang: number;
}

export const LINE_KIND_LABEL: Record<PayslipLineKind, string> = {
  BASE: "เงินเดือน / ค่าแรง",
  COMMISSION: "ค่าคอม / ค่ามือ",
  OT: "ค่าล่วงเวลา (OT)",
  TIP: "ทิป",
  TRAVEL: "ค่าเดินทาง",
  ADJUSTMENT: "ปรับเพิ่ม / ลด",
  OTHER: "รายได้อื่น",
  DEDUCTION: "รายการหัก",
};

export function payslipTotals(lines: PayslipLine[]) {
  const gross = lines.filter(l => l.kind !== "DEDUCTION").reduce((s, l) => s + l.amountSatang, 0);
  const deduction = lines.filter(l => l.kind === "DEDUCTION").reduce((s, l) => s + l.amountSatang, 0);
  return { gross, deduction, net: gross - deduction };
}

/** Validates lines coming from the admin editor. Throws a Thai message on bad input. */
export function parseLines(input: unknown): PayslipLine[] {
  if (!Array.isArray(input)) throw new Error("รายการไม่ถูกต้อง");
  const kinds = Object.keys(LINE_KIND_LABEL);
  return input.map((raw, i) => {
    const l = raw as Partial<PayslipLine>;
    const label = String(l.label ?? "").trim().slice(0, 120);
    const amount = Number(l.amountSatang);
    if (!kinds.includes(String(l.kind))) throw new Error(`ประเภทรายการที่ ${i + 1} ไม่ถูกต้อง`);
    if (!label) throw new Error(`กรุณาใส่ชื่อรายการที่ ${i + 1}`);
    if (!Number.isFinite(amount) || Math.abs(amount) > 100_000_000) throw new Error(`จำนวนเงินรายการที่ ${i + 1} ไม่ถูกต้อง`);
    if (l.kind !== "ADJUSTMENT" && amount < 0) throw new Error(`จำนวนเงินรายการที่ ${i + 1} ต้องไม่ติดลบ`);
    return { kind: l.kind as PayslipLineKind, label, amountSatang: Math.round(amount) };
  });
}

export function monthLabelTh(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
}
