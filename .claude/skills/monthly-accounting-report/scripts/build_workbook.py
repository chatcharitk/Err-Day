import csv, re, datetime, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.workbook.properties import CalcProperties
import json, os
from config import *

S = DATA
OUT = f"{OUTROOT}รายรับ-รายจ่าย {SHORT} (สร้าง {TODAY:%d-%m-%Y}).xlsx"
rd = lambda f: list(csv.reader(open(S + f, encoding="utf-8"), delimiter="\t"))
REV, LINES, EXP = rd("revenue.tsv"), rd("lines.tsv"), rd("expenses.tsv")
D = lambda s: datetime.datetime.strptime(s, "%Y-%m-%d") if s else None
B = lambda s: s.replace("err.day สาขา", "")
baht = lambda x: int(x) / 100

F = "Arial"
def ft(**k): return Font(name=F, size=k.pop("size", 10), **k)
HEAD = PatternFill("solid", fgColor="F4ECE3"); SEL = PatternFill("solid", fgColor="FFF4CC")
TOT = PatternFill("solid", fgColor="EDE7E0"); GREY = PatternFill("solid", fgColor="F2F2F2")
thin = Side(style="thin", color="D9D2C9"); BOX = Border(top=thin, bottom=thin, left=thin, right=thin)
NUM = '#,##0.00;[Red]-#,##0.00'; INT = '#,##0'; PCT = '0.0%'

def header(ws, row, cols):
    for i, h in enumerate(cols, 1):
        c = ws.cell(row, i, h); c.font = ft(bold=True); c.fill = HEAD; c.border = BOX
        c.alignment = Alignment(wrap_text=True, vertical="center")
def title(ws, t, sub=None, sub2=None):
    ws["A1"] = t; ws["A1"].font = ft(bold=True, size=14)
    if sub: ws["A2"] = sub; ws["A2"].font = ft(size=9, color="666666")
    if sub2: ws["A3"] = sub2; ws["A3"].font = ft(size=9, color="666666")
def widths(ws, ws_w):
    for i, w in enumerate(ws_w):
        ws.column_dimensions[chr(65 + i) if i < 26 else "A" + chr(65 + i - 26)].width = w

wb = Workbook()
sm = wb.active; sm.title = "สรุป"
ex = wb.create_sheet("เลือกรายจ่าย")
rv = wb.create_sheet("รายรับ")
ln = wb.create_sheet("รายการในใบเสร็จ")
dy = wb.create_sheet("รายวัน")
cx = wb.create_sheet("ชำระแล้วแต่ยกเลิก")
vx = wb.create_sheet("รายจ่ายที่ยกเลิก")

# ───────────────────────── รายรับ (one row per paid sale) ─────────────────────────
done = [r for r in REV if r[8] == "COMPLETED"]
canc = [r for r in REV if r[8] != "COMPLETED"]
title(rv, "รายรับ ตุลาคม 2569 (ต.ค. 2026) — 1 แถวต่อ 1 บิล ตามวันที่รับชำระ",
      "ค่าบริการ = ยอดตามใบเสร็จ (ใบเสร็จ/ใบกำกับภาษีอย่างย่อ) · ทิปแยกคอลัมน์ ไม่รวมในใบเสร็จ · VAT เริ่ม 13/10/2026",
      "“ราคาในระบบ” คือราคาบนการจองซึ่งบางบิลสูงกว่าที่เก็บจริง (ราคาบริการเสริมก่อนส่วนลดสมาชิก) — ใช้ยอดตามใบเสร็จเป็นรายรับ")
RH = ["วันที่ชำระ", "เวลา", "สาขา", "เลขที่ใบเสร็จ", "ประเภทเอกสาร", "บริการหลัก", "ค่าบริการ (ตามใบเสร็จ)",
      "ก่อน VAT", "VAT", "ทิป", "รวมรับ", "วิธีชำระ", "ราคาในระบบ", "ผลต่าง (ระบบ − ใบเสร็จ)"]
header(rv, 4, RH)
DOC = {"ABB_TAX_INVOICE": "ใบกำกับภาษีอย่างย่อ", "RECEIPT": "ใบเสร็จรับเงิน (ก่อนจด VAT)", "": "ไม่มีเอกสาร (฿0)"}
r0 = 5
for i, r in enumerate(done):
    n = r0 + i
    has = bool(r[9])
    gross = baht(r[11]) if has else baht(r[6])
    net = baht(r[12]) if has else gross
    vat = baht(r[13]) if has else 0
    rv.append([D(r[0]), r[1], B(r[3]), r[9] or None, DOC[r[14]], r[4], gross, net, vat, baht(r[7]),
               f"=G{n}+J{n}", r[10] or "ไม่ระบุ", baht(r[6]), f"=M{n}-G{n}"])
rN = r0 + len(done) - 1
tr = rN + 1
rv.cell(tr, 1, "รวม").font = ft(bold=True)
for col in "GHIJKMN":
    c = rv[f"{col}{tr}"]; c.value = f"=SUM({col}{r0}:{col}{rN})"; c.font = ft(bold=True); c.fill = TOT
for row in rv.iter_rows(min_row=r0, max_row=tr):
    for c in row: c.font = ft(bold=bool(c.font.bold)); c.border = BOX
    row[0].number_format = "dd/mm/yyyy"
    for c in row[6:11] + row[12:14]: c.number_format = NUM
rv.freeze_panes = "A5"; rv.auto_filter.ref = f"A4:N{rN}"
widths(rv, [11, 7, 10, 13, 22, 34, 14, 12, 10, 9, 12, 10, 12, 12])
RR = lambda col: f"'รายรับ'!${col}${r0}:${col}${rN}"

# ───────────────────────── รายการในใบเสร็จ ─────────────────────────
def rgroup(d):
    if d == "สระไดร์": return "สระไดร์"
    if d == "สมาชิก 30 วัน": return "สมาชิก 30 วัน"
    if d.startswith("แพ็กเกจ"): return "แพ็กเกจ"
    if d == "PJOLI Treatment": return "PJOLI Treatment"
    if "อัลติเมท สปา" in d: return "Davines Ultimate Spa"
    if "เคราติน" in d: return "Keratin Treatment"
    if "NIGAO" in d: return "ย้อมสี NIGAO"
    if "Rainy Scalp" in d: return "Rainy Scalp Detox Combo Set"
    if d in ("ตัดผม", "Root Perm"): return "ตัดผม / ดัดโคน"
    if "(200 ml)" in d or "คุ๊กกี้" in d: return "สินค้าขายปลีก"
    if d == "ส่วนลดทั้งบิล": return "ส่วนลดทั้งบิล"
    return "บริการเสริม"
GROUPS = ["สระไดร์", "สมาชิก 30 วัน", "แพ็กเกจ", "PJOLI Treatment", "Davines Ultimate Spa", "Keratin Treatment",
          "ย้อมสี NIGAO", "Rainy Scalp Detox Combo Set", "ตัดผม / ดัดโคน", "บริการเสริม", "สินค้าขายปลีก", "ส่วนลดทั้งบิล"]
bk = {r[15]: r for r in REV}
title(ln, "รายการในใบเสร็จ ตุลาคม 2569 — ใช้แยกรายรับตามประเภทบริการ / สินค้า",
      "เฉพาะใบเสร็จที่ยังใช้งาน · สถานะ “เสร็จสิ้น” นับเป็นรายรับ")
header(ln, 4, ["เลขที่ใบเสร็จ", "วันที่ชำระ", "สาขา", "สถานะ", "รายการในใบเสร็จ", "กลุ่ม", "จำนวน", "จำนวนเงิน (บาท)"])
ST = {"COMPLETED": "เสร็จสิ้น", "CANCELLED": "ยกเลิก", "NO_SHOW": "ไม่มาตามนัด"}
lsum = collections.defaultdict(int)
for l in LINES:
    b = bk[l[1]]; lsum[l[1]] += int(l[4])
    q = float(l[3]); ln.append([l[0], D(b[0]), B(b[3]), ST.get(b[8], b[8]), l[2], rgroup(l[2]), int(q) if q == int(q) else q, baht(l[4])])
lN = 4 + len(LINES)
for row in ln.iter_rows(min_row=5, max_row=lN):
    for c in row: c.font = ft(); c.border = BOX
    row[1].number_format = "dd/mm/yyyy"; row[7].number_format = NUM
ln.freeze_panes = "A5"; ln.auto_filter.ref = f"A4:H{lN}"
widths(ln, [13, 11, 10, 10, 44, 26, 8, 14])
LR = lambda col: f"'รายการในใบเสร็จ'!${col}$5:${col}${lN}"
bad = [k for k, v in lsum.items() if bk[k][9] and v != int(bk[k][11])]
assert not bad, ("receipt lines do not add up", bad[:5])

# ───────────────────────── ชำระแล้วแต่ยกเลิก ─────────────────────────
title(cx, "ชำระเงินแล้วแต่บิลถูกยกเลิก — ยังไม่นับเป็นรายรับในสรุป",
      "มีใบเสร็จ/ใบกำกับภาษีที่ยังไม่ได้ยกเลิก ควรตัดสินใจว่าคืนเงิน (ยกเลิกใบเสร็จ) หรือนับเป็นรายรับ")
header(cx, 4, ["วันที่ชำระ", "เวลา", "สาขา", "บริการ", "เลขที่ใบเสร็จ", "ประเภทเอกสาร", "ยอด (บาท)", "VAT"])
for r in canc:
    cx.append([D(r[0]), r[1], B(r[3]), r[4], r[9] or None, DOC[r[14]], baht(r[11] if r[9] else r[6]), baht(r[13]) if r[9] else 0])
cN = 4 + len(canc)
cx.cell(cN + 1, 1, "รวม").font = ft(bold=True)
cx[f"G{cN+1}"] = f"=SUM(G5:G{cN})"; cx[f"H{cN+1}"] = f"=SUM(H5:H{cN})"
for row in cx.iter_rows(min_row=5, max_row=cN + 1):
    for c in row: c.font = ft(bold=bool(c.font.bold)); c.border = BOX
    row[0].number_format = "dd/mm/yyyy"; row[6].number_format = NUM; row[7].number_format = NUM
widths(cx, [11, 7, 10, 30, 13, 22, 12, 10])

# ───────────────────────── เลือกรายจ่าย ─────────────────────────
CAT = {"rent": "ค่าเช่า", "electricity": "ค่าไฟฟ้า", "water": "ค่าน้ำ", "internet_phone": "ค่าอินเทอร์เน็ต / โทรศัพท์",
       "maintenance": "ค่าซ่อมแซม / บำรุงรักษา", "decoration": "ค่าตกแต่ง", "hair_products": "ผลิตภัณฑ์ผม (แชมพู / สี / ทรีตเมนต์)",
       "consumable_other": "วัสดุสิ้นเปลืองอื่นๆ", "retail_stock": "สินค้าเพื่อขาย", "salary": "เงินเดือน",
       "commission_bonus": "คอมมิชชั่น / โบนัส / OT (จ่ายรายวัน)", "freelance": "ค่าจ้างชั่วคราว / ฟรีแลนซ์",
       "social_security": "ประกันสังคม", "marketing": "การตลาด / โฆษณา", "equipment": "อุปกรณ์ / เครื่องมือ",
       "software": "ระบบ / ซอฟต์แวร์", "professional": "บัญชี / ที่ปรึกษา", "tax_fee": "ภาษี / ค่าธรรมเนียม",
       "laundry": "ซักผ้า", "other": "อื่นๆ", "supplies": "วัสดุสิ้นเปลือง (รวม)", "utilities": "ค่าสาธารณูปโภค (รวม)", "labor": "ค่าจ้าง (รวม)"}
PM = {"CASH": "เงินสด", "TRANSFER": "โอนเงิน", "CARD": "บัตรเครดิต / เดบิต", "OTHER": "อื่นๆ", "": ""}
VM = {"NONE": "ไม่มี VAT", "INCLUSIVE": "รวม VAT แล้ว", "EXCLUSIVE": "แยก VAT", "LEGACY": "ไม่ระบุ"}
CERT = {}
for l in open(S + "certs.tsv", encoding="utf-8"):
    a, b = l.rstrip("\n").split("\t"); CERT[a] = b
nick = {}
for e in EXP:
    if e[7] == "commission_bonus" and "·" in e[20]: nick[e[4] or e[3]] = e[20].split("·")[-1].strip()

G1, G2, G3, G4 = "1. ค่าใช้จ่ายดำเนินงาน", "2. ตกแต่ง / อุปกรณ์สาขาใหม่ (เซ็นทรัลเวิลด์)", "3. เงินเดือน / ค่าจ้างพนักงาน", "4. ค่าตอบแทนพนักงานรายวัน (คอม / OT / ทิป)"
GROUPS_E = [G1, G2, G3, G4]
def egroup(e):
    if e[7] == "commission_bonus": return G4
    if e[6] == "EMPLOYEE" or e[7] in ("salary", "freelance"): return G3
    if "เซ็นทรัลเวิลด์" in e[2] or "สาขาใหม่" in e[20] or "เซ็นทรัลเ" in e[20] or "สาขา 3" in e[20]: return G2
    return G1
def evidence(e):
    att = int(e[18]); txt = e[20] + e[21]
    if e[7] in ("commission_bonus", "salary", "freelance") or e[6] == "EMPLOYEE":
        return "บันทึกจ่ายพนักงาน" if att == 0 else "มีไฟล์แนบ"
    _sr = re.search(r"SR-\d{4}-\d{3}", txt)
    if _sr: return "ใบรับรองแทนใบเสร็จ " + _sr.group(0)
    if att == 0: return "ไม่มีไฟล์หลักฐาน"
    if "สลิป" in txt: return "สลิปโอนเงินเท่านั้น"
    if e[15] and e[10] in ("INCLUSIVE", "EXCLUSIVE"): return "ใบกำกับภาษี"
    return "มีไฟล์แนบ (บิล / ใบเสร็จ)"

live = [e for e in EXP if e[14] != "VOIDED"]
voided = [e for e in EXP if e[14] == "VOIDED"]
sm_amt = collections.Counter(e[8] for e in live if e[7] == "decoration" and "ซัมมารี่" in e[3])
def flags(e):
    f = []; txt = e[20] + " " + e[21]; amt = int(e[8])
    if e[3] == "Academe" and amt in (764000, 70000): f.append("ยอดเท่าค่าไฟ/ค่าน้ำในใบแจ้งหนี้ Anacade — หมวดในระบบเป็นค่าเช่า")
    if e[3] == "Academe" and amt == 1700000: f.append("ค่าเช่าจ่ายนิติบุคคล ยังไม่ได้หัก ณ ที่จ่าย 5% · ผู้ขายไม่มีเลขผู้เสียภาษี")
    if e[7] == "rent" and "Primary House" in e[3]: f.append("ค่าเช่าจ่ายบริษัท ยังไม่ได้บันทึกหัก ณ ที่จ่าย — ตรวจสอบ")
    if e[7] == "professional" and int(e[12]) == 0 and amt >= 100000: f.append("ค่าบริการวิชาชีพ ≥ 1,000 ยังไม่ได้หัก ณ ที่จ่าย — ตรวจสอบ")
    if "Runway" in e[3]: f.append("บริการจากต่างประเทศ — อาจต้องยื่น ภ.พ.36")
    if e[7] == "decoration" and "ซัมมารี่" in e[3] and sm_amt[e[8]] > 1: f.append("ยอดเท่ากับอีกใบของซัมมารี่ (2610006 / 2610008) — ยืนยันว่าเป็นคนละงวด")
    if "อรุณฉาย" in e[3]: f.append("จ่ายจากบัญชีส่วนตัวของคุณศิรัญญา")
    if e[10] in ("INCLUSIVE", "EXCLUSIVE") and not e[15] and e[6] != "EMPLOYEE" and ("จำกัด" in e[3] or "Company" in e[3]):
        f.append("ยังไม่มีใบกำกับภาษี (มีแค่สลิป/ใบเสนอราคา) — ขอจากผู้ขาย")
    if e[7] == "water" and "น้ำดื่ม" in txt: f.append("น้ำดื่ม (ไม่ใช่ค่าน้ำประปา)")
    if e[7] == "other" and e[6] == "EMPLOYEE": f.append("จ่ายพนักงาน แต่หมวดเป็น “อื่นๆ”")
    if e[7] == "freelance" and e[6] == "EMPLOYEE": f.append("จ่ายพนักงานประจำในหมวดฟรีแลนซ์")
    if int(e[18]) == 0 and egroup(e) in (G1, G2): f.append("ไม่มีไฟล์หลักฐานแนบในระบบ")
    if e[7] in ("rent", "electricity", "water") and e[3] == "Academe": pass
    return " · ".join(f)
def payee(e):
    n = e[3]
    k = nick.get(e[4] or e[3])
    return f"{k} ({n})" if k and k != n else n
def detail(e):
    note = e[20].strip(); items = e[21].strip()
    if e[7] == "commission_bonus":
        return (note + (" — " + items.replace(" | ", ", ") if items else "")).strip()
    parts = [p for p in [note, items.replace(" | ", ", ")] if p]
    return " — ".join(parts)[:400]

order = {g: i for i, g in enumerate(GROUPS_E)}
live.sort(key=lambda e: (order[egroup(e)], e[1], e[2], payee(e)))
title(ex, "เลือกรายจ่ายที่จะส่งบัญชี — ตุลาคม 2569 (ต.ค. 2026)",
      "คอลัมน์ B (สีเหลือง) เลือก “ส่ง” หรือ “ไม่ส่ง” — ตารางรายจ่ายในชีต “สรุป” คำนวณใหม่ตามที่เลือกทันที · ตั้งต้นเป็น “ส่ง” ทุกรายการ",
      "ยอดรวม = ยอดตามเอกสารรวม VAT · ยอดจ่ายจริง = ยอดรวม − หัก ณ ที่จ่าย · วันที่ = วันที่บันทึกรายจ่าย · ไม่รวมรายการที่ยกเลิก (ดูชีต “รายจ่ายที่ยกเลิก”)")
EH = ["ลำดับ", "ส่งบัญชี", "กลุ่ม", "วันที่", "สาขา", "ผู้รับเงิน", "ชื่อตามเอกสาร", "เลขผู้เสียภาษี", "หมวด",
      "รายละเอียด", "เลขที่เอกสาร", "วันที่เอกสาร", "ยอดรวม (บาท)", "VAT", "ก่อน VAT", "หัก ณ ที่จ่าย",
      "ยอดจ่ายจริง", "ประเภท VAT", "วิธีจ่าย", "วันที่จ่าย", "หลักฐาน", "50 ทวิ เลขที่", "ข้อสังเกต", "รหัสในระบบ"]
header(ex, 4, EH)
e0 = 5
for i, e in enumerate(live):
    n = e0 + i
    vat = baht(e[11]) if int(e[11]) > 0 else 0
    ex.append([i + 1, "ส่ง", egroup(e), D(e[1]), B(e[2]), payee(e), e[4] or None, e[5] or None, CAT.get(e[7], e[7]),
               detail(e) or None, e[15] or None, D(e[16]), baht(e[8]), vat, f"=M{n}-N{n}", baht(e[12]), f"=M{n}-P{n}",
               VM.get(e[10], e[10]), PM.get(e[13], e[13]), D(e[17]), evidence(e), CERT.get(e[0]), flags(e) or None, e[0]])
eN = e0 + len(live) - 1
et = eN + 1
ex.cell(et, 1, "รวมทุกรายการ").font = ft(bold=True)
ex.cell(et + 1, 1, "รวมเฉพาะที่เลือก “ส่ง”").font = ft(bold=True)
for col in "MNOPQ":
    ex[f"{col}{et}"] = f"=SUM({col}{e0}:{col}{eN})"
    ex[f"{col}{et+1}"] = f'=SUMIFS({col}{e0}:{col}{eN},$B${e0}:$B${eN},"ส่ง")'
for row in ex.iter_rows(min_row=e0, max_row=et + 1):
    for c in row:
        if not c.font.bold: c.font = ft()
        c.border = BOX; c.alignment = Alignment(vertical="top", wrap_text=c.column in (6, 7, 10, 23))
    row[3].number_format = "dd/mm/yyyy"; row[11].number_format = "dd/mm/yyyy"; row[19].number_format = "dd/mm/yyyy"
    for c in row[12:17]: c.number_format = NUM
for r in (et, et + 1):
    for c in ex[r]: c.fill = TOT; c.font = ft(bold=True)
for r in range(e0, eN + 1):
    c = ex.cell(r, 2); c.fill = SEL; c.font = ft(bold=True); c.alignment = Alignment(horizontal="center", vertical="top")
dv = DataValidation(type="list", formula1='"ส่ง,ไม่ส่ง"', allow_blank=False, showDropDown=False)
dv.error = "เลือก ส่ง หรือ ไม่ส่ง"; dv.errorTitle = "ส่งบัญชี"
ex.add_data_validation(dv); dv.add(f"B{e0}:B{eN}")
ex.conditional_formatting.add(f"A{e0}:X{eN}", FormulaRule(formula=[f'$B{e0}="ไม่ส่ง"'], fill=GREY, font=Font(color="999999", strike=True)))
ex.freeze_panes = "D5"; ex.auto_filter.ref = f"A4:X{eN}"
widths(ex, [6, 9, 22, 11, 11, 26, 26, 15, 22, 46, 15, 11, 13, 11, 13, 11, 13, 12, 12, 11, 18, 9, 44, 27])
ER = lambda col: f"'เลือกรายจ่าย'!${col}${e0}:${col}${eN}"
SENT = f'{ER("B")},"ส่ง"'

# ───────────────────────── รายจ่ายที่ยกเลิก ─────────────────────────
title(vx, "รายจ่ายที่ยกเลิกแล้วในระบบ — ไม่นับในยอดใดๆ (แสดงไว้เพื่ออ้างอิงเท่านั้น)")
header(vx, 4, ["วันที่", "สาขา", "ผู้รับเงิน", "หมวด", "ยอด (บาท)", "หมายเหตุ", "รหัสในระบบ"])
for e in sorted(voided, key=lambda e: e[1]):
    vx.append([D(e[1]), B(e[2]), payee(e), CAT.get(e[7], e[7]), baht(e[8]), e[20] or None, e[0]])
for row in vx.iter_rows(min_row=5, max_row=4 + len(voided)):
    for c in row: c.font = ft(color="777777"); c.border = BOX
    row[0].number_format = "dd/mm/yyyy"; row[4].number_format = NUM
widths(vx, [11, 11, 30, 30, 12, 40, 27])

# ───────────────────────── รายวัน ─────────────────────────
title(dy, "รายรับรายวัน ตุลาคม 2569 — ค่าบริการตามใบเสร็จ + ทิป", "เฉพาะบิลที่ชำระแล้วและบริการเสร็จสิ้น · วันที่ตามวันที่รับชำระ")
header(dy, 4, ["วันที่", "บางนา", "สุขุมวิท", "ค่าบริการรวม", "ทิป", "รวมรับ", "จำนวนบิล"])
for d in range(1, LAST + 1):
    n = 4 + d; day = datetime.datetime(Y, M, d)
    dy.cell(n, 1, day).number_format = "dd/mm/yyyy"
    dy[f"B{n}"] = f'=SUMIFS({RR("G")},{RR("A")},$A{n},{RR("C")},"บางนา")'
    dy[f"C{n}"] = f'=SUMIFS({RR("G")},{RR("A")},$A{n},{RR("C")},"สุขุมวิท")'
    dy[f"D{n}"] = f"=B{n}+C{n}"
    dy[f"E{n}"] = f'=SUMIFS({RR("J")},{RR("A")},$A{n})'
    dy[f"F{n}"] = f"=D{n}+E{n}"
    dy[f"G{n}"] = f'=COUNTIFS({RR("A")},$A{n})'
DT = 5 + LAST   # total row of the daily sheet
dy[f"A{DT}"] = "รวม"
for col in "BCDEFG": dy[f"{col}{DT}"] = f"=SUM({col}5:{col}{DT-1})"
for row in dy.iter_rows(min_row=5, max_row=DT):
    for c in row: c.font = ft(bold=c.row == DT); c.border = BOX
    for c in row[1:6]: c.number_format = NUM
    if row[0].row == DT:
        for c in row: c.fill = TOT
widths(dy, [12, 14, 14, 15, 10, 15, 10])

# ───────────────────────── สรุป ─────────────────────────
title(sm, "สรุปรายรับ-รายจ่าย — ตุลาคม 2569 (ต.ค. 2026)",
      f"ร้าน err.day (สาขาบางนา, สาขาสุขุมวิท; สาขาเซ็นทรัลเวิลด์ยังไม่เปิด)  |  ช่วงวันที่ {FIRST:%d/%m/%Y} – {FIRST.replace(day=LAST):%d/%m/%Y}  |  หน่วย: บาท",
      f"ข้อมูลจากระบบ err.day ณ วันที่ {TODAY:%d/%m/%Y} · รายรับยึดวันที่รับชำระ · รายจ่ายยึดวันที่บันทึก · ตัวเลขทุกช่องเป็นสูตรดึงจากชีตรายการ")
R = [5]
def put(vals, bold=False, fill=None, fmt=None):
    r = R[0]
    for i, v in enumerate(vals, 1):
        if v is None: continue
        c = sm.cell(r, i, v); c.font = ft(bold=bold)
        if fill: c.fill = fill
        nf = (fmt[i - 2] if i - 2 < len(fmt) else None) if isinstance(fmt, list) else fmt
        if i > 1 and nf: c.number_format = nf
        if any(x is not None for x in vals[1:]): c.border = BOX
    R[0] += 1; return r
def sec(t): R[0] += 1; c = sm.cell(R[0], 1, t); c.font = ft(bold=True, size=12); R[0] += 1
def hdr(cols):
    r = R[0]; [setattr(sm.cell(r, i, h), "value", h) for i, h in enumerate(cols, 1)]
    for i in range(1, len(cols) + 1):
        c = sm.cell(r, i); c.font = ft(bold=True); c.fill = HEAD; c.border = BOX; c.alignment = Alignment(wrap_text=True, vertical="center")
    R[0] += 1; return r

sm.cell(R[0], 1, "ส่วนที่ 1 — รายรับ").font = ft(bold=True, size=13, color="8A5A2B"); R[0] += 1
sec("1.1 ยอดรวม")
hdr(["รายการ", "จำนวนบิล", "ค่าบริการ (ตามใบเสร็จ)", "ทิป", "รวมรับ", "หมายเหตุ"])
rTOT = put(["รายรับเดือนนี้ — บริการเสร็จสิ้นและชำระแล้ว", f"=COUNTA({RR('A')})", f"=SUM({RR('G')})", f"=SUM({RR('J')})", f"=C{R[0]}+D{R[0]}",
            "ตัวเลขรายรับหลักของเดือน"], bold=True, fmt=[INT, NUM, NUM, NUM])
put(["ชำระแล้วแต่บิลยกเลิก (ยังไม่นับ)", f"=COUNTA('ชำระแล้วแต่ยกเลิก'!$A$5:$A${cN})", f"='ชำระแล้วแต่ยกเลิก'!G{cN+1}", 0, f"=C{R[0]}+D{R[0]}",
     "ดูชีต “ชำระแล้วแต่ยกเลิก” — ต้องคืนเงินหรือนับเป็นรายรับ"], fmt=[INT, NUM, NUM, NUM])
sec("1.2 แยกตามสาขา")
hdr(["สาขา", "จำนวนบิล", "ค่าบริการ", "ทิป", "รวมรับ", "สัดส่วน"])
b0 = R[0]
for br in ["บางนา", "สุขุมวิท"]:
    put([br, f'=COUNTIFS({RR("C")},A{R[0]})', f'=SUMIFS({RR("G")},{RR("C")},A{R[0]})', f'=SUMIFS({RR("J")},{RR("C")},A{R[0]})',
         f"=C{R[0]}+D{R[0]}", f"=E{R[0]}/$E${rTOT}"], fmt=[INT, NUM, NUM, NUM, PCT])
rBR = put(["รวม", f"=SUM(B{b0}:B{R[0]-1})", f"=SUM(C{b0}:C{R[0]-1})", f"=SUM(D{b0}:D{R[0]-1})", f"=SUM(E{b0}:E{R[0]-1})", f"=E{R[0]}/$E${rTOT}"],
          bold=True, fill=TOT, fmt=[INT, NUM, NUM, NUM, PCT])
sec("1.3 แยกตามประเภทบริการ / สินค้า (ค่าบริการตามใบเสร็จ ไม่รวมทิป)")
hdr(["ประเภท", "จำนวน (หน่วย)", "จำนวนเงิน", "สัดส่วน", None, "หมายเหตุ"])
g0 = R[0]
NOTE_G = {"สมาชิก 30 วัน": "รับเงินล่วงหน้า ใช้สิทธิ์ได้ 30 วัน", "แพ็กเกจ": "รับเงินล่วงหน้าสำหรับการใช้บริการครั้งถัดไป",
          "บริการเสริม": "นวดศีรษะ, หนีบ/ไดร์ฟาร่า, ผมต่อ, สครับ, แชมพูม่วง, มาสก์", "สินค้าขายปลีก": "แชมพู/ทรีตเมนต์ PJOLI ขวด, มินิคุกกี้"}
for g in GROUPS:
    put([g, f'=SUMIFS({LR("G")},{LR("F")},A{R[0]},{LR("D")},"เสร็จสิ้น")', f'=SUMIFS({LR("H")},{LR("F")},A{R[0]},{LR("D")},"เสร็จสิ้น")',
         f"=C{R[0]}/$C${rTOT}", None, NOTE_G.get(g)], fmt=[INT, NUM, PCT])
put(["บิล ฿0 (ใช้สิทธิ์แพ็กเกจ ไม่มีใบเสร็จ)", f'=COUNTIFS({RR("E")},"ไม่มีเอกสาร (฿0)")', 0, f"=C{R[0]}/$C${rTOT}"], fmt=[INT, NUM, PCT])
rGR = put(["รวม", None, f"=SUM(C{g0}:C{R[0]-1})", f"=C{R[0]}/$C${rTOT}"], bold=True, fill=TOT, fmt=[INT, NUM, PCT])
sec(f"1.4 ภาษีมูลค่าเพิ่ม (ภาษีขาย) — จด VAT ตั้งแต่ {VAT_START:%d/%m/%Y}")
hdr(["ช่วง", "จำนวนบิล", "ยอดรวม VAT", "ก่อน VAT", "VAT", "หมายเหตุ"])
v0 = R[0]
put(["ใบเสร็จรับเงิน (ก่อนจด VAT)", f'=COUNTIFS({RR("E")},"ใบเสร็จรับเงิน (ก่อนจด VAT)")',
     f'=SUMIFS({RR("G")},{RR("E")},"ใบเสร็จรับเงิน (ก่อนจด VAT)")', f'=SUMIFS({RR("H")},{RR("E")},"ใบเสร็จรับเงิน (ก่อนจด VAT)")',
     f'=SUMIFS({RR("I")},{RR("E")},"ใบเสร็จรับเงิน (ก่อนจด VAT)")', "ไม่มี VAT"], fmt=[INT, NUM, NUM, NUM])
put(["ใบกำกับภาษีอย่างย่อ (ตั้งแต่จด VAT)", f'=COUNTIFS({RR("E")},"ใบกำกับภาษีอย่างย่อ")',
     f'=SUMIFS({RR("G")},{RR("E")},"ใบกำกับภาษีอย่างย่อ")', f'=SUMIFS({RR("H")},{RR("E")},"ใบกำกับภาษีอย่างย่อ")',
     f'=SUMIFS({RR("I")},{RR("E")},"ใบกำกับภาษีอย่างย่อ")', "ราคารวม VAT 7% แล้ว"], fmt=[INT, NUM, NUM, NUM])
put(["บิล ฿0 (ไม่มีเอกสาร)", f'=COUNTIFS({RR("E")},"ไม่มีเอกสาร (฿0)")', 0, 0, 0], fmt=[INT, NUM, NUM, NUM])
rVT = put(["รวม", f"=SUM(B{v0}:B{R[0]-1})", f"=SUM(C{v0}:C{R[0]-1})", f"=SUM(D{v0}:D{R[0]-1})", f"=SUM(E{v0}:E{R[0]-1})",
           "ทิปไม่อยู่ในใบกำกับภาษี"], bold=True, fill=TOT, fmt=[INT, NUM, NUM, NUM])
put(["ภาษีขายในบิลที่ยกเลิก (ยังไม่ได้ยกเลิกใบกำกับ)", None, None, None, f"='ชำระแล้วแต่ยกเลิก'!H{cN+1}", "ถ้าคืนเงิน ต้องยกเลิกใบกำกับภาษีด้วย"], fmt=[INT, NUM, NUM, NUM])
sec("1.5 แยกตามวิธีชำระ")
hdr(["วิธีชำระ", "จำนวนบิล", "ค่าบริการ", "สัดส่วน"])
p0 = R[0]
for p in ["โอน", "เงินสด", "บัตร", "ไม่ระบุ"]:
    put([p, f'=COUNTIFS({RR("L")},A{R[0]})', f'=SUMIFS({RR("G")},{RR("L")},A{R[0]})', f"=C{R[0]}/$C${rTOT}"], fmt=[INT, NUM, PCT])
rPM = put(["รวม", f"=SUM(B{p0}:B{R[0]-1})", f"=SUM(C{p0}:C{R[0]-1})", f"=C{R[0]}/$C${rTOT}"], bold=True, fill=TOT, fmt=[INT, NUM, PCT])

R[0] += 1
sm.cell(R[0], 1, "ส่วนที่ 2 — รายจ่าย (นับเฉพาะรายการที่เลือก “ส่ง” ในชีต “เลือกรายจ่าย”)").font = ft(bold=True, size=13, color="8A5A2B"); R[0] += 1
sec("2.1 แยกตามกลุ่ม")
hdr(["กลุ่ม", "จำนวนที่ส่ง", "ยอดรวม (ส่ง)", "VAT (ส่ง)", "ก่อน VAT (ส่ง)", "หัก ณ ที่จ่าย (ส่ง)", "ยอดจ่ายจริง (ส่ง)", "ยอดรวมทุกรายการ", "จำนวนที่ไม่ส่ง"])
def erow(label, col, key):
    k = f'{ER(col)},A{R[0]}'
    return put([label, f"=COUNTIFS({SENT},{k})", f'=SUMIFS({ER("M")},{SENT},{k})', f'=SUMIFS({ER("N")},{SENT},{k})',
                f'=SUMIFS({ER("O")},{SENT},{k})', f'=SUMIFS({ER("P")},{SENT},{k})', f'=SUMIFS({ER("Q")},{SENT},{k})',
                f'=SUMIFS({ER("M")},{k})', f'=COUNTIFS({ER("B")},"ไม่ส่ง",{k})'], fmt=[INT] + [NUM] * 6 + [INT])
EF = [INT] + [NUM] * 6 + [INT]
k0 = R[0]
for g in GROUPS_E: erow(g, "C", g)
rEG = put(["รวม", *[f"=SUM({c}{k0}:{c}{R[0]-1})" for c in "BCDEFGHI"]], bold=True, fill=TOT, fmt=EF)
sec("2.2 แยกตามหมวดรายจ่าย")
hdr(["หมวด", "จำนวนที่ส่ง", "ยอดรวม (ส่ง)", "VAT (ส่ง)", "ก่อน VAT (ส่ง)", "หัก ณ ที่จ่าย (ส่ง)", "ยอดจ่ายจริง (ส่ง)", "ยอดรวมทุกรายการ", "จำนวนที่ไม่ส่ง"])
used = [CAT.get(c, c) for c in CAT if any(e[7] == c for e in live)]
k0 = R[0]
for c in used: erow(c, "I", c)
rEC = put(["รวม", *[f"=SUM({c}{k0}:{c}{R[0]-1})" for c in "BCDEFGHI"]], bold=True, fill=TOT, fmt=EF)
sec("2.3 หัก ณ ที่จ่าย ที่ออก 50 ทวิ แล้ว (ยื่น ภ.ง.ด.53)")
hdr(["50 ทวิ เลขที่", "ผู้รับเงิน", "ก่อน VAT", "หัก ณ ที่จ่าย", "ส่งบัญชี", "หมายเหตุ"])
w0 = R[0]
for i, e in enumerate(live):
    if e[0] in CERT:
        n = e0 + i
        put([CERT[e[0]], f"='เลือกรายจ่าย'!F{n}", f"='เลือกรายจ่าย'!O{n}", f"='เลือกรายจ่าย'!P{n}", f"='เลือกรายจ่าย'!B{n}"], fmt=[None, NUM, NUM, None])
rWH = put(["รวม", None, f"=SUM(C{w0}:C{R[0]-1})", f"=SUM(D{w0}:D{R[0]-1})", None, "ยื่น ภ.ง.ด.53 ภายใน 7 วันของเดือนถัดไป (ยื่นออนไลน์ถึงวันที่ 15)"], bold=True, fill=TOT, fmt=[None, NUM, NUM, None])
# optional: certificates issued this month for expenses booked next month (not in the totals above)
_extra = os.path.join(S, "extra_wht.json")   # [["เลขที่ 50 ทวิ", "ผู้รับเงิน", income, tax, "—", "หมายเหตุ"], ...]
if os.path.exists(_extra):
    for row in json.load(open(_extra, encoding="utf-8")):
        put(row, fmt=[None, NUM, NUM, None])

R[0] += 1
sm.cell(R[0], 1, "ส่วนที่ 3 — ภาพรวม (เบื้องต้น ยังไม่ใช่งบกำไรขาดทุนทางบัญชี)").font = ft(bold=True, size=13, color="8A5A2B"); R[0] += 1
hdr(["รายการ", None, "บาท", None, None, "หมายเหตุ"])
rA = put(["รายรับก่อน VAT + ทิป", None, f"=D{rVT}+D{rTOT}", None, None, "ค่าบริการก่อน VAT + ทิป"], fmt=[None, NUM])
rB = put(["รายจ่ายที่ส่ง (ก่อน VAT)", None, f"=E{rEG}", None, None, "รวมงานตกแต่งสาขาใหม่ ซึ่งบัญชีอาจบันทึกเป็นสินทรัพย์"], fmt=[None, NUM])
rC = put(["รายจ่ายที่ส่ง ไม่รวมกลุ่ม 2 (ตกแต่งสาขาใหม่)", None, f"=E{rEG}-E{rEG-3}", None, None, "ค่าใช้จ่ายดำเนินงาน + พนักงาน"], fmt=[None, NUM])
put(["ส่วนต่าง: รายรับ − รายจ่ายดำเนินงาน", None, f"=C{rA}-C{rC}", None, None, "ไม่รวมค่าตกแต่งสาขาใหม่"], bold=True, fill=TOT, fmt=[None, NUM])

sec("ตรวจสอบยอด")
for lab, f in [
    ("รายรับ: แยกสาขา = ยอดรวม", f'=IF(ROUND(E{rBR}-E{rTOT},2)=0,"ตรงกัน ✓","ไม่ตรง")'),
    ("รายรับ: แยกประเภท = ยอดรวม", f'=IF(ROUND(C{rGR}-C{rTOT},2)=0,"ตรงกัน ✓","ไม่ตรง")'),
    ("รายรับ: แยก VAT = ยอดรวม", f'=IF(ROUND(C{rVT}-C{rTOT},2)=0,"ตรงกัน ✓","ไม่ตรง")'),
    ("รายรับ: แยกวิธีชำระ = ยอดรวม", f'=IF(ROUND(C{rPM}-C{rTOT},2)=0,"ตรงกัน ✓","ไม่ตรง")'),
    ("รายรับ: ผลรวมรายวัน = ยอดรวม", f"=IF(ROUND('รายวัน'!F{DT}-E{rTOT},2)=0,\"ตรงกัน ✓\",\"ไม่ตรง\")"),
    ("รายจ่าย: แยกกลุ่ม = แยกหมวด", f'=IF(ROUND(C{rEG}-C{rEC},2)=0,"ตรงกัน ✓","ไม่ตรง")'),
    ("รายจ่าย: แยกกลุ่ม = ผลรวมที่ส่งในชีตรายการ", f"=IF(ROUND(C{rEG}-'เลือกรายจ่าย'!M{et+1},2)=0,\"ตรงกัน ✓\",\"ไม่ตรง\")"),
]:
    put([lab, None, f])

sec("หมายเหตุ")
NOTES = [
    "1. รายรับใช้ยอดตามใบเสร็จ/ใบกำกับภาษี (เงินที่เก็บจริง) — บางบิลราคาบนการจองในระบบสูงกว่าใบเสร็จ (ราคาบริการเสริมก่อนส่วนลดสมาชิก) ดูคอลัมน์ “ผลต่าง” ในชีต “รายรับ”",
    "2. ทิปคือทิปที่ลูกค้าจ่ายมากับบิล (นับเป็นรายรับตั้งแต่ 1 ต.ค. 2569) แยกจากค่าบริการ และไม่อยู่ในใบกำกับภาษี",
    "3. ค่าสมาชิก 30 วันและแพ็กเกจเป็นเงินรับล่วงหน้า บัญชีอาจรับรู้รายได้ตามการใช้สิทธิ์",
    "4. งานตกแต่งและอุปกรณ์สาขาเซ็นทรัลเวิลด์ (กลุ่ม 2) แยกไว้ให้บัญชีพิจารณาบันทึกเป็นสินทรัพย์หรือค่าใช้จ่าย",
    "5. ค่าตอบแทนพนักงานรายวัน (กลุ่ม 4) บันทึกตามวันที่ทำงาน · พนักงานแสดงเป็น “ชื่อเล่น (ชื่อตามเอกสาร)”",
]
# month-specific remarks (one per line) go in DATA/notes.txt — e.g. unusual tips, missing bills vs last month
_nf = os.path.join(S, "notes.txt")
if os.path.exists(_nf):
    NOTES += [l.strip() for l in open(_nf, encoding="utf-8") if l.strip()]
for t in NOTES:
    c = sm.cell(R[0], 1, t); c.font = ft(size=9); c.alignment = Alignment(wrap_text=True, vertical="top")
    sm.merge_cells(start_row=R[0], start_column=1, end_row=R[0], end_column=9); sm.row_dimensions[R[0]].height = 26; R[0] += 1
widths(sm, [44, 12, 16, 14, 15, 16, 16, 16, 12])
sm.column_dimensions["F"].width = 18
wb.calculation = CalcProperties(fullCalcOnLoad=True)
for _ws in wb.worksheets:                       # titles were written with the October wording
    for _row in _ws.iter_rows():
        for _c in _row:
            if isinstance(_c.value, str) and not _c.value.startswith("="):
                _c.value = _c.value.replace("ตุลาคม 2569", LABEL).replace("ต.ค. 2026", LABEL_EN)
wb.save(OUT)
print("saved", OUT, "| expense rows", len(live), "voided", len(voided), "| sales", len(done), "cancelled", len(canc))
