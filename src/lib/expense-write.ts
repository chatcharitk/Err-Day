import type { Prisma } from "@/generated/prisma/client";
import {
  expenseTotals,
  validDay,
  type ExpenseLine,
  type VatMode,
} from "./finance-math";
import { isExpenseCategory, PAYMENT_METHODS } from "./expenses";
import { jsonSnapshot } from "./finance-audit";
export function attachmentData(value: unknown) {
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("ไฟล์แนบไม่ถูกต้อง (สูงสุด 30 ไฟล์)");
  return value.map((a) => {
    if (!a || typeof a.url !== "string" || !/^https?:\/\//.test(a.url))
      throw new Error("ที่อยู่ไฟล์ไม่ถูกต้อง");
    return {
      url: a.url,
      filename: typeof a.filename === "string" ? a.filename : null,
      fileType: typeof a.fileType === "string" ? a.fileType : null,
    };
  });
}
export async function expenseData(
  tx: Prisma.TransactionClient,
  b: Record<string, unknown>,
  legacyAllowed = false,
) {
  if (!isExpenseCategory(String(b.category)))
    throw new Error("กรุณาเลือกหมวดรายจ่าย");
  if (!validDay(String(b.date))) throw new Error("วันที่ไม่ถูกต้อง");
  if (b.documentDate && !validDay(String(b.documentDate)))
    throw new Error("วันที่เอกสารไม่ถูกต้อง");
  if (b.paidDate && !validDay(String(b.paidDate)))
    throw new Error("วันที่จ่ายไม่ถูกต้อง");
  const mode = String(b.vatMode || "NONE") as VatMode;
  if (mode === "LEGACY" && !legacyAllowed)
    throw new Error("กรุณาเลือกวิธีคิด VAT ใหม่");
  if (!Array.isArray(b.items) || b.items.length > 200)
    throw new Error("รายการย่อยไม่ถูกต้อง");
  const calc = expenseTotals({
    items: b.items as ExpenseLine[],
    totalAmount:
      mode === "LEGACY"
        ? Number(b.totalAmount)
        : b.items.length
          ? Number(b.totalAmount)
          : Number(b.manualAmount ?? b.totalAmount),
    discountAmount: Number(b.discountAmount ?? 0),
    vatMode: mode,
    vatRate: Number(b.vatRate ?? 7),
    vatAmount: b.vatAmount == null ? null : Number(b.vatAmount),
    withholdingAmount: Number(b.withholdingAmount ?? 0),
  });
  if (Number(b.totalAmount) !== calc.totalAmount)
    throw new Error("ยอดรวมไม่ตรงกับรายการ กรุณาคำนวณใหม่");
  if (
    b.paymentMethod &&
    !PAYMENT_METHODS.some((p) => p.value === b.paymentMethod)
  )
    throw new Error("วิธีจ่ายไม่ถูกต้อง");
  if (b.paidDate && !b.paymentMethod) throw new Error("กรุณาระบุวิธีจ่าย");
  let vendor = null;
  if (b.vendorId) {
    vendor = await tx.vendor.findUniqueOrThrow({
      where: { id: String(b.vendorId) },
    });
  } else if (typeof b.vendor === "string" && b.vendor.trim()) {
    const name = b.vendor.trim();
    // Serialize free-text creation to avoid duplicate vendors from concurrent expenses.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`vendor:${name.toLocaleLowerCase()}`}))::text`;
    vendor =
      (await tx.vendor.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, isActive: true },
      })) ??
      (await tx.vendor.create({
        data: { name, category: String(b.category) },
      }));
  }
  if (b.status === "CONFIRMED" && !vendor)
    throw new Error("กรุณาเลือกหรือระบุผู้รับเงินก่อนยืนยัน");
  const data = {
    branchId: b.branchId ? String(b.branchId) : null,
    category: String(b.category),
    vendor: vendor?.legalName || vendor?.name || null,
    vendorId: vendor?.id ?? null,
    ...(vendor ? { payeeSnapshot: jsonSnapshot(vendor) } : {}),
    date: new Date(String(b.date) + "T12:00:00Z"),
    documentDate: b.documentDate
      ? new Date(String(b.documentDate) + "T12:00:00Z")
      : null,
    paidAt: b.paidDate
      ? new Date(String(b.paidDate) + "T12:00:00+07:00")
      : null,
    invoiceNumber: b.invoiceNumber ? String(b.invoiceNumber) : null,
    totalAmount: calc.totalAmount,
    vatAmount: calc.vatAmount,
    discountAmount: calc.discountAmount,
    withholdingAmount: calc.withholdingAmount,
    vatMode: mode,
    vatRate: Number(b.vatRate ?? 7),
    paymentMethod: b.paymentMethod ? String(b.paymentMethod) : null,
    notes: b.notes ? String(b.notes) : null,
    status: b.status === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
  };
  return {
    data,
    items: calc.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    })),
    attachments: attachmentData(b.attachments ?? []),
  };
}
