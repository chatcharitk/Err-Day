import collections, os, re, shutil, io
from common import *
from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("Tahoma", "/System/Library/Fonts/Supplemental/Tahoma.ttf"))
pdfmetrics.registerFont(TTFont("TahomaB", "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"))

import glob
# substitute receipts for the month: outputs/ใบรับรองแทนใบเสร็จ <เดือน> (SR-YYMM-NNN).pdf  (may be none)
SR_FILES = sorted(glob.glob(f"{OUTROOT}ใบรับรองแทนใบเสร็จ {SHORT} (SR-*).pdf"))
SR_NOS = [re.search(r"SR-\d{4}-\d{3}", f).group(0) for f in SR_FILES]
CERT_DIR = f"{APP}outputs/50 ทวิ {SHORT} (เซ็นแล้ว)/"
IS_SR_FILE = lambda fn: fn.startswith("ใบรับรองแทนใบเสร็จ SR-")
PAYCATS = ("เงินเดือน", "ค่าตอบแทนรายวัน", "ฟรีแลนซ์")

src = load_workbook(PICKED)
E = []
for r in src["เลือกรายจ่าย"].iter_rows(min_row=5, values_only=True):
    if not isinstance(r[0], int) or r[1] != "ส่ง": continue
    m = r[12] or 0; v = r[13] or 0; w = r[15] or 0
    E.append(dict(seq=r[0], grp=r[2], d=r[3], br=r[4], payee=r[5], legal=r[6] or "", tax=r[7] or "", cat=r[8], det=r[9] or "",
                  doc=r[10] or "", docd=r[11], amt=m, vat=v, net=round(m - v, 2), wht=w, paid=round(m - w, 2), vmode=r[17],
                  pm=r[18] or "", paidd=r[19], ev=r[20] or "", cert=r[21] or "", flag=r[22] or "", id=r[23]))
ATT = collections.defaultdict(list)
for l in open(A + "att.tsv"):
    eid, aid, url, fn, ftp = l.rstrip("\n").split("\t")
    ATT[eid].append(dict(aid=aid, fn=fn, path=A + f"dl/{eid}__{aid}"))

def kind(p):
    h = open(p, "rb").read(12)
    if h[:4] == b"%PDF": return "pdf"
    if h[:3] == b"\xff\xd8\xff": return "jpg"
    if h[:8] == b"\x89PNG\r\n\x1a\n": return "png"
    if h[:4] == b"RIFF" and h[8:12] == b"WEBP": return "webp"
    return "bin"
def safe(s): return re.sub(r'[\\/:*?"<>|\n]+', " ", s).strip()[:60]
def money(x): return f"{x:,.2f}"

def is_pay(e): return e["grp"].startswith(("3.", "4.")) or e["cat"] in PAYCATS

# ── evidence bundle
EVDIR = OUTDIR + "หลักฐานรายจ่าย/"
if os.path.isdir(EVDIR): shutil.rmtree(EVDIR)
os.makedirs(EVDIR)
TMP = A + "tmpimg/"; os.makedirs(TMP, exist_ok=True)
writer = PdfWriter()
W, H = A4

def header_pdf(w, h, text, sub=None):
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(w, h))
    c.setFillColorRGB(1, 1, 1); c.setStrokeColorRGB(0.77, 0.12, 0.16)
    c.rect(8, h - 34, min(w - 16, 560), 28, fill=1, stroke=1)
    c.setFillColorRGB(0.77, 0.12, 0.16); c.setFont("TahomaB", 10); c.drawString(14, h - 19, text)
    if sub: c.setFillColorRGB(0.3, 0.3, 0.3); c.setFont("Tahoma", 7.5); c.drawString(14, h - 30, sub)
    c.save(); buf.seek(0); return PdfReader(buf).pages[0]

def add_image(path, text, sub):
    im = Image.open(path); im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((1700, 1700))
    tmp = TMP + f"{len(writer.pages)}.jpg"; im.save(tmp, "JPEG", quality=80)
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=A4)
    top = 46; m = 24
    bw, bh = W - 2 * m, H - top - m
    s = min(bw / im.width, bh / im.height)
    iw, ih = im.width * s, im.height * s
    c.drawImage(tmp, (W - iw) / 2, H - top - ih, iw, ih)
    c.save(); buf.seek(0)
    pg = PdfReader(buf).pages[0]; pg.merge_page(header_pdf(W, H, text, sub)); writer.add_page(pg)

def add_pdf(path, text, sub):
    rd = PdfReader(path)
    if rd.is_encrypted: rd.decrypt("")
    n = len(rd.pages)
    for i, p in enumerate(rd.pages, 1):
        w, h = float(p.mediabox.width), float(p.mediabox.height)
        if p.get("/Rotate", 0) in (90, 270): w, h = h, w; p.transfer_rotation_to_content()
        p.merge_page(header_pdf(w, h, text + (f"  · หน้า {i}/{n}" if n > 1 else ""), sub))
        writer.add_page(p)

def add_file(path, text, sub):
    k = kind(path); start = len(writer.pages) + 1
    if k == "pdf": add_pdf(path, text, sub)
    elif k in ("jpg", "png", "webp"): add_image(path, text, sub)
    return start, len(writer.pages), k

PAGES = {}; FILES = collections.defaultdict(list)
# A. substitute receipts (one PDF each; none in some months)
SRP = {}
for no, f in zip(SR_NOS, SR_FILES):
    s, e_, _ = add_file(f, f"ใบรับรองแทนใบเสร็จรับเงิน {no}", "ใช้เป็นหลักฐานของรายการที่ระบุเลข SR นี้ในรายงานรายจ่าย")
    SRP[no] = f"{s}" if s == e_ else f"{s}–{e_}"
    shutil.copy(f, EVDIR + f"00 ใบรับรองแทนใบเสร็จ {no}.pdf")
def srno(e):
    m = re.search(r"SR-\d{4}-\d{3}", e["det"] + " " + e["ev"])
    return m.group(0) if m else None
# B. per-expense evidence
for e in E:
    files = [a for a in ATT.get(e["id"], []) if not IS_SR_FILE(a["fn"])]
    if not files: continue
    first = None
    for k, a in enumerate(files, 1):
        text = f"E{e['seq']:03d}  ·  {be(e['d'])}  ·  ฿{money(e['amt'])}" + (f"  ·  ไฟล์ {k}/{len(files)}" if len(files) > 1 else "")
        sub = f"{e['payee']}  —  {e['cat']}"[:110]
        s, t, kd = add_file(a["path"], text, sub)
        first = first or s; last = t
        ext = {"jpg": "jpg", "png": "png", "webp": "webp", "pdf": "pdf"}.get(kd, "bin")
        nm = f"E{e['seq']:03d}-{k} {be(e['d']).replace('/', '-')} {safe(e['payee'])}.{ext}"
        shutil.copy(a["path"], EVDIR + nm); FILES[e["id"]].append(nm)
    PAGES[e["id"]] = f"{first}" if first == last else f"{first}–{last}"
# C. withholding certificates
CERTPAGES = {}
cfiles = {re.search(r"(\d{6})\.pdf$", f).group(1): f for f in os.listdir(CERT_DIR) if f.endswith(".pdf")}
for e in E:
    if e["cert"] and str(e["cert"]) in cfiles:
        f = cfiles[str(e["cert"])]
        s, t, _ = add_file(CERT_DIR + f, f"หนังสือรับรองการหักภาษี ณ ที่จ่าย เลขที่ {e['cert']}  ·  อ้างอิง E{e['seq']:03d}", e["payee"])
        CERTPAGES[e["id"]] = f"{s}" if s == t else f"{s}–{t}"
        shutil.copy(CERT_DIR + f, EVDIR + f"50ทวิ {e['cert']} (E{e['seq']:03d}) {safe(e['payee'])}.pdf")
writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
EVPDF = OUTDIR + f"2 หลักฐานรายจ่าย {SHORT} (รวมเล่ม).pdf"
with open(EVPDF, "wb") as f: writer.write(f)
print("evidence pages", len(writer.pages), "MB", round(os.path.getsize(EVPDF) / 1e6, 1))

# ── workbook
def evcell(e):
    if is_pay(e): return "รายงานเงินเดือน (ไฟล์ 3)"
    if srno(e):
        return "ใบรับรองแทนใบเสร็จ " + srno(e) + (" + สลิป/ไฟล์แนบ" if e["id"] in PAGES else "")
    return e["ev"]
def pages(e):
    p = []
    if srno(e) in SRP: p.append(f"{srno(e)}: {SRP[srno(e)]}")
    if e["id"] in PAGES: p.append(PAGES[e["id"]])
    if e["id"] in CERTPAGES: p.append(f"50ทวิ: {CERTPAGES[e['id']]}")
    return ", ".join(p)

wb = Workbook()
ws = wb.active; ws.title = "สรุปรายจ่าย"
r = title(ws, "รายงานรายจ่าย")
r = section(ws, r, "1. แยกตามกลุ่ม")
agg = lambda xs: [len(xs), sum(x["amt"] for x in xs), sum(x["vat"] for x in xs), sum(x["net"] for x in xs), sum(x["wht"] for x in xs), sum(x["paid"] for x in xs)]
groups = list(dict.fromkeys(e["grp"] for e in E))
r = table(ws, r, ["กลุ่ม", "จำนวนรายการ", "ยอดรวม (รวม VAT)", "VAT", "ก่อน VAT", "หัก ณ ที่จ่าย", "ยอดจ่ายจริง"],
          [[g] + agg([e for e in E if e["grp"] == g]) for g in groups], money=(3, 4, 5, 6, 7), ints=(2,), total=[2, 3, 4, 5, 6, 7],
          widths=[46, 12, 18, 14, 18, 14, 18])
r += 1
r = section(ws, r, "2. แยกตามหมวดรายจ่าย")
cats = sorted({e["cat"] for e in E}, key=lambda c: -sum(e["amt"] for e in E if e["cat"] == c))
r = table(ws, r, ["หมวด", "จำนวนรายการ", "ยอดรวม (รวม VAT)", "VAT", "ก่อน VAT", "หัก ณ ที่จ่าย", "ยอดจ่ายจริง"],
          [[c] + agg([e for e in E if e["cat"] == c]) for c in cats], money=(3, 4, 5, 6, 7), ints=(2,), total=[2, 3, 4, 5, 6, 7])
r += 1
r = section(ws, r, "3. แยกตามประเภทหลักฐาน")
evs = collections.Counter(); eva = collections.Counter()
for e in E: k = evcell(e); evs[k] += 1; eva[k] += e["amt"]
r = table(ws, r, ["หลักฐาน", "จำนวนรายการ", "ยอดรวม"], [[k, evs[k], eva[k]] for k in sorted(evs, key=lambda k: -eva[k])], money=(3,), ints=(2,), total=[2, 3])
r += 1
r = section(ws, r, "ไฟล์ที่ส่งมาด้วย")
for t in [
    f"• “2 หลักฐานรายจ่าย {SHORT} (รวมเล่ม).pdf” — หลักฐานทุกรายการเรียงตามเลข E### หัวกระดาษทุกหน้าระบุเลข E / วันที่ / ยอด · คอลัมน์ “หน้าในเล่มรวม” ในชีตรายการบอกเลขหน้า",
    *[f"• หน้า {SRP[n]} ของเล่มรวม = ใบรับรองแทนใบเสร็จรับเงิน {n} · ท้ายเล่ม = หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)" for n in SR_NOS],
    "• โฟลเดอร์ “หลักฐานรายจ่าย” — ไฟล์ต้นฉบับแยกรายการ ชื่อไฟล์ขึ้นต้นด้วยเลข E### เดียวกัน",
    f"• รายการเงินเดือน / ค่าตอบแทนพนักงาน ใช้ “3 รายงานเงินเดือน {SHORT}.xlsx” เป็นหลักฐาน",
    "• แถวสีเหลืองในชีตรายการ = มีข้อสังเกตที่ควรตรวจสอบ (ดูคอลัมน์ “ข้อสังเกต”)",
]: r = note(ws, r, t, 7, height=28)
page(ws, False)

ws = wb.create_sheet("รายการรายจ่าย")
r = title(ws, "รายการรายจ่ายทั้งหมดที่ส่งบัญชี (เรียงตามวันที่บันทึก)")
rows = [[f"E{e['seq']:03d}", e["d"], e["br"], e["payee"], e["legal"], e["tax"], e["cat"], e["det"][:300], e["doc"], e["docd"],
         e["amt"], e["vat"], e["net"], e["wht"], e["paid"], e["pm"], e["paidd"], evcell(e), pages(e), e["cert"], e["flag"]] for e in E]
r = table(ws, r, ["เลขอ้างอิง", "วันที่", "สาขา", "ผู้รับเงิน", "ชื่อตามเอกสาร", "เลขผู้เสียภาษี", "หมวด", "รายละเอียด", "เลขที่เอกสาร", "วันที่เอกสาร",
                  "ยอดรวม", "VAT", "ก่อน VAT", "หัก ณ ที่จ่าย", "ยอดจ่ายจริง", "วิธีจ่าย", "วันที่จ่าย", "หลักฐาน", "หน้าในเล่มรวม", "50 ทวิ", "ข้อสังเกต"],
          rows, money=(11, 12, 13, 14, 15), dates=(2, 10, 17), total=[11, 12, 13, 14, 15], wrap=(4, 5, 8, 18, 21), warn_col=21,
          widths=[9, 11, 10, 22, 24, 15, 18, 48, 13, 11, 13, 11, 13, 11, 13, 9, 11, 22, 13, 9, 36])
ws.freeze_panes = "B6"; ws.auto_filter.ref = f"A5:U{r-2}"
page(ws)

# input VAT
ws = wb.create_sheet("รายงานภาษีซื้อ")
r = title(ws, "รายงานภาษีซื้อ (รายการที่มี VAT)", f"เดือนภาษี {LABEL} · บริษัทจดทะเบียน VAT มีผล 13 ต.ค. 2569")
VAT_START = datetime.datetime.combine(VAT_START, datetime.time())
rows = []
for e in E:
    if not e["vat"]: continue
    why = []
    det = e["det"]
    has_ti = (("ใบกำกับ" in det or "e-Tax" in det) and not any(x in det for x in ("ไม่ใช่ใบกำกับ", "ยังไม่ได้รับใบกำกับ", "ยังไม่ใช่ใบกำกับ", "ไม่มีใบกำกับ"))) or str(e["doc"]).startswith("TI")
    if not has_ti:
        if "ใบแจ้งหนี้" in det or "วางบิล" in det: why.append("เอกสารเป็นใบแจ้งหนี้/ใบเสร็จ — ขอใบกำกับภาษีจากผู้ขาย")
        elif "ใบเสนอราคา" in det: why.append("มีแค่ใบเสนอราคา — รอใบกำกับภาษี")
        elif e["doc"]: why.append("ไม่แน่ใจว่าเป็นใบกำกับภาษี — ตรวจต้นฉบับ")
        else: why.append("ไม่มีใบกำกับภาษี (มีแค่สลิป/บิล)")
    if not e["tax"]: why.append("ไม่มีเลขผู้เสียภาษีผู้ขาย")
    dd = e["docd"] or e["d"]
    if dd and dd < VAT_START: why.append("เอกสารลงวันที่ก่อนจด VAT (13 ต.ค.)")
    rows.append([dd, e["doc"], e["legal"] or e["payee"], e["tax"], f"E{e['seq']:03d}", e["net"], e["vat"], e["amt"],
                 "มีใบกำกับภาษี" if not why else "ตรวจสอบ", " · ".join(why)])
rows.sort(key=lambda x: (x[8] != "มีใบกำกับภาษี", x[0]))
r = table(ws, r, ["วันที่ใบกำกับ", "เลขที่", "ชื่อผู้ขาย", "เลขผู้เสียภาษี", "อ้างอิง", "มูลค่า", "ภาษีซื้อ", "รวม", "สถานะ", "เหตุผลที่ต้องตรวจสอบ"],
          rows, money=(6, 7, 8), dates=(1,), total=[6, 7, 8], wrap=(3, 10), warn_col=10, widths=[12, 16, 34, 15, 9, 15, 13, 15, 10, 40])
ok = [x for x in rows if x[8] == "มีใบกำกับภาษี"]
r = note(ws, r + 1, f"มีใบกำกับภาษี {len(ok)} รายการ ภาษีซื้อ ฿{money(sum(x[6] for x in ok))} · ต้องตรวจสอบ {len(rows) - len(ok)} รายการ ภาษีซื้อ ฿{money(sum(x[6] for x in rows if x[8] != 'มีใบกำกับภาษี'))} — ใบกำกับภาษีต้องระบุชื่อ/ที่อยู่/เลขผู้เสียภาษีของบริษัท ผู้ตรวจสอบโปรดยืนยันกับต้นฉบับ", 10, height=30)
page(ws)

# WHT
ws = wb.create_sheet("หัก ณ ที่จ่าย")
r = title(ws, "รายการหักภาษี ณ ที่จ่าย (ภ.ง.ด.53)")
rows = [[f"E{e['seq']:03d}", e["cert"], e["legal"] or e["payee"], e["tax"], e["d"], e["paidd"], e["net"], round(e["wht"] / e["net"] * 100, 2) if e["net"] else "", e["wht"], CERTPAGES.get(e["id"], "")]
        for e in E if e["wht"]]
r = table(ws, r, ["อ้างอิง", "50 ทวิ เลขที่", "ผู้ถูกหักภาษี", "เลขผู้เสียภาษี", "วันที่บันทึก", "วันที่จ่าย", "เงินได้ (ก่อน VAT)", "อัตรา %", "ภาษีที่หัก", "หน้าในเล่มรวม"],
          rows, money=(7, 9), dates=(5, 6), total=[7, 9], wrap=(3,), widths=[9, 12, 34, 15, 12, 12, 17, 9, 13, 13])
r = note(ws, r + 1, "• ยื่น ภ.ง.ด.53 ตามเดือนที่จ่ายเงินจริง — รายการที่ “วันที่จ่าย” ว่าง ยังไม่ได้จ่าย ให้ยื่นในเดือนที่จ่าย", 10)
_wn = os.path.join(DATA, "wht_notes.txt")   # e.g. certificates issued now for next month's bills
if os.path.exists(_wn):
    for t in open(_wn, encoding="utf-8"):
        if t.strip(): r = note(ws, r, t.strip(), 10)
page(ws)

for _no in SR_NOS:
    ws = wb.create_sheet(_no)
    r = title(ws, f"รายการที่ใช้ใบรับรองแทนใบเสร็จรับเงิน เลขที่ {_no}")
    rows = [[f"E{e['seq']:03d}", e["d"], e["payee"], e["cat"], e["amt"], "มีสลิป/ไฟล์แนบ" if e["id"] in PAGES else "ไม่มี"] for e in E if srno(e) == _no]
    r = table(ws, r, ["อ้างอิง", "วันที่", "ผู้รับเงิน", "หมวด", "ยอด", "หลักฐานอื่น"], rows, money=(5,), dates=(2,), total=[5], widths=[9, 12, 34, 18, 13, 16])
    r = note(ws, r + 1, f"อยู่หน้า {SRP[_no]} ของเล่มรวม", 6)
    page(ws, False)

OUT = OUTDIR + f"2 รายงานรายจ่าย {SHORT}.xlsx"
wb.save(OUT)
print("saved", OUT, len(E), round(sum(e["amt"] for e in E), 2), "files", sum(len(v) for v in FILES.values()), "with evidence", len(PAGES))
