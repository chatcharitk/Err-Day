/**
 * Thai / English wording for the receipt page. The Thai receipt is the legal
 * original; English is a convenience copy for foreign customers, so the page
 * keeps the Thai document title alongside the English one.
 */
export type ReceiptLang = "th" | "en";

export function parseReceiptLang(v: string | string[] | undefined): ReceiptLang {
  return (Array.isArray(v) ? v[0] : v) === "en" ? "en" : "th";
}

export const RECEIPT_TEXT = {
  th: {
    void: "ยกเลิกแล้ว / VOID",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    headOffice: "สำนักงานใหญ่",
    branchNo: (c: string) => `สาขาที่ ${c}`,
    tel: "โทร.",
    titleTax: "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ",
    titlePlain: "ใบเสร็จรับเงิน",
    no: "เลขที่", date: "วันที่", branch: "สาขา", customer: "ลูกค้า", cashier: "ผู้รับเงิน",
    subtotal: "รวมย่อย", net: "มูลค่าก่อนภาษี", vat: (r: number) => `ภาษีมูลค่าเพิ่ม ${r}%`,
    total: "รวมทั้งสิ้น", paidBy: "ชำระโดย",
    scan: "สแกนเพื่อดูใบเสร็จอิเล็กทรอนิกส์",
    issuedInSet: "เอกสารออกเป็นชุด",
    thanks: "ขอบคุณที่ใช้บริการ",
    back: "กลับ", print: "พิมพ์ใบเสร็จ", share: "ส่งลิงก์", copied: "คัดลอกลิงก์ใบเสร็จแล้ว",
  },
  en: {
    void: "ยกเลิกแล้ว / VOID",
    taxId: "Tax ID",
    headOffice: "Head office",
    branchNo: (c: string) => `Branch ${c}`,
    tel: "Tel.",
    // Thai title kept first: it is the legal name of the document.
    titleTax: "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ\nReceipt / Abbreviated Tax Invoice",
    titlePlain: "ใบเสร็จรับเงิน\nReceipt",
    no: "No.", date: "Date", branch: "Branch", customer: "Customer", cashier: "Cashier",
    subtotal: "Subtotal", net: "Amount before VAT", vat: (r: number) => `VAT ${r}%`,
    total: "Total", paidBy: "Paid by",
    scan: "Scan to view the electronic receipt",
    issuedInSet: "Issued as a set",
    thanks: "Thank you for visiting",
    back: "Back", print: "Print receipt", share: "Share link", copied: "Receipt link copied",
  },
} as const;

const PAYMENT_EN: Record<string, string> = { "เงินสด": "Cash", "โอน": "Bank transfer", "บัตร": "Card" };
export function paymentLabel(method: string, lang: ReceiptLang): string {
  return lang === "en" ? (PAYMENT_EN[method] ?? method) : method;
}

/** "28 Oct 2026 14:32" (English) or "28/10/2569 14:32" (Thai, Buddhist era) — Bangkok clock. */
export function fmtReceiptDate(d: Date, lang: ReceiptLang): string {
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(bkk.getUTCHours())}:${pad(bkk.getUTCMinutes())}`;
  if (lang === "en") {
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][bkk.getUTCMonth()];
    return `${bkk.getUTCDate()} ${mon} ${bkk.getUTCFullYear()} ${time}`;
  }
  return `${pad(bkk.getUTCDate())}/${pad(bkk.getUTCMonth() + 1)}/${bkk.getUTCFullYear() + 543} ${time}`;
}

/**
 * English wording for a line description. `names` maps a Thai service/add-on
 * name to its English name; anything not in it (a typed-in special service,
 * a coupon) stays exactly as it was printed.
 */
export function lineLabel(description: string, lang: ReceiptLang, names: Map<string, string>): string {
  if (lang !== "en") return description;
  const direct = names.get(description);
  if (direct) return direct;
  if (description === "ส่วนลดทั้งบิล") return "Bill discount";
  if (description === "ส่วนลด") return "Discount";
  const m = description.match(/^ส่วนลด \((.+)\)$/);
  if (m) return `Discount (${names.get(m[1]) ?? m[1]})`;
  return description;
}
