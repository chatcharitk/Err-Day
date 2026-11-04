---
name: monthly-accounting-report
description: Build the month-end accounting package for err.day (บริษัท ออลกู๊ดเดย์ จำกัด) — sales report, expense report with all evidence merged into one PDF, payroll report, plus the substitute receipt (ใบรับรองแทนใบเสร็จรับเงิน) and 50 ทวิ cross-check. Use when the owner asks for "รายงานรายรับรายจ่าย", "ส่งบัญชี", "ใบรับรองแทนใบเสร็จ", "รายงานเงินเดือน" for a month, or "ทำเหมือนเดือนที่แล้ว".
---

# Monthly accounting package (err.day)

Reproduces what was delivered for **October 2026** (reference numbers at the bottom). The owner writes Thai and
wants short, plain answers. Run everything from `errday-booking/`; scripts live in this skill's `scripts/`.
Python needs `openpyxl pypdf reportlab pillow` (user site-packages — **don't use `python3 -I`**) and LibreOffice
(`/Applications/LibreOffice.app`) for PDFs. `export ACCT_MONTH=YYYY-MM` before every script.

Month-specific values are only in `scripts/config.py` (VAT start 13 Oct 2026, paths) and optional text files in
the data folder (`/tmp/err-day-accounting/<month>/`, override with `ACCT_DATA`): `notes.txt`, `extra_wht.json`,
`wht_notes.txt`, `payroll_notes.txt` — copy the `examples/*-2026-10.*` files as a starting point and rewrite them.
Output goes to `outputs/ส่งบัญชี <เดือน> <พ.ศ.>/` (override `ACCT_OUT` when testing).

## Workflow

**1. Clean the data first (production DB, local `.env` IS production — read-only unless told).**
Ask/check before building: all bills of the month entered; categories right (laundry → `laundry`, one vendor
"ซักให้ Wash & Dry"); duplicates voided (**never delete VOIDED rows** — set status + FinanceAudit row, see
`attach_substitute_receipt.ts` for the audit shape); staff pay filed under `other` (found by vendor→staff link; the
pull script includes it in payroll); vendors with missing tax ID/address; VAT bills with no tax invoice.
Salary rows are dated month-end (`เงินเดือน <เดือน> YYYY`), `paidAt` often null — that's normal.

**2. Selection workbook for the owner.** `bash scripts/pull_data.sh` → `python3 scripts/build_workbook.py`.
Sheets: สรุป, เลือกรายจ่าย (col B ส่ง/ไม่ส่ง dropdown, col X = system id), รายรับ, รายการในใบเสร็จ, รายวัน,
ชำระแล้วแต่ยกเลิก, รายจ่ายที่ยกเลิก. Send it with SendUserFile (new file name each time — never overwrite one
the owner may be editing). Owner edits column B and sends it back; copy it to `<data>/picked.xlsx`.
If it comes back unchanged, everything is "ส่ง" — say so. Rows set to "ไม่ส่ง" are excluded by the clean reports.

**3. Substitute receipt (only when needed).** For expenses with no receipt *and* no slip, or slip-only from a
non-VAT payee. **Not** for VAT-registered companies with only a transfer slip or invoice (I plus Q, Pemco, ซัมมารี่…):
ask the supplier for a tax invoice instead — a substitute receipt can't support input VAT. Number `SR-YYMM-NNN`
(พ.ศ. year, month), dated the last day of the month. Combine repeated small items of one payee into one row
(e.g. laundry 9 visits → one line). Payer ศิรัญญา แซ่โค้ว; approver ชัชฤทธิ์ เกียรติศักดิ์ศรี (another director
approves, so payer ≠ approver); position left blank unless told; footnote "เอกสารตัวอย่าง…" is in the form —
ask whether to remove it for the real document. Make a spec like `examples/substitute-receipt-spec-2026-10.json`,
run `python3 scripts/substitute_receipt.py spec.json` (xlsx + 1-page PDF; check the PNG preview — LibreOffice
can't do BAHTTEXT so filled forms use static Thai words). Then attach it to the covered expenses:
`npx tsx --env-file=.env.local .claude/skills/monthly-accounting-report/scripts/attach_substitute_receipt.ts --pdf … --no SR-… --date d/m/yyyy --ids a,b,c` (dry-run first, then `--apply`; safe to re-run with an edited PDF).
Signature PNGs are in `scripts/withholding/private/` (gitignored): `signed:true` places them.

**4. 50 ทวิ.** Certificates come from `scripts/gen-50tawi.ts` (flags `--nosig`, `--blank-taxid`, `--attach`; see
memory `errday-50tawi-and-expense-entry`). Signed copies must be in `errday-booking/outputs/50 ทวิ <เดือน> (เซ็นแล้ว)/`
named `…-<runNo>.pdf` — `expense.py` appends them to the evidence book. A certificate issued this month for next
month's bill (e.g. Anacade rent) goes in `extra_wht.json` / `wht_notes.txt`, not in the totals. If the owner asks
for payee details: name, tax ID, address, phone come from the `Vendor` rows linked to `WithholdingCertificate`.

**5. Clean package** (needs `picked.xlsx`):
```
ACCT_MONTH=2026-11 python3 scripts/fetch_evidence.py     # downloads att.tsv files to <data>/dl
ACCT_MONTH=2026-11 python3 scripts/income.py             # 1 รายงานรายรับ
ACCT_MONTH=2026-11 python3 scripts/expense.py            # 2 รายงานรายจ่าย + 2 หลักฐานรายจ่าย (รวมเล่ม).pdf + folder
ACCT_MONTH=2026-11 python3 scripts/payroll.py            # 3 รายงานเงินเดือน
```
Contents: income → summary by branch/doc type/payment/service, daily, tips, output-VAT daily summary of abbreviated
tax invoices, pre-VAT receipts, per-bill detail, cancelled-but-paid bills. Expense → E001… reference numbers shared
with the evidence book (header on every page: E-number · date · amount), input-VAT sheet (✓ only when a real tax
invoice exists; otherwise the reason), WHT sheet (ภ.ง.ด.53), one sheet per substitute receipt. Payroll → per person
split into salary/OT/commission/tip/travel/other, **วิธีจ่าย: โอน for everyone except นาง Bouavanh Xayyakheam
(เงินสด)**; no paid-date columns; social-security and PND1 columns left blank for the accountants.
Render each xlsx to PDF/PNG (`soffice --convert-to pdf`, `qlmanage -t -s 1400`) and look at it. Then
`zip -qr -X "ส่งบัญชี <เดือน>.zip" "ส่งบัญชี <เดือน>"`. The zip is ~80 MB: **SendUserFile rejects >30 MB for the
phone** — send the 3 xlsx and the evidence PDF (~30 MB, may also be near the limit) individually and say the zip is
only on the desktop.

**6. Check before saying done.** Totals tie out (income = Σ receipts + tips separately; expense total = selection
workbook "ส่ง" total; payroll total = salary+commission+freelance+staff `other` rows in the expense report); every
"ส่ง" row has either an E-numbered evidence page, an SR reference, or is payroll; the summary sheet's
"ตรวจสอบยอด" cells all say ตรงกัน.

## Conventions that bite
- Money is satang in the DB; reports are baht. Receipts are VAT-inclusive; VAT registered **13 Oct 2026**
  (doc types `RECEIPT` before, `ABB_TAX_INVOICE` after). Tips count as income from 1 Oct 2026, shown separately.
- Revenue = receipt gross by **paid date (Bangkok = +7 h)**; expenses = date recorded (UTC noon of the Thai day).
  A bill dated 31 Oct belongs to October even if entered later (and then the October package must be re-made).
- Expense discount: record the **invoice** values so VAT matches the tax invoice (Buzzebees INV-NLP-202610543:
  ฿1,632 incl. VAT ฿106.77; platform/coin discount ฿478 goes in notes, not in the discount field).
- Anacade rent invoices tell us to pay rent into บริษัท สาธุกิจออโตโมบิล จำกัด's account — WHT payee may need to be
  that company. WHT: rent 5% (common area 3%), decoration/services 3%; certificate income = amount − VAT.
- One bill can be several ฿190 laundry slips — don't call rows duplicates without comparing slip numbers.
- Use `python3` without `-I`; temp scripts are `scripts/_tmp-*.ts` run with `npx tsx --env-file=.env.local`
  (R2 keys only exist in `.env.local`; `DATABASE_URL` in `.env`) and deleted afterwards.
- Don't commit/deploy anything unless asked; this skill folder is untracked until the owner says to commit.

## Reference numbers — October 2026 (to sanity-check the method)
Sales 1,162 bills · ฿459,155.50 (บางนา 239,735.50 / สุขุมวิท 219,420.00) · output VAT ฿18,893.83 · tips ฿780 ·
4 paid-but-cancelled bills. Expenses (all 199 "ส่ง") ฿988,095.32 → decoration ฿698,038.45, salary ฿99,968.83, rent
฿60,523.53, commission/OT ฿56,961.94, hair products ฿40,802.32; WHT ฿17,397.20 (6 certificates 691001–691006).
Payroll 6 people ฿158,027.44 (พร 51,761.00 · วัน 23,795.82 · เบญ 33,034.68 · ตั้ก 19,240.49 · เอิร์น 19,246.70 ·
นาว 10,948.75). Substitute receipt SR-6910-001 = ฿13,878 (12 expense rows, 4 lines). Evidence book 81 pages.
