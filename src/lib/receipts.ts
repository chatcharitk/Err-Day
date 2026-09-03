/**
 * Sales receipts (ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ).
 *
 * One Receipt per paid Booking. Everything the printed document shows is
 * SNAPSHOT onto the Receipt row at issue time — seller identity, VAT rate and
 * the split amounts — because editing CompanyProfile later must never rewrite a
 * document already handed to a customer.
 *
 * Money is satang everywhere, and catalogue prices in this app are already
 * VAT-INCLUSIVE, so VAT is backed OUT of the total rather than added on top.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { randomBytes } from "crypto";

type Db = Prisma.TransactionClient;

/** A line as it will be printed. `totalSatang` wins if it disagrees with qty × unit. */
export interface ReceiptLineInput {
  description:     string;
  quantity:        number;
  unitPriceSatang: number;
  totalSatang:     number;
}

export interface IssueReceiptOpts {
  /** Structured cart lines (POS). Omitted → derived from the booking's service + addons. */
  items?:           ReceiptLineInput[];
  paymentMethod?:   string | null;
  issuedByAdminId?: string | null;
  issuedByName?:    string | null;
}

/**
 * Split a VAT-INCLUSIVE gross into net + VAT.
 *
 * `netSatang + vatSatang === grossSatang` exactly — the VAT is whatever is left
 * after rounding the net, never rounded independently, so the printed lines
 * always add up to what the customer actually paid.
 */
export function splitVatInclusive(grossSatang: number, ratePercent: number) {
  if (ratePercent <= 0) return { netSatang: grossSatang, vatSatang: 0 };
  const netSatang = Math.round((grossSatang * 100) / (100 + ratePercent));
  return { netSatang, vatSatang: grossSatang - netSatang };
}

/** Buddhist-era year of the Bangkok calendar day for `d` (server runs in UTC). */
function bangkokBuddhistYear(d: Date): number {
  const bangkok = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return bangkok.getUTCFullYear() + 543;
}

/** "2569-000123" — BE year of issue + the global running number. */
export function formatReceiptNumber(sequence: number, issuedAt: Date): string {
  return `${bangkokBuddhistYear(issuedAt)}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Take the next global running number. The UPDATE ... RETURNING is atomic and
 * takes a row lock, so concurrent sales serialise here briefly; run inside the
 * receipt's own transaction so a rollback hands the number back.
 */
async function nextSequence(tx: Db): Promise<number> {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    UPDATE "ReceiptCounter"
       SET "lastNumber" = "lastNumber" + 1
     WHERE "id" = 'global'
    RETURNING "lastNumber"
  `;
  if (rows.length > 0) return rows[0].lastNumber;

  // Counter row missing (fresh DB that skipped the migration's seed) — create it
  // already claiming number 1 so we never hand out 1 twice.
  await tx.receiptCounter.create({ data: { id: "global", lastNumber: 1 } });
  return 1;
}

/**
 * Derive printable lines for a booking that didn't come through the POS cart
 * (online booking marked paid, transfer slip confirmed, …): the service itself
 * plus any add-ons, with the service line absorbing whatever the admin actually
 * charged so the lines always reconcile to `totalPrice`.
 */
function deriveItemsFromBooking(booking: {
  totalPrice: number;
  service: { name: string; nameTh: string | null } | null;
  addons: { price: number; addon: { nameTh: string | null; name: string } }[];
}): ReceiptLineInput[] {
  const addonLines: ReceiptLineInput[] = booking.addons.map((a) => ({
    description:     a.addon.nameTh || a.addon.name,
    quantity:        1,
    unitPriceSatang: a.price,
    totalSatang:     a.price,
  }));
  const addonsTotal = addonLines.reduce((s, l) => s + l.totalSatang, 0);
  const serviceTotal = booking.totalPrice - addonsTotal;

  // A manual price below the add-on total would make the service line negative;
  // fall back to a single line for the whole amount rather than print nonsense.
  if (serviceTotal < 0) {
    return [{
      description:     booking.service?.nameTh || booking.service?.name || "บริการ",
      quantity:        1,
      unitPriceSatang: booking.totalPrice,
      totalSatang:     booking.totalPrice,
    }];
  }

  return [
    {
      description:     booking.service?.nameTh || booking.service?.name || "บริการ",
      quantity:        1,
      unitPriceSatang: serviceTotal,
      totalSatang:     serviceTotal,
    },
    ...addonLines,
  ];
}

/**
 * Issue the receipt for a paid booking, inside an existing transaction.
 *
 * Idempotent: a booking already carrying a receipt returns that receipt
 * untouched (Receipt.bookingId is unique), so a payment path firing twice
 * cannot mint a second document or burn a second number.
 *
 * Returns null when there is nothing to receipt — a zero/negative total, e.g. a
 * visit fully redeemed against a package. No money changed hands, so no
 * document and no number is spent.
 */
export async function issueReceiptForBookingTx(
  tx: Db,
  bookingId: string,
  opts: IssueReceiptOpts = {},
) {
  const existing = await tx.receipt.findUnique({
    where:   { bookingId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  const booking = await tx.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, branchId: true, customerId: true, totalPrice: true, paidAt: true,
      service: { select: { name: true, nameTh: true } },
      branch:  { select: { phone: true, taxBranchCode: true, name: true, address: true } },
      addons:  { select: { price: true, addon: { select: { name: true, nameTh: true } } } },
    },
  });
  if (!booking) return null;
  if (booking.totalPrice <= 0) return null;

  // Fall back to blanks rather than failing the sale if settings were never filled in.
  const company = await tx.companyProfile.findUnique({ where: { id: "company" } });
  const vatRegistered  = company?.vatRegistered ?? false;
  const vatRatePercent = company?.vatRatePercent ?? 7;

  const gross = booking.totalPrice;
  const { netSatang, vatSatang } = vatRegistered
    ? splitVatInclusive(gross, vatRatePercent)
    : { netSatang: gross, vatSatang: 0 };

  const issuedAt = new Date();
  const sequence = await nextSequence(tx);

  const lines = (opts.items && opts.items.length > 0)
    ? opts.items
    : deriveItemsFromBooking(booking);

  return tx.receipt.create({
    data: {
      number:      formatReceiptNumber(sequence, issuedAt),
      sequence,
      bookingId:   booking.id,
      branchId:    booking.branchId,
      customerId:  booking.customerId,
      issuedAt,
      issuedByAdminId: opts.issuedByAdminId ?? null,
      issuedByName:    opts.issuedByName ?? null,
      // Seller identity is copied, not joined — this is the legal record.
      sellerName:       company?.legalName || booking.branch.name,
      sellerTaxId:      company?.taxId || "",
      sellerAddress:    company?.addressLine || booking.branch.address,
      sellerBranchCode: booking.branch.taxBranchCode,
      sellerPhone:      company?.phone || booking.branch.phone,
      grossSatang:    gross,
      netSatang,
      vatSatang,
      vatRatePercent: vatRegistered ? vatRatePercent : 0,
      vatRegistered,
      // Only a VAT-registered seller may call it a tax invoice.
      docType:       vatRegistered ? "ABB_TAX_INVOICE" : "RECEIPT",
      paymentMethod: opts.paymentMethod ?? null,
      publicToken:   randomBytes(16).toString("hex"),
      items: {
        create: lines.map((l, i) => ({
          description:     l.description,
          quantity:        l.quantity,
          unitPriceSatang: l.unitPriceSatang,
          totalSatang:     l.totalSatang,
          sortOrder:       i,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

/**
 * Standalone entry point — wraps its own transaction so the number allocation
 * and the document are committed together. Use from callers that aren't already
 * inside one (the POS route, admin re-issue).
 */
export async function issueReceiptForBooking(bookingId: string, opts: IssueReceiptOpts = {}) {
  return prisma.$transaction((tx) => issueReceiptForBookingTx(tx, bookingId, opts));
}

/** Path of the public receipt page. */
export function receiptPath(publicToken: string): string {
  return `/receipt/${publicToken}`;
}

/**
 * Public URL of a receipt, for the print button, QR and shareable link.
 *
 * `origin` should be passed wherever the real request host is known (the
 * receipt page derives it from headers) — the QR has to be absolute to be
 * scannable, and NEXT_PUBLIC_APP_URL isn't always set outside production.
 */
export function receiptUrl(publicToken: string, origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}${receiptPath(publicToken)}`;
}
