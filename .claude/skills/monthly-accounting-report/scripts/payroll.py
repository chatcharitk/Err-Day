import collections, os
from common import *

ROWS = [l.rstrip("\n").split("\t") for l in open(A + "pay.tsv") if l.strip()]
ITEMS = collections.defaultdict(list)
for l in open(A + "payitems.tsv"):
    if not l.strip(): continue
    eid, kind, desc, amt = l.rstrip("\n").split("\t"); ITEMS[eid].append((kind, desc, int(amt) / 100))

# Expense seq numbers (E###) from the picked workbook
SEQ = {}
for r in load_workbook(PICKED)["เลือกรายจ่าย"].iter_rows(min_row=5, values_only=True):
    if isinstance(r[0], int): SEQ[r[23]] = r[0]

COLS = ["เงินเดือน / ค่าจ้าง", "ค่า OT", "ค่าคอมมิชชั่น", "ทิป", "ค่าเดินทาง", "อื่นๆ / ปรับปรุง"]
KIND = {"OT": 1, "COMMISSION": 2, "TIP": 3, "TRAVEL": 4, "ADJUSTMENT": 5}
BR = {"err.day สาขาบางนา": "บางนา", "err.day สาขาสุขุมวิท": "สุขุมวิท", "": "-"}
LEGAL_BY_NICK = {}
for eid, d, br, cat, vendor, legal, nick, amt, paid, pm, notes in ROWS:
    if nick and legal: LEGAL_BY_NICK[nick] = legal

# everyone is paid by transfer except Bouavanh Xayyakheam (cash) — owner instruction, Nov 2026
METHOD = lambda legal: "เงินสด" if "Bouavanh" in legal else "โอน"
people = collections.OrderedDict(); detail = []
for eid, d, br, cat, vendor, legal, nick, amt, paid, pm, notes in ROWS:
    nick = nick or vendor; legal = legal or LEGAL_BY_NICK.get(nick, vendor)
    total = int(amt) / 100; split = [0.0] * 6
    its = ITEMS.get(eid, [])
    for kind, desc, a in its: split[KIND.get(kind, 5)] += a
    rest = round(total - sum(split), 2)
    if abs(rest) > 0.004: split[0 if cat in ("salary", "freelance", "other") and not its else 5] += rest
    p = people.setdefault(legal, dict(nick=nick, br=set(), split=[0.0] * 6, paid=0.0, unpaid=0.0, n=0))
    br and p["br"].add(BR.get(br, br)); p["n"] += 1
    for i in range(6): p["split"][i] += split[i]
    if paid: p["paid"] += total
    else: p["unpaid"] += total
    kindtxt = {"salary": "เงินเดือน/ค่าจ้าง", "commission_bonus": "ค่าตอบแทนรายวัน", "freelance": "ค่าจ้างรายวัน (ฟรีแลนซ์)", "other": "ค่าจ้าง (หมวดในระบบ: อื่นๆ)"}[cat]
    desc = ", ".join(f"{x[1]} {x[2]:,.2f}" for x in its) or (notes[:120] if notes else "")
    detail.append([f"E{SEQ[eid]:03d}" if eid in SEQ else "", datetime.datetime.fromisoformat(d), legal, nick, BR.get(br, br), kindtxt, desc, *[round(x, 2) for x in split], total,
                   METHOD(legal)])

wb = Workbook()
ws = wb.active; ws.title = "สรุปเงินเดือน"
r = title(ws, "รายงานเงินเดือนและค่าตอบแทนพนักงาน")
rows = []
for i, (legal, p) in enumerate(people.items(), 1):
    n = r + i
    rows.append([i, legal, p["nick"], " / ".join(sorted(p["br"])), *[round(x, 2) for x in p["split"]], f"=SUM(E{n}:J{n})", METHOD(legal), None, None])
r = table(ws, r, ["ลำดับ", "ชื่อ-นามสกุล", "ชื่อเล่น", "สาขา", *COLS, "รวมเงินได้", "วิธีจ่าย", "ประกันสังคม (หัก)", "ภาษีหัก ณ ที่จ่าย"],
          rows, money=(5, 6, 7, 8, 9, 10, 11, 13, 14), ints=(1,), total=list(range(5, 12)), wrap=(2,),
          widths=[7, 28, 10, 16, 15, 12, 13, 10, 11, 13, 15, 10, 15, 15])
r += 1
r = section(ws, r, "หมายเหตุ")
tips_paid = sum(p["split"][3] for p in people.values())
for t in [
    f"• ข้อมูลจากระบบ err.day ณ {TODAY:%d/%m/%Y} · วันที่ตามวันที่บันทึกรายจ่าย · “ค่าตอบแทนรายวัน” = ค่า OT / ค่าคอม / ทิป ที่จ่ายพนักงานเป็นรายวัน",
    "• พร และ ตั้ก รับค่าจ้างเป็นรายสัปดาห์ จึงมีหลายรายการในเดือน",
    f"• ทิปที่จ่ายให้พนักงานรวม ฿{tips_paid:,.2f} — อาจมากกว่าทิปที่รับผ่านบิลในเดือนนี้ เพราะมีทิปที่ลูกค้าให้นอกบิล/ไม่ได้ผูกกับบิล",
    "• ระบบไม่มีข้อมูลประกันสังคมและภาษีเงินได้หัก ณ ที่จ่าย (ภ.ง.ด.1) — ช่องว่างไว้ให้ฝ่ายบัญชีคำนวณ/กรอก",
]: r = note(ws, r, t, 14, height=28)
_pn = os.path.join(DATA, "payroll_notes.txt")   # month-specific remarks, one per line
if os.path.exists(_pn):
    for t in open(_pn, encoding="utf-8"):
        if t.strip(): r = note(ws, r, t.strip(), 14, height=28)
page(ws)

ws = wb.create_sheet("รายละเอียดรายการ")
r = title(ws, "รายละเอียดการจ่ายพนักงานรายรายการ")
r = table(ws, r, ["อ้างอิง", "วันที่", "ชื่อ-นามสกุล", "ชื่อเล่น", "สาขา", "ประเภท", "รายละเอียด", *COLS, "รวม", "วิธีจ่าย"],
          detail, money=tuple(range(8, 15)), dates=(2,), total=list(range(8, 15)), wrap=(3, 7),
          widths=[9, 11, 26, 9, 9, 17, 40, 14, 11, 12, 9, 10, 12, 12, 10])
ws.freeze_panes = "C6"; ws.auto_filter.ref = f"A5:O{r-2}"
page(ws)

OUT = OUTDIR + f"3 รายงานเงินเดือน {SHORT}.xlsx"
wb.save(OUT)
tot = [round(sum(p["split"][i] for p in people.values()), 2) for i in range(6)]
print("saved", OUT, len(people), "people", len(detail), "rows", tot, round(sum(tot), 2))
for k, p in people.items(): print(k, p["nick"], [round(x, 2) for x in p["split"]], round(sum(p["split"]), 2))
