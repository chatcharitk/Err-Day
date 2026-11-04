import collections, os
from common import *

src = load_workbook(PICKED)
R = []
for r in src["รายรับ"].iter_rows(min_row=5, values_only=True):
    if not isinstance(r[0], datetime.datetime): continue
    d, t, br, no, typ, svc, gross, net, vat, tip, _, pm = r[:12]
    R.append(dict(d=d, t=t, br=br, no=no or "", typ=typ, svc=svc, gross=gross or 0, net=net or 0, vat=vat or 0, tip=tip or 0, pm=pm))
LINES = [r for r in src["รายการในใบเสร็จ"].iter_rows(min_row=5, values_only=True) if r[0] and isinstance(r[1], datetime.datetime)]
CANC = [r for r in src["ชำระแล้วแต่ยกเลิก"].iter_rows(min_row=5, values_only=True) if r[0] and r[0] != "รวม" and not isinstance(r[0], str)]

ABB, RCP = "ใบกำกับภาษีอย่างย่อ", "ใบเสร็จรับเงิน (ก่อนจด VAT)"
wb = Workbook()

# ── 1. summary
ws = wb.active; ws.title = "สรุปรายรับ"
r = title(ws, "รายงานรายรับ")
r = section(ws, r, "1. รายรับแยกตามสาขา")
rows = []
for b in ("บางนา", "สุขุมวิท"):
    x = [y for y in R if y["br"] == b]
    rows.append([f"สาขา{b}", len(x), sum(y["gross"] for y in x), sum(y["net"] for y in x), sum(y["vat"] for y in x), sum(y["tip"] for y in x), f"=C{r+1+len(rows)}+F{r+1+len(rows)}"])
r = table(ws, r, ["สาขา", "จำนวนบิล", "ค่าบริการตามใบเสร็จ\n(รวม VAT)", "มูลค่าก่อน VAT", "ภาษีขาย (VAT)", "ทิป", "รวมรับทั้งสิ้น"],
          rows, money=(3, 4, 5, 6, 7), ints=(2,), total=[2, 3, 4, 5, 6, 7], widths=[34, 12, 20, 18, 16, 12, 18])
r += 1
r = section(ws, r, "2. รายรับแยกตามประเภทเอกสาร (ภาษีขาย)")
rows = []
for lab, typ in (("ใบเสร็จรับเงิน (ก่อนจดทะเบียน VAT)", RCP), ("ใบกำกับภาษีอย่างย่อ (VAT 7% รวมในราคา)", ABB)):
    x = [y for y in R if y["typ"] == typ]
    rows.append([lab, len(x), sum(y["gross"] for y in x), sum(y["net"] for y in x), sum(y["vat"] for y in x)])
z = [y for y in R if y["typ"] not in (ABB, RCP)]
rows.append(["บิล ฿0 (ใช้สิทธิ์แพ็กเกจ/สมาชิก ไม่ออกเอกสาร)", len(z), 0, 0, 0])
r = table(ws, r, ["ประเภทเอกสาร", "จำนวนบิล", "ยอดรวม VAT", "มูลค่าก่อน VAT", "ภาษีขาย (VAT)"], rows, money=(3, 4, 5), ints=(2,), total=[2, 3, 4, 5])
r += 1
r = section(ws, r, "3. รายรับแยกตามวิธีชำระ")
pm = collections.defaultdict(lambda: [0, 0])
for y in R: pm[y["pm"] or "ไม่ระบุ"][0] += 1; pm[y["pm"] or "ไม่ระบุ"][1] += y["gross"]
r = table(ws, r, ["วิธีชำระ", "จำนวนบิล", "ค่าบริการ"], [[k, v[0], v[1]] for k, v in sorted(pm.items(), key=lambda kv: -kv[1][1])], money=(3,), ints=(2,), total=[2, 3])
r += 1
r = section(ws, r, "4. รายรับแยกตามประเภทบริการ / สินค้า (ตามรายการในใบเสร็จ)")
g = collections.defaultdict(lambda: [0, 0])
for l in LINES:
    if l[3] != "เสร็จสิ้น": continue
    g[l[5]][0] += l[6] or 0; g[l[5]][1] += l[7] or 0
r = table(ws, r, ["ประเภท", "จำนวน (หน่วย)", "จำนวนเงิน"], [[k, v[0], v[1]] for k, v in sorted(g.items(), key=lambda kv: -kv[1][1])], money=(3,), ints=(2,), total=[2, 3])
r += 1
r = section(ws, r, "หมายเหตุ")
for t in [
    "• รายรับยึดวันที่รับชำระเงิน · ค่าบริการ = ยอดตามใบเสร็จ/ใบกำกับภาษีอย่างย่อที่ออกให้ลูกค้า",
    "• บริษัทจดทะเบียนภาษีมูลค่าเพิ่ม มีผลตั้งแต่ 13 ต.ค. 2569 — บิลตั้งแต่วันนั้นราคารวม VAT 7% แล้ว (ดูชีต “รายงานภาษีขาย”)",
    "• ทิปนับเป็นรายได้ของบริษัทตั้งแต่ 1 ต.ค. 2569 แสดงแยกจากค่าบริการ และไม่อยู่ในใบกำกับภาษี (ดูชีต “ทิป”)",
    "• สมาชิก 30 วัน และแพ็กเกจ เป็นการรับเงินล่วงหน้าสำหรับบริการ (ออกใบเสร็จ ณ วันที่รับเงิน)",
    f"• มีบิลที่รับเงินแล้วแต่บิลถูกยกเลิก {len(CANC)} บิล ยังไม่นับในรายรับข้างต้น (ดูชีต “บิลยกเลิกที่รับเงินแล้ว”)",
]: r = note(ws, r, t, 7)
page(ws, False)

# ── 2. output VAT report (daily summary of abbreviated tax invoices)
def daily(typ):
    by = collections.OrderedDict()
    for y in sorted([y for y in R if y["typ"] == typ], key=lambda y: (y["d"], y["no"])):
        by.setdefault(y["d"], []).append(y)
    rows = []
    for i, (d, x) in enumerate(by.items(), 1):
        nos = sorted(y["no"] for y in x)
        rows.append([i, d, nos[0], nos[-1], len(x), sum(y["net"] for y in x), sum(y["vat"] for y in x), sum(y["gross"] for y in x)])
    return rows
ws = wb.create_sheet("รายงานภาษีขาย")
r = title(ws, "รายงานภาษีขาย (สรุปใบกำกับภาษีอย่างย่อรายวัน)", f"เดือนภาษี {LABEL} · ชื่อผู้ประกอบการ บริษัท ออลกู๊ดเดย์ จำกัด · สำนักงานใหญ่ · ผู้ซื้อ: ลูกค้าทั่วไป (ขายปลีก)")
r = table(ws, r, ["ลำดับ", "วันที่", "เลขที่ใบกำกับฯ ตั้งแต่", "ถึง", "จำนวนใบ", "มูลค่าสินค้า/บริการ", "ภาษีมูลค่าเพิ่ม", "รวม"],
          daily(ABB), money=(6, 7, 8), ints=(5,), dates=(2,), total=[5, 6, 7, 8], widths=[7, 13, 18, 18, 10, 20, 17, 17])
r = note(ws, r + 1, "เลขที่เอกสารเป็นเลขรันรวมทุกสาขา และใช้ชุดเดียวกับใบเสร็จรับเงินก่อนจด VAT — ในช่วงเลขที่ “ตั้งแต่–ถึง” ของแต่ละวันอาจมีเลขที่เป็นของบิลที่ยกเลิก/ใบเสร็จที่ถูกยกเลิก ดูรายบิลได้ที่ชีต “รายละเอียดรายบิล”", 8, height=30)
page(ws, False)

ws = wb.create_sheet("ใบเสร็จก่อนจด VAT") if any(y["typ"] == RCP for y in R) else wb.create_sheet("_tmp")
r = title(ws, f"สรุปใบเสร็จรับเงินรายวัน {LABEL} (ก่อนจดทะเบียน VAT — ไม่มีภาษีขาย)")
rows = [[a, b, c, d_, e, h] for a, b, c, d_, e, f, g_, h in daily(RCP)]
r = table(ws, r, ["ลำดับ", "วันที่", "เลขที่ใบเสร็จ ตั้งแต่", "ถึง", "จำนวนใบ", "ยอดรับ"], rows, money=(6,), ints=(5,), dates=(2,), total=[5, 6], widths=[7, 13, 18, 18, 10, 18])
page(ws, False)
if ws.title == "_tmp": wb.remove(ws)

# ── 3. daily by branch
ws = wb.create_sheet("รายวัน")
r = title(ws, "รายรับรายวันแยกสาขา (ค่าบริการตามใบเสร็จ + ทิป)")
days = sorted({y["d"] for y in R}); rows = []
for d in days:
    x = [y for y in R if y["d"] == d]
    b = sum(y["gross"] for y in x if y["br"] == "บางนา"); s = sum(y["gross"] for y in x if y["br"] == "สุขุมวิท")
    tp = sum(y["tip"] for y in x); n = len(rows) + r + 1
    rows.append([d, len(x), b, s, f"=C{n}+D{n}", tp, f"=E{n}+F{n}"])
r = table(ws, r, ["วันที่", "จำนวนบิล", "บางนา", "สุขุมวิท", "ค่าบริการรวม", "ทิป", "รวมรับ"], rows, money=(3, 4, 5, 6, 7), ints=(2,), dates=(1,), total=[2, 3, 4, 5, 6, 7], widths=[13, 11, 16, 16, 17, 12, 17])
page(ws, False)

# ── 4. tips
ws = wb.create_sheet("ทิป")
r = title(ws, "ทิปที่ลูกค้าจ่ายผ่านบิล (รายได้บริษัท — ไม่อยู่ในใบกำกับภาษี)")
rows = [[y["d"], y["t"], y["br"], y["no"], y["svc"], y["tip"]] for y in R if y["tip"]]
r = table(ws, r, ["วันที่", "เวลา", "สาขา", "เลขที่ใบเสร็จ", "บริการ", "ทิป"], rows, money=(6,), dates=(1,), total=[6], widths=[13, 8, 11, 16, 30, 12])
page(ws, False)

# ── 5. detail
ws = wb.create_sheet("รายละเอียดรายบิล")
r = title(ws, "รายละเอียดรายรับรายบิล")
rows = [[y["d"], y["t"], y["br"], y["no"], y["typ"], y["svc"], y["gross"], y["net"], y["vat"], y["tip"], y["pm"]] for y in R]
r = table(ws, r, ["วันที่ชำระ", "เวลา", "สาขา", "เลขที่เอกสาร", "ประเภทเอกสาร", "บริการหลัก", "ยอดตามใบเสร็จ", "ก่อน VAT", "VAT", "ทิป", "วิธีชำระ"],
          rows, money=(7, 8, 9, 10), dates=(1,), total=[7, 8, 9, 10], widths=[12, 7, 10, 14, 26, 26, 14, 13, 11, 9, 10])
ws.freeze_panes = "A6"; ws.auto_filter.ref = f"A5:K{r-2}"
page(ws)

ws = wb.create_sheet("บิลยกเลิกที่รับเงินแล้ว")
r = title(ws, "บิลที่รับเงินแล้วแต่ถูกยกเลิก (ยังไม่นับเป็นรายรับ)")
rows = [list(c[:8]) for c in CANC]
r = table(ws, r, ["วันที่ชำระ", "เวลา", "สาขา", "บริการ", "เลขที่ใบเสร็จ", "ประเภทเอกสาร", "ยอด", "VAT"], rows, money=(7, 8), dates=(1,), total=[7, 8], widths=[12, 7, 10, 22, 14, 26, 11, 9])
r = note(ws, r + 1, "ใบเสร็จ/ใบกำกับภาษีของบิลเหล่านี้ยังไม่ได้ยกเลิกในระบบ — ต้องตัดสินใจว่าคืนเงินลูกค้า (ยกเลิกเอกสาร) หรือนับเป็นรายรับ", 8)
page(ws, False)

os.makedirs(OUTDIR, exist_ok=True)
OUT = OUTDIR + f"1 รายงานรายรับ {SHORT}.xlsx"
wb.save(OUT)
print("saved", OUT, len(R), "bills", round(sum(y["gross"] for y in R), 2), "vat", round(sum(y["vat"] for y in R), 2), "tips", sum(y["tip"] for y in R), "cancelled", len(CANC))
