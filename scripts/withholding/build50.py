#!/usr/bin/env python3
"""
Fill the Revenue Department's 50 ทวิ (withholding-tax certificate) form.

Reads one JSON job from argv[1] and writes a flat, print-ready PDF. Thai text is
laid out by Chrome (proper tone-mark/vowel shaping) and merged onto the blank
form; the AcroForm fields are removed so it prints exactly as shown.
Called by scripts/gen-50tawi.ts, which owns the numbering (เล่มที่ / เลขที่).
"""
import glob, json, os, subprocess, sys, html, tempfile
import pypdf

job = json.load(open(sys.argv[1]))
HERE = os.path.dirname(os.path.abspath(__file__))
BLANK = os.path.join(HERE, "50tawi-blank.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAYER, PAYEE = job["payer"], job["payee"]
PAY_DATE = job.get("payDate") or ""
PAID_BAHT, PAID_SATANG = job["paidBaht"], job["paidSatang"]
TAX_BAHT, TAX_SATANG = job["taxBaht"], job["taxSatang"]
TAX_WORDS = job["words"]
BOOK_NO, RUN_NO = str(job["bookNo"]), str(job["runNo"])
OUT = job["out"]
H = 842.0
items = []
def box(x1, y1, x2, y2, text, size=10.5, align="left", bottom=1.0, weight="normal", pad=2):
    """Text in a PDF-coordinate rect (origin bottom-left), sitting on the rect's bottom edge."""
    items.append(f'<div class="b" style="left:{x1}pt;top:{H-y2}pt;width:{x2-x1}pt;height:{y2-y1}pt;'
                 f'justify-content:{ {"left":"flex-start","right":"flex-end","center":"center"}[align] };'
                 f'padding:0 {pad}pt {bottom}pt {pad}pt;font-size:{size}pt;font-weight:{weight}">{html.escape(text)}</div>')
def tick(x1, y1, x2, y2):
    w, h = x2 - x1, y2 - y1
    items.append(f'<svg class="b" style="left:{x1}pt;top:{H-y2}pt;width:{w}pt;height:{h}pt" viewBox="0 0 {w} {h}">'
                 f'<polyline points="{w*0.18},{h*0.55} {w*0.42},{h*0.82} {w*0.86},{h*0.18}" fill="none" stroke="#000" stroke-width="1.6"/></svg>')
def digits(cx_list, yc, text, size=11):
    for cx, d in zip(cx_list, text):
        items.append(f'<div class="b" style="left:{cx-5}pt;top:{H-yc-7}pt;width:10pt;height:14pt;justify-content:center;font-size:{size}pt;font-family:Tahoma,Arial">{d}</div>')
CX = [380.4, 398.9, 410.4, 422.4, 434.5, 453.1, 464.9, 476.9, 489.0, 501.6, 519.5, 531.9, 550.7]
DX = 1.0  # payee row sits ~0.4pt to the right
# เล่มที่ / เลขที่ (running number)
box(519, 781, 559, 797, BOOK_NO, size=10.5, bottom=2)
box(519, 765, 560, 781, RUN_NO, size=10.5, bottom=2)
# parties
box(54, 729, 316, 745, PAYER["name"]);  box(61, 706, 550, 722, PAYER["addr"], size=10)
digits(CX, 751.4, PAYER["tax"])
box(53, 658, 315, 671, PAYEE["name"]);  box(59, 627, 550, 643, PAYEE["addr"], size=10, bottom=4.5)
digits([c + 0.4 for c in CX], 682.8, PAYEE["tax"])
# form type: ภ.ง.ด.53
tick(395, 584, 407, 597)
# money columns (baht | satang split at x=475 for "paid", 546.4 for "tax")
def money(y1, y2, baht, satang, kind):
    if kind == "pay":  box(405.5, y1, 474.5, y2, baht, align="right", pad=2.5, size=10.5, bottom=1.2); box(475.5, y1, 489.5, y2, satang, align="center", pad=0, size=9.5, bottom=1.2)
    else:              box(490.5, y1, 546, y2, baht, align="right", pad=2.5, size=10.5, bottom=1.2);   box(547, y1, 560, y2, satang, align="center", pad=0, size=9.5, bottom=1.2)
# row 5 (ค่าจ้างทำของ / ค่าบริการ ... ตามมาตรา 3 เตรส)
if PAY_DATE: box(327.5, 216, 404.5, 230, PAY_DATE, size=9.5, align="center", pad=0, bottom=1.2)
money(216, 230, PAID_BAHT, PAID_SATANG, "pay"); money(216, 230, TAX_BAHT, TAX_SATANG, "tax")
# totals
money(180, 196, PAID_BAHT, PAID_SATANG, "pay"); money(180, 196, TAX_BAHT, TAX_SATANG, "tax")
box(185, 158, 558, 177, TAX_WORDS, size=11, align="center", bottom=3)
# ผู้จ่ายเงิน (1) หัก ณ ที่จ่าย
tick(82, 119, 94, 131)
# Directors' signatures on the "ลงชื่อ …… ผู้จ่ายเงิน" line. Transparent PNGs kept only on
# this machine (scripts/withholding/private/ is gitignored — the repo is public).
SIGS = sorted(glob.glob(os.path.join(HERE, "private", "sig-*.png")))
if SIGS:
    imgs = "".join(f'<img src="file://{html.escape(f)}" style="height:21pt;max-width:58pt;object-fit:contain">' for f in SIGS)
    items.append(f'<div class="b" style="left:350pt;top:{H-105}pt;width:126pt;height:22pt;justify-content:center;gap:6pt">{imgs}</div>')

page = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: 595pt 842pt; margin: 0 }}
html,body {{ margin:0; padding:0; width:595pt; height:842pt; }}
body {{ position:relative; font-family:"Thonburi","Tahoma","Ayuthaya",sans-serif; color:#0a2a8a; }}
.b {{ position:absolute; display:flex; align-items:flex-end; white-space:nowrap; box-sizing:border-box; line-height:1.15; }}
svg.b {{ display:block; color:#0a2a8a }}
</style></head><body>{''.join(items)}</body></html>'''
tmp = tempfile.mkdtemp()
html_path, ov_path = os.path.join(tmp, "overlay.html"), os.path.join(tmp, "overlay.pdf")
open(html_path, "w").write(page)
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={ov_path}", "file://" + html_path], check=True, capture_output=True)
ov = pypdf.PdfReader(ov_path)
w = pypdf.PdfWriter(clone_from=pypdf.PdfReader(BLANK))
pg = w.pages[0]
pg.merge_page(ov.pages[0])
if "/Annots" in pg: del pg["/Annots"]
if "/AcroForm" in w._root_object: del w._root_object["/AcroForm"]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
w.write(OUT)
print("wrote", OUT)
