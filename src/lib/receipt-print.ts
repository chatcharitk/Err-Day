/**
 * Receipt → printer bytes for the shop's 80 mm thermal printers (Xprinter
 * XP-C300H, ESC/POS). The slip is DRAWN as a picture and sent as a raster
 * image, so Thai (stacked vowels and tone marks) always prints correctly no
 * matter which Thai code pages the printer firmware has, and a layout change
 * is one deploy instead of an update on every branch's computer.
 */
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { englishNames } from "@/lib/receipt-names";
import { RECEIPT_TEXT, fmtReceiptDate, lineLabel, paymentLabel, type ReceiptLang } from "@/lib/receipt-i18n";
import { receiptUrl } from "@/lib/receipts";

// ── Fonts ────────────────────────────────────────────────────────────────────

const FONT_DIR = path.join(process.cwd(), "src/lib/print-fonts");
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  for (const [file, family] of [
    ["sarabun-thai-400-normal.woff", "PrintTh"],
    ["sarabun-latin-400-normal.woff", "PrintLa"],
    ["sarabun-thai-700-normal.woff", "PrintThB"],
    ["sarabun-latin-700-normal.woff", "PrintLaB"],
  ]) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  fontsReady = true;
}
const font = (size: number, bold = false) => bold ? `${size}px PrintThB, PrintLaB` : `${size}px PrintTh, PrintLa`;

/** Drop what the font can't draw (emoji) and ASCII-fy a couple of symbols. */
export function printable(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/≤/g, "<=").replace(/≥/g, ">=")
    .replace(/\s+/g, " ").trim();
}

// ── The receipt as data ──────────────────────────────────────────────────────

export interface PrintView {
  lang: ReceiptLang;
  voided: boolean; voidReason: string | null;
  sellerName: string; sellerAddress: string; sellerTaxId: string; branchText: string | null; sellerPhone: string | null;
  isTaxInvoice: boolean;
  number: string; dateText: string; branchName: string; customer: string | null; cashier: string | null;
  items: { description: string; qty: number; unit: string; total: string }[];
  subtotal: string | null; net: string; vat: string; vatRate: number; gross: string;
  paymentMethod: string | null;
  qrUrl: string | null;
  footer: string | null;
}

const money = (satang: number) => (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function loadPrintView(receiptId: string, lang: ReceiptLang, origin: string): Promise<PrintView | null> {
  const [r, company] = await Promise.all([
    prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        branch: { select: { name: true } },
        booking: { select: { customer: { select: { name: true } } } },
      },
    }),
    prisma.companyProfile.findUnique({ where: { id: "company" }, select: { receiptFooterTh: true } }),
  ]);
  if (!r) return null;
  const t = RECEIPT_TEXT[lang];
  const names = lang === "en" ? await englishNames(r.items.map(i => i.description)) : new Map<string, string>();
  const code = r.sellerBranchCode;
  const sub = r.items.reduce((s, i) => s + i.totalSatang, 0);
  return {
    lang,
    voided: !!r.voidedAt, voidReason: r.voidReason,
    sellerName: r.sellerName || r.branch.name, sellerAddress: r.sellerAddress, sellerTaxId: r.sellerTaxId,
    branchText: !code ? null : /^0*$/.test(code) ? t.headOffice : t.branchNo(code),
    sellerPhone: r.sellerPhone,
    isTaxInvoice: r.vatRegistered && r.docType === "ABB_TAX_INVOICE",
    number: r.number, dateText: fmtReceiptDate(r.issuedAt, lang), branchName: r.branch.name,
    customer: r.buyerName ?? r.booking?.customer?.name ?? null, cashier: r.issuedByName,
    items: r.items.map(i => ({ description: lineLabel(i.description, lang, names), qty: i.quantity, unit: money(i.unitPriceSatang), total: money(i.totalSatang) })),
    subtotal: sub !== r.grossSatang ? money(sub) : null,
    net: money(r.netSatang), vat: money(r.vatSatang), vatRate: r.vatRatePercent, gross: money(r.grossSatang),
    paymentMethod: r.paymentMethod ? paymentLabel(r.paymentMethod, lang) : null,
    qrUrl: receiptUrl(r.publicToken, origin) + (lang === "en" ? "?lang=en" : ""),
    footer: company?.receiptFooterTh?.trim() || null,
  };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;
const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "grapheme" }) : null;

/** Word-wrap `text` to `maxW` pixels (Thai has no spaces, so break on dictionary words). */
function wrap(ctx: SKRSContext2D, text: string, maxW: number): string[] {
  const words = segmenter ? [...segmenter.segment(text)].map(s => s.segment) : text.split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  const push = () => { if (cur.trim()) lines.push(cur.trimEnd()); cur = ""; };
  for (const w of words) {
    if (ctx.measureText(cur + w).width <= maxW) { cur += w; continue; }
    push();
    if (ctx.measureText(w.trimStart()).width <= maxW) { cur = w.trimStart(); continue; }
    // One unbreakable run wider than the line: split it by character.
    for (const g of graphemes ? [...graphemes.segment(w)].map(s => s.segment) : [...w]) {
      if (ctx.measureText(cur + g).width > maxW) push();
      cur += g;
    }
  }
  push();
  return lines.length ? lines : [""];
}

interface Slip { width: number; height: number; image: Uint8ClampedArray }

/** Draw `build` onto a tall scratch canvas, then crop to the height actually used. */
function drawSlip(width: number, build: (c: { ctx: SKRSContext2D; W: number; y: number }) => number): Slip {
  ensureFonts();
  const scratch = createCanvas(width, 7000);
  const ctx = scratch.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, 7000);
  ctx.fillStyle = "#000"; ctx.strokeStyle = "#000"; ctx.textBaseline = "alphabetic";
  const used = Math.min(7000, Math.ceil(build({ ctx, W: width, y: 0 })));
  return { width, height: used, image: ctx.getImageData(0, 0, width, used).data };
}

const PAD = 8;

function rule(ctx: SKRSContext2D, W: number, y: number): number {
  ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(PAD, y + 8); ctx.lineTo(W - PAD, y + 8); ctx.stroke(); ctx.restore();
  return y + 20;
}
function centered(ctx: SKRSContext2D, W: number, y: number, text: string, size: number, bold = false, lh = 1.4): number {
  ctx.font = font(size, bold); ctx.textAlign = "center";
  for (const ln of wrap(ctx, text, W - PAD * 2)) { y += size * lh; ctx.fillText(ln, W / 2, y - size * 0.25); }
  return y;
}
function kv(ctx: SKRSContext2D, W: number, y: number, k: string, v: string, size = 23, bold = false): number {
  ctx.font = font(size, bold); y += size * 1.45;
  ctx.textAlign = "right"; ctx.fillText(v, W - PAD, y - size * 0.25);
  const vw = ctx.measureText(v).width;
  ctx.textAlign = "left"; ctx.fillText(k, PAD, y - size * 0.25);
  void vw;
  return y;
}

function drawQr(ctx: SKRSContext2D, W: number, y: number, url: string): number {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const mod = Math.max(3, Math.floor(208 / n));
  const side = n * mod;
  const x0 = Math.floor((W - side) / 2);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) ctx.fillRect(x0 + c * mod, y + r * mod, mod, mod);
  return y + side;
}

function drawReceipt(v: PrintView, width: number): Slip {
  const t = RECEIPT_TEXT[v.lang];
  return drawSlip(width, ({ ctx, W }) => {
    let y = 14;
    if (v.voided) {
      ctx.font = font(26, true); ctx.textAlign = "center";
      ctx.lineWidth = 3; ctx.strokeRect(PAD, y, W - PAD * 2, 46); ctx.setLineDash([]);
      ctx.fillText(t.void, W / 2, y + 33); y += 62;
    }
    y = centered(ctx, W, y, printable(v.sellerName), 27, true);
    if (v.sellerAddress) y = centered(ctx, W, y, printable(v.sellerAddress.replace(/\n/g, " ")), 20);
    if (v.sellerTaxId) y = centered(ctx, W, y, `${t.taxId} ${v.sellerTaxId}`, 20);
    if (v.branchText) y = centered(ctx, W, y, v.branchText, 20);
    if (v.sellerPhone) y = centered(ctx, W, y, `${t.tel} ${v.sellerPhone}`, 20);
    y += 8;
    for (const ln of (v.isTaxInvoice ? t.titleTax : t.titlePlain).split("\n")) y = centered(ctx, W, y, ln, 28, true);
    y = rule(ctx, W, y + 4);

    y = kv(ctx, W, y, t.no, v.number, 23, true);
    y = kv(ctx, W, y, t.date, v.dateText);
    y = kv(ctx, W, y, t.branch, printable(v.branchName));
    if (v.customer) y = kv(ctx, W, y, t.customer, printable(v.customer));
    if (v.cashier) y = kv(ctx, W, y, t.cashier, printable(v.cashier));
    y = rule(ctx, W, y + 4);

    for (const it of v.items) {
      ctx.font = font(23); ctx.textAlign = "left";
      for (const ln of wrap(ctx, printable(it.description), W - PAD * 2)) { y += 23 * 1.4; ctx.fillText(ln, PAD, y - 6); }
      y += 23 * 1.4;
      ctx.font = font(23); ctx.textAlign = "left"; ctx.fillText(`${it.qty} x ${it.unit}`, PAD + 24, y - 6);
      ctx.textAlign = "right"; ctx.fillText(it.total, W - PAD, y - 6);
      y += 6;
    }
    y = rule(ctx, W, y + 2);

    if (v.subtotal) y = kv(ctx, W, y, t.subtotal, v.subtotal);
    if (v.isTaxInvoice) {
      y = kv(ctx, W, y, t.net, v.net);
      y = kv(ctx, W, y, t.vat(v.vatRate), v.vat);
    }
    y = kv(ctx, W, y + 2, t.total, v.gross, 30, true);
    if (v.paymentMethod) y = kv(ctx, W, y + 4, t.paidBy, v.paymentMethod);
    y = rule(ctx, W, y + 4);

    if (v.qrUrl) { y = drawQr(ctx, W, y + 6, v.qrUrl) + 6; y = centered(ctx, W, y, t.scan, 20); }
    if (v.isTaxInvoice) y = centered(ctx, W, y + 4, t.issuedInSet, 20);
    if (v.footer) y = centered(ctx, W, y + 6, printable(v.footer), 20);
    y = centered(ctx, W, y + 8, t.thanks, 23);
    return y + 24;
  });
}

function drawTest(branchName: string, width: number): Slip {
  const stamp = fmtReceiptDate(new Date(), "th");
  return drawSlip(width, ({ ctx, W }) => {
    let y = 14;
    y = centered(ctx, W, y, "err·day", 34, true);
    y = centered(ctx, W, y + 4, "พิมพ์ทดสอบ / Test print", 26, true);
    y = rule(ctx, W, y + 4);
    y = kv(ctx, W, y, "สาขา", printable(branchName));
    y = kv(ctx, W, y, "เวลา", stamp);
    y = rule(ctx, W, y + 4);
    y = centered(ctx, W, y + 4, "ใบเสร็จรับเงิน ย้อมสี น้ำ ปู่ ผู้ ฟ้า ก็ ก่อน กิ่ง", 23);
    y = centered(ctx, W, y + 4, "สระไดร์ · ตัดผม · ทรีตเมนต์ 1,234.50", 23);
    y = centered(ctx, W, y + 4, "ABCDEFG abcdefg 0123456789", 23);
    y = rule(ctx, W, y + 4);
    y = drawQr(ctx, W, y + 6, "https://book.err-daysalon.com") + 6;
    y = centered(ctx, W, y + 4, "ถ้าอ่านได้ครบ ตัวอักษรไม่ขาด = เครื่องพร้อมใช้งาน", 20);
    return y + 24;
  });
}

// ── ESC/POS ──────────────────────────────────────────────────────────────────

/** Threshold the picture to 1 bit and wrap it in GS v 0 bands, then feed and cut. */
export function toEscPos(slip: Slip): Buffer {
  const { width, height, image } = slip;
  const bytesPerRow = Math.ceil(width / 8);
  const parts: Buffer[] = [Buffer.from([0x1b, 0x40])]; // ESC @ — reset
  const BAND = 128;
  for (let top = 0; top < height; top += BAND) {
    const rows = Math.min(BAND, height - top);
    const data = Buffer.alloc(bytesPerRow * rows);
    for (let r = 0; r < rows; r++) {
      for (let x = 0; x < width; x++) {
        const i = ((top + r) * width + x) * 4;
        const lum = image[i] * 0.299 + image[i + 1] * 0.587 + image[i + 2] * 0.114;
        if (lum < 150 && image[i + 3] > 0) data[r * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    parts.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8]), data);
  }
  parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x40])); // GS V 66 64 — feed, partial cut
  return Buffer.concat(parts);
}

const clampWidth = (w: number) => Math.min(832, Math.max(384, Math.round(w / 8) * 8)) || 576;

export async function buildJobBytes(job: { kind: string; receiptId: string | null; lang: string; branchId: string }, origin: string, widthDots = 576): Promise<Buffer> {
  const width = clampWidth(widthDots);
  if (job.kind === "TEST") {
    const b = await prisma.branch.findUnique({ where: { id: job.branchId }, select: { name: true } });
    return toEscPos(drawTest(b?.name ?? job.branchId, width));
  }
  const view = job.receiptId ? await loadPrintView(job.receiptId, job.lang === "en" ? "en" : "th", origin) : null;
  if (!view) throw new Error("ไม่พบใบเสร็จ");
  return toEscPos(drawReceipt(view, width));
}

/** For the preview/debug route: the same drawing as a PNG. */
export async function buildJobPreview(job: { kind: string; receiptId: string | null; lang: string; branchId: string }, origin: string, widthDots = 576): Promise<Buffer> {
  const width = clampWidth(widthDots);
  const slip = job.kind === "TEST"
    ? drawTest("preview", width)
    : drawReceipt((await loadPrintView(job.receiptId ?? "", job.lang === "en" ? "en" : "th", origin))!, width);
  const c = createCanvas(slip.width, slip.height);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(slip.width, slip.height);
  img.data.set(slip.image);
  ctx.putImageData(img, 0, 0);
  return c.toBuffer("image/png");
}
