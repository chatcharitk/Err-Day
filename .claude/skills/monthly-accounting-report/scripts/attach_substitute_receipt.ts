/**
 * Attach a substitute-receipt PDF (ใบรับรองแทนใบเสร็จรับเงิน) to the expenses it covers
 * and write the number into their notes + a FinanceAudit row each. Dry-run by default.
 *
 *   cd errday-booking
 *   npx tsx --env-file=.env.local .claude/skills/monthly-accounting-report/scripts/attach_substitute_receipt.ts \
 *        --pdf "/path/ใบรับรองแทนใบเสร็จ พ.ย. 2569 (SR-6911-001).pdf" --no SR-6911-001 --date 30/11/2569 \
 *        --ids id1,id2,id3 [--apply]
 *
 * Re-running with a corrected PDF replaces the file on rows that already have it (same filename),
 * so it is safe to repeat after the owner edits the form.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes("--apply");

async function main() {
  const pdfPath = arg("pdf"), no = arg("no"), date = arg("date"), ids = (arg("ids") ?? "").split(",").filter(Boolean);
  if (!pdfPath || !no || !date || !ids.length) throw new Error("need --pdf --no --date --ids");
  const { prisma } = await import("../../../../src/lib/prisma");
  const { storeImage } = await import("../../../../src/lib/upload");
  const FN = `ใบรับรองแทนใบเสร็จ ${no}.pdf`;
  const NOTE = `ใบรับรองแทนใบเสร็จรับเงิน เลขที่ ${no} (${date})`;
  const rows = await prisma.expense.findMany({ where: { id: { in: ids } }, include: { attachments: true } });
  if (rows.length !== ids.length) throw new Error(`found ${rows.length} of ${ids.length} expenses`);
  for (const e of rows) console.log(APPLY ? "UPDATE" : "dry-run", e.id, e.date.toISOString().slice(0, 10), e.vendor, e.totalAmount / 100, e.attachments.some(a => a.filename === FN) ? "(has file)" : "");
  if (!APPLY) { console.log("add --apply to write"); return; }
  const url = await storeImage(`receipt/substitute-${no}/${Date.now()}.pdf`, readFileSync(pdfPath), "application/pdf");
  const replaced = await prisma.expenseAttachment.updateMany({ where: { filename: FN }, data: { url } });
  let added = 0;
  for (const e of rows) {
    if (e.attachments.some(a => a.filename === FN)) continue;
    const notes = e.notes?.includes(no) ? e.notes : e.notes ? `${e.notes} · ${NOTE}` : NOTE;
    await prisma.expenseAttachment.create({ data: { expenseId: e.id, url, filename: FN, fileType: "application/pdf" } });
    await prisma.expense.update({ where: { id: e.id }, data: { notes } });
    await prisma.financeAudit.create({ data: { entity: "EXPENSE", recordId: e.id, action: "UPDATE", actor: "claude-script",
      before: { notes: e.notes }, after: { notes, attachment: FN, reason: `แนบใบรับรองแทนใบเสร็จ ${no}` } } });
    added++;
  }
  console.log({ url, replacedExisting: replaced.count, added });
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
