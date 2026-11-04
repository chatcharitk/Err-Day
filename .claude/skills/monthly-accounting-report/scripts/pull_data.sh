#!/usr/bin/env bash
# Pull the month's data from the production database into TSV files (READ-ONLY queries).
# Usage:  ACCT_MONTH=2026-11 bash pull_data.sh
set -euo pipefail
: "${ACCT_MONTH:?set ACCT_MONTH=YYYY-MM}"
HERE="$(cd "$(dirname "$0")" && pwd)"
D="${ACCT_DATA:-/tmp/err-day-accounting/$ACCT_MONTH}"; mkdir -p "$D"
FIRST="$ACCT_MONTH-01"
NEXT="$(python3 -c "import datetime as d;y,m=map(int,'$ACCT_MONTH'.split('-'));print(d.date(y+(m==12),m%12+1,1))")"
cd "/Users/chatcharit/Err Day App/errday-booking"
set -a; source .env; set +a
U="${DIRECT_URL:-$DATABASE_URL}"
Q() { psql "$U" -X -q -t -A -F $'\t' -c "SET default_transaction_read_only=on;" -c "$1" 2>&1 | grep -v '^SET$' || true; }

# 1) sales, one row per paid booking (paidAt shown in Bangkok time = +7h)
Q "select to_char(b.\"paidAt\"+interval '7 hours','YYYY-MM-DD') pd, to_char(b.\"paidAt\"+interval '7 hours','HH24:MI') pt, to_char(b.date,'YYYY-MM-DD') sd, br.name, coalesce(nullif(s.\"nameTh\",''),s.name) svc, s.category, b.\"totalPrice\", b.\"tipSatang\", b.status, coalesce(r.number,''), coalesce(r.\"paymentMethod\",''), coalesce(r.\"grossSatang\",-1), coalesce(r.\"netSatang\",-1), coalesce(r.\"vatSatang\",-1), coalesce(r.\"docType\",''), b.id from \"Booking\" b join \"Branch\" br on br.id=b.\"branchId\" join \"Service\" s on s.id=b.\"serviceId\" left join lateral (select * from \"Receipt\" x where x.\"bookingId\"=b.id and x.\"voidedAt\" is null order by x.sequence desc limit 1) r on true where b.\"paidAt\"+interval '7 hours'>='$FIRST' and b.\"paidAt\"+interval '7 hours'<'$NEXT' order by b.\"paidAt\", b.id" > "$D/revenue.tsv"
# 2) receipt lines
Q "select r.number, b.id, i.description, i.quantity, i.\"totalSatang\", i.\"sortOrder\" from \"ReceiptItem\" i join \"Receipt\" r on r.id=i.\"receiptId\" and r.\"voidedAt\" is null join \"Booking\" b on b.id=r.\"bookingId\" where b.\"paidAt\"+interval '7 hours'>='$FIRST' and b.\"paidAt\"+interval '7 hours'<'$NEXT' order by r.sequence, i.\"sortOrder\"" > "$D/lines.tsv"
# 3) expenses (all statuses; Expense.date is UTC noon of the Bangkok day)
Q "select e.id, to_char(e.date,'YYYY-MM-DD'), coalesce(b.name,'ส่วนกลาง'), coalesce(e.vendor,''), coalesce(v.\"legalName\",''), coalesce(v.\"taxId\",''), coalesce(v.type,''), e.category, e.\"totalAmount\", e.\"discountAmount\", e.\"vatMode\", coalesce(e.\"vatAmount\",-1), e.\"withholdingAmount\", coalesce(e.\"paymentMethod\",''), e.status, coalesce(e.\"invoiceNumber\",''), coalesce(to_char(e.\"documentDate\",'YYYY-MM-DD'),''), coalesce(to_char(e.\"paidAt\"+interval '7 hours','YYYY-MM-DD'),''), (select count(*) from \"ExpenseAttachment\" a where a.\"expenseId\"=e.id) + (case when e.\"receiptUrl\" is not null then 1 else 0 end), coalesce(e.\"sourceKey\",''), coalesce(translate(e.notes, chr(10)||chr(9)||chr(13), '   '),''), coalesce((select string_agg(translate(it.description, chr(10)||chr(9), '  '),' | ' order by it.id) from \"ExpenseItem\" it where it.\"expenseId\"=e.id),'') from \"Expense\" e left join \"Branch\" b on b.id=e.\"branchId\" left join \"Vendor\" v on v.id=e.\"vendorId\" where e.date>='$FIRST' and e.date<'$NEXT' order by e.date, e.\"createdAt\"" > "$D/expenses.tsv"
# 4) withholding certificates (expense id -> running number)
Q "select c.\"expenseId\", c.\"runNo\" from \"WithholdingCertificate\" c" | grep . > "$D/certs.tsv" || true
# 5) evidence files attached to confirmed expenses (expense id, attachment id, url, filename, mime)
Q "select e.id, a.id, a.url, coalesce(a.filename,''), coalesce(a.\"fileType\",'') from \"ExpenseAttachment\" a join \"Expense\" e on e.id=a.\"expenseId\" where e.status='CONFIRMED' and e.date>='$FIRST' and e.date<'$NEXT' union all select e.id, 'receiptUrl', e.\"receiptUrl\", '', '' from \"Expense\" e where e.\"receiptUrl\" is not null and e.status='CONFIRMED' and e.date>='$FIRST' and e.date<'$NEXT'" > "$D/att.tsv"
# 6) staff pay (salary / daily compensation / freelance) + line items; category 'other' paid to a staff vendor is added by hand if found (see SKILL.md)
Q "select e.id, to_char(e.date,'YYYY-MM-DD'), coalesce(br.name,''), e.category, coalesce(e.vendor,''), coalesce(v.\"legalName\",''), coalesce(s.name,''), e.\"totalAmount\", coalesce(to_char(e.\"paidAt\"+interval '7 hours','YYYY-MM-DD'),''), coalesce(e.\"paymentMethod\",''), coalesce(translate(e.notes,chr(9)||chr(10),'  '),'') from \"Expense\" e left join \"Branch\" br on br.id=e.\"branchId\" left join \"Vendor\" v on v.id=e.\"vendorId\" left join \"Staff\" s on s.id=v.\"staffId\" where e.status='CONFIRMED' and e.date>='$FIRST' and e.date<'$NEXT' and (e.category in ('salary','commission_bonus','freelance') or (e.category='other' and s.id is not null)) order by e.date, e.\"createdAt\"" > "$D/pay.tsv"
Q "select it.\"expenseId\", coalesce(it.kind,''), translate(it.description,chr(9)||chr(10),'  '), it.\"totalPrice\" from \"ExpenseItem\" it join \"Expense\" e on e.id=it.\"expenseId\" left join \"Vendor\" v on v.id=e.\"vendorId\" where e.status='CONFIRMED' and e.date>='$FIRST' and e.date<'$NEXT' and (e.category in ('salary','commission_bonus','freelance') or (e.category='other' and v.\"staffId\" is not null))" > "$D/payitems.tsv"
wc -l "$D"/*.tsv
