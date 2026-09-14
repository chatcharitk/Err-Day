/** Pure money/time rules, shared by the preview and server. Money is integer satang. */
export function validDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function numberIn(
  value: unknown,
  label: string,
  min = 0,
  max = 2_000_000_000,
  integer = true,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new Error(`${label} ไม่ถูกต้อง`);
  return value;
}
export type ExpenseLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  kind?: string | null;
};
export type VatMode = "NONE" | "INCLUSIVE" | "EXCLUSIVE" | "LEGACY";
export function expenseTotals(input: {
  items: ExpenseLine[];
  totalAmount?: number;
  discountAmount?: number;
  vatMode: VatMode;
  vatRate?: number;
  vatAmount?: number | null;
  withholdingAmount?: number;
}) {
  const items = input.items.map((it) => {
    if (typeof it.description !== "string" || !it.description.trim())
      throw new Error("กรุณาระบุชื่อรายการ");
    const quantity = numberIn(it.quantity, "จำนวน", 0.001, 1_000_000, false);
    const unitPrice = numberIn(it.unitPrice, "ราคาต่อหน่วย");
    const totalPrice =
      input.vatMode === "LEGACY" && it.totalPrice !== undefined
        ? numberIn(it.totalPrice, "ยอดรายการเดิม")
        : Math.round(quantity * unitPrice);
    numberIn(totalPrice, "ยอดรายการ");
    return {
      description: it.description.trim(),
      quantity,
      unitPrice,
      totalPrice,
      ...(it.kind ? { kind: it.kind } : {}),
    };
  });
  const subtotal = items.length
    ? items.reduce((s, it) => s + it.totalPrice, 0)
    : numberIn(input.totalAmount, "ยอดเงิน");
  numberIn(subtotal, "ยอดรวม");
  const discount = numberIn(input.discountAmount ?? 0, "ส่วนลด", 0, subtotal);
  const taxable = subtotal - discount;
  const rate = numberIn(input.vatRate ?? 7, "อัตรา VAT", 0, 100, false);
  let vat = 0;
  let total = taxable;
  if (input.vatMode === "EXCLUSIVE") {
    vat = Math.round((taxable * rate) / 100);
    total += vat;
  } else if (input.vatMode === "INCLUSIVE")
    vat = Math.round((taxable * rate) / (100 + rate));
  else if (input.vatMode === "LEGACY") {
    total = numberIn(input.totalAmount, "ยอดเดิม");
    vat = numberIn(input.vatAmount ?? 0, "VAT เดิม", 0, total);
  } else if (input.vatMode !== "NONE")
    throw new Error("วิธีคิด VAT ไม่ถูกต้อง");
  numberIn(total, "ยอดรวม");
  const withholding = numberIn(
    input.withholdingAmount ?? 0,
    "ภาษีหัก ณ ที่จ่าย",
    0,
    total,
  );
  return {
    items,
    subtotal,
    vatAmount: vat,
    totalAmount: total,
    netAmount: total - withholding,
    discountAmount: discount,
    withholdingAmount: withholding,
  };
}
export function workMinutes(
  clockIn: string | Date,
  clockOut: string | Date,
  breakMinutes = 0,
): number {
  const elapsed =
    (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
  numberIn(elapsed, "ช่วงเวลาเข้า–ออก (ไม่เกิน 24 ชม.)", 1, 1440);
  numberIn(breakMinutes, "เวลาพัก", 0, elapsed);
  return elapsed - breakMinutes;
}
export function overtimeMinutes(
  workedMinutes: number,
  normalMinutes: number,
): number {
  numberIn(workedMinutes, "เวลาทำงาน", 0, 1440);
  numberIn(normalMinutes, "ชั่วโมงปกติ", 1, 1440);
  return Math.max(0, workedMinutes - normalMinutes);
}
export function csvText(rows: unknown[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = value == null ? "" : String(value);
            // Spreadsheet formula injection, including leading whitespace.
            if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
