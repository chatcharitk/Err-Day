/**
 * Issue a 50 ทวิ withholding-tax certificate for a recorded expense, with a
 * running number (เล่มที่ / เลขที่) from the WithholdingCertificate table.
 *
 *   npx tsx scripts/gen-50tawi.ts --expense <expenseId> [--paid YYYY-MM-DD] [--out outputs] [--attach]
 *
 * - เลขที่ is the Thai-year short + 3-digit running number: 69001, 69002 … (restarts each year);
 *   เล่มที่ advances every 50 certificates. runNo is stored as the whole number (69001).
 * - --attach also uploads the PDF and attaches it to the expense (needs BLOB_READ_WRITE_TOKEN).
 * - Re-running for the same expense keeps its number (re-print / add the payment date).
 * - Income = bill before VAT, tax = the expense's withholding amount.
 * Needs python3 + pypdf and Google Chrome (see scripts/withholding/build50.py).
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";

const BOOK_SIZE = 50;
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiShort = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y + 543}`; };
const money = (satang: number) => ({ baht: Math.floor(satang / 100).toLocaleString("en-US"), satang: String(satang % 100).padStart(2, "0") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const { thaiBahtText } = await import("../src/lib/thai-baht-text");
  const expenseId = arg("expense");
  if (!expenseId) throw new Error("usage: --expense <id> [--paid YYYY-MM-DD] [--out dir]");

  const e = await prisma.expense.findUnique({ where: { id: expenseId }, include: { vendorRef: true } });
  if (!e) throw new Error("expense not found");
  if (e.withholdingAmount <= 0) throw new Error("this expense has no withholding tax");
  const v = e.vendorRef;
  if (!v?.taxId) throw new Error("payee has no tax ID");
  const company = await prisma.companyProfile.findFirst();
  if (!company?.taxId) throw new Error("company profile missing");

  const income = e.totalAmount - (e.vatAmount ?? 0);
  const paidYmd = arg("paid") ?? (e.paidAt ? new Date(e.paidAt.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : null);
  const paidDate = paidYmd ? new Date(paidYmd + "T12:00:00Z") : null;

  // Number: keep the existing one for this expense, else the next in sequence.
  let cert = await prisma.withholdingCertificate.findUnique({ where: { expenseId } });
  if (cert) {
    cert = await prisma.withholdingCertificate.update({
      where: { id: cert.id },
      data: { paidDate, incomeSatang: income, taxSatang: e.withholdingAmount, payeeName: v.legalName || v.name, payeeTaxId: v.taxId },
    });
  } else {
    // Thai (BE) year, last two digits, of the day it is issued (Bangkok).
    const yy = (new Date(Date.now() + 7 * 3600_000).getUTCFullYear() + 543) % 100;
    for (let attempt = 0; attempt < 5 && !cert; attempt++) {
      const last = await prisma.withholdingCertificate.findFirst({ where: { runNo: { gte: yy * 1000, lt: yy * 1000 + 1000 } }, orderBy: { runNo: "desc" } });
      const seq = last ? (last.runNo % 1000) + 1 : 1;
      if (seq > 999) throw new Error("more than 999 certificates this year");
      const runNo = yy * 1000 + seq;
      const bookNo = Math.floor((seq - 1) / BOOK_SIZE) + 1;
      try {
        cert = await prisma.withholdingCertificate.create({ data: {
          bookNo, runNo, expenseId, vendorId: v.id, payeeName: v.legalName || v.name, payeeTaxId: v.taxId,
          paidDate, incomeSatang: income, taxSatang: e.withholdingAmount, createdBy: "gen-50tawi",
        } });
      } catch (err) {
        if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err; // number taken by a parallel run → retry
      }
    }
    if (!cert) throw new Error("could not allocate a certificate number");
  }

  const safe = (v.name || "payee").replace(/[^\p{L}\p{M}\p{N}]+/gu, "-");
  const outDir = resolve(arg("out") ?? "outputs");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `50tawi-${safe}-${cert.runNo}.pdf`);
  const paid = money(income), tax = money(e.withholdingAmount);
  const job = {
    payer: { name: company.legalName, tax: company.taxId, addr: (company.addressLine ?? "").replace("บางนา-ตลาด", "บางนา-ตราด") },
    payee: { name: v.legalName || v.name, tax: v.taxId, addr: v.address ?? "" },
    payDate: paidYmd ? thaiShort(paidYmd) : "",
    paidBaht: paid.baht, paidSatang: paid.satang, taxBaht: tax.baht, taxSatang: tax.satang,
    words: thaiBahtText(e.withholdingAmount),
    bookNo: cert.bookNo, runNo: String(cert.runNo), out,
  };
  const jobFile = join(tmpdir(), `50tawi-${cert.id}.json`);
  writeFileSync(jobFile, JSON.stringify(job));
  execFileSync("python3", [join(__dirname, "withholding", "build50.py"), jobFile], { stdio: "inherit" });
  if (process.argv.includes("--attach")) {
    const { storeImage } = await import("../src/lib/upload");
    const filename = `50 ทวิ เล่มที่ ${cert.bookNo} เลขที่ ${cert.runNo} (${v.name}).pdf`;
    const url = await storeImage(`receipt/50tawi-${cert.runNo}/${Date.now()}.pdf`, readFileSync(out), "application/pdf");
    // One 50 ทวิ per expense: replace an earlier one (e.g. re-issued with a payment date).
    await prisma.expenseAttachment.deleteMany({ where: { expenseId, filename: { startsWith: "50 ทวิ" } } });
    await prisma.expenseAttachment.create({ data: { expenseId, url, filename, fileType: "application/pdf" } });
    console.log("แนบกับรายจ่ายแล้ว:", filename);
  }
  console.log(`เล่มที่ ${cert.bookNo} เลขที่ ${job.runNo} · ${job.payee.name} · จ่าย ${job.payDate || "(ว่าง)"} · ภาษี ฿${(e.withholdingAmount / 100).toLocaleString()} (${job.words})`);
  process.exit(0);
})().catch(e => { console.error(String(e?.message ?? e)); process.exit(1); });
