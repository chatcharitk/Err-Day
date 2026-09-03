import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { receiptUrl } from "@/lib/receipts";
import PrintButton from "./PrintButton";

// A receipt can be voided after issue, so never serve a cached copy.
export const dynamic = "force-dynamic";

/** Satang → "1,200.00". Thai receipts always show two decimals. */
function baht(satang: number): string {
  return (satang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "18/08/2569 14:32" — Bangkok clock, Buddhist-era year. Server runs in UTC. */
function fmtDateTime(d: Date): string {
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(bkk.getUTCDate())}/${pad(bkk.getUTCMonth() + 1)}/${bkk.getUTCFullYear() + 543}`
       + ` ${pad(bkk.getUTCHours())}:${pad(bkk.getUTCMinutes())}`;
}

/** "00000" is the head office; anything else is a numbered branch. */
function branchLabel(code: string | null): string | null {
  if (!code) return null;
  return /^0*$/.test(code) ? "สำนักงานใหญ่" : `สาขาที่ ${code}`;
}

/**
 * Sized for 80 mm thermal paper: 72 mm of content inside the printer's own
 * ~4 mm margins. `@page size: 80mm auto` lets the roll cut to content length
 * instead of paginating onto A4.
 */
const CSS = `
  @page { size: 80mm auto; margin: 0; }

  .receipt-screen {
    background: #EFEAE6;
    min-height: 100vh;
    padding: 16px 8px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .receipt {
    width: 72mm;
    background: #fff;
    color: #000;
    padding: 4mm 2mm;
    font-size: 11px;
    line-height: 1.45;
    box-sizing: border-box;
  }
  .receipt * { box-sizing: border-box; }

  .r-center { text-align: center; }
  .r-strong { font-weight: 600; }
  .r-title { font-size: 13px; font-weight: 600; margin: 2mm 0 1mm; text-align: center; }
  .r-muted { font-size: 10px; }
  .r-rule { border-top: 1px dashed #000; margin: 2mm 0; }

  .r-kv { display: flex; justify-content: space-between; gap: 6px; }
  .r-kv > span:last-child { text-align: right; }

  .r-line { margin: 1.2mm 0; }
  .r-line-desc { word-break: break-word; }
  .r-line-calc { display: flex; justify-content: space-between; gap: 6px; padding-left: 3mm; }
  .r-line-calc .r-qty { color: #333; }

  .r-total { font-size: 13px; font-weight: 600; }

  .r-qr { display: flex; justify-content: center; margin: 2mm 0 1mm; }
  .r-qr svg { width: 26mm; height: 26mm; display: block; }

  .r-void {
    border: 2px solid #000;
    text-align: center;
    font-weight: 600;
    padding: 1.5mm;
    margin-bottom: 2mm;
    letter-spacing: 1px;
  }

  .receipt-actions { display: flex; gap: 8px; }
  .receipt-btn {
    font: inherit; font-size: 13px;
    padding: 10px 18px; border-radius: 999px;
    border: 1px solid #C9BCB2; background: #fff; color: #3B2A24;
    cursor: pointer;
  }
  .receipt-btn-primary { background: #8B1D24; border-color: #8B1D24; color: #fff; }

  @media print {
    html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
    .receipt-screen { background: #fff; padding: 0; display: block; min-height: 0; }
    .receipt { width: auto; padding: 0 2mm; }
    .no-print { display: none !important; }
    /* Keep the void frame visible — printers drop backgrounds by default. */
    .r-void { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [receipt, company] = await Promise.all([
    prisma.receipt.findUnique({
      where: { publicToken: token },
      include: {
        items:   { orderBy: { sortOrder: "asc" } },
        branch:  { select: { name: true } },
        booking: { select: { customer: { select: { name: true } } } },
      },
    }),
    // Footer only. Everything with legal or monetary weight comes from the
    // receipt's own snapshot, never from current settings.
    prisma.companyProfile.findUnique({
      where:  { id: "company" },
      select: { receiptFooterTh: true },
    }),
  ]);
  if (!receipt) notFound();

  // The QR has to be absolute to scan, so derive the origin from the actual
  // request rather than trusting NEXT_PUBLIC_APP_URL to be set everywhere.
  const h        = await headers();
  const host     = h.get("x-forwarded-host") ?? h.get("host");
  const proto    = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin   = host ? `${proto}://${host}` : undefined;

  const url   = receiptUrl(receipt.publicToken, origin);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  const isTaxInvoice = receipt.vatRegistered && receipt.docType === "ABB_TAX_INVOICE";
  const subtotal     = receipt.items.reduce((s, i) => s + i.totalSatang, 0);
  const branchText   = branchLabel(receipt.sellerBranchCode);
  const customerName = receipt.buyerName ?? receipt.booking?.customer?.name ?? null;

  return (
    <>
      <style>{CSS}</style>
      <div className="receipt-screen">
        <div className="receipt">
          {receipt.voidedAt && (
            <div className="r-void">
              ยกเลิกแล้ว / VOID
              {receipt.voidReason ? <div className="r-muted">{receipt.voidReason}</div> : null}
            </div>
          )}

          {/* ── Seller (snapshot taken when the receipt was issued) ── */}
          <div className="r-center">
            <div className="r-strong">{receipt.sellerName || receipt.branch.name}</div>
            {receipt.sellerAddress && (
              <div className="r-muted" style={{ whiteSpace: "pre-line" }}>{receipt.sellerAddress}</div>
            )}
            {receipt.sellerTaxId && (
              <div className="r-muted">เลขประจำตัวผู้เสียภาษี {receipt.sellerTaxId}</div>
            )}
            {branchText && <div className="r-muted">{branchText}</div>}
            {receipt.sellerPhone && <div className="r-muted">โทร. {receipt.sellerPhone}</div>}
          </div>

          <div className="r-title">
            {isTaxInvoice ? "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ" : "ใบเสร็จรับเงิน"}
          </div>

          <div className="r-rule" />

          <div className="r-kv"><span>เลขที่</span><span className="r-strong">{receipt.number}</span></div>
          <div className="r-kv"><span>วันที่</span><span>{fmtDateTime(receipt.issuedAt)}</span></div>
          <div className="r-kv"><span>สาขา</span><span>{receipt.branch.name}</span></div>
          {customerName && <div className="r-kv"><span>ลูกค้า</span><span>{customerName}</span></div>}
          {receipt.issuedByName && (
            <div className="r-kv"><span>ผู้รับเงิน</span><span>{receipt.issuedByName}</span></div>
          )}

          <div className="r-rule" />

          {/* ── Line items: description on its own line so long Thai names wrap
                 cleanly, with qty × unit price and the amount underneath. ── */}
          {receipt.items.map((item) => (
            <div className="r-line" key={item.id}>
              <div className="r-line-desc">{item.description}</div>
              <div className="r-line-calc">
                <span className="r-qty">{item.quantity} x {baht(item.unitPriceSatang)}</span>
                <span>{baht(item.totalSatang)}</span>
              </div>
            </div>
          ))}

          <div className="r-rule" />

          {/* Subtotal is only worth printing when it differs from the total — it
              can't today, but a future service charge would make it meaningful. */}
          {subtotal !== receipt.grossSatang && (
            <div className="r-kv"><span>รวมย่อย</span><span>{baht(subtotal)}</span></div>
          )}

          {isTaxInvoice ? (
            <>
              <div className="r-kv"><span>มูลค่าก่อนภาษี</span><span>{baht(receipt.netSatang)}</span></div>
              <div className="r-kv">
                <span>ภาษีมูลค่าเพิ่ม {receipt.vatRatePercent}%</span>
                <span>{baht(receipt.vatSatang)}</span>
              </div>
              <div className="r-kv r-total"><span>รวมทั้งสิ้น</span><span>{baht(receipt.grossSatang)}</span></div>
            </>
          ) : (
            <div className="r-kv r-total"><span>รวมทั้งสิ้น</span><span>{baht(receipt.grossSatang)}</span></div>
          )}

          {receipt.paymentMethod && (
            <div className="r-kv" style={{ marginTop: "1mm" }}>
              <span>ชำระโดย</span><span>{receipt.paymentMethod}</span>
            </div>
          )}

          <div className="r-rule" />

          {/* QR back to this same page — how the paper slip hands over the
              electronic copy, since receipts aren't pushed over LINE. */}
          <div className="r-qr" data-receipt-url={url} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="r-center r-muted">สแกนเพื่อดูใบเสร็จอิเล็กทรอนิกส์</div>

          {isTaxInvoice && (
            <div className="r-center r-muted" style={{ marginTop: "1mm" }}>
              เอกสารออกเป็นชุด
            </div>
          )}

          {company?.receiptFooterTh && (
            <div className="r-center r-muted" style={{ marginTop: "2mm", whiteSpace: "pre-line" }}>
              {company.receiptFooterTh}
            </div>
          )}

          <div className="r-center" style={{ marginTop: "2mm" }}>ขอบคุณที่ใช้บริการ</div>
        </div>

        <PrintButton url={url} />
      </div>
    </>
  );
}
