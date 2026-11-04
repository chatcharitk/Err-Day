import datetime, json, os, sys, re, subprocess
from config import *
from PIL import Image as PImage, ImageOps
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XImage
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.worksheet.page import PageMargins

S = DATA
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets") + "/"

# Trim the logo's white margin so it sits tight in the header.
im = PImage.open(ASSETS + "logo.png").convert("RGB")
bbox = ImageOps.invert(im).getbbox()
im = im.crop(bbox); im.thumbnail((400, 400)); im.save(S + "logo-trim.png")

RED = "C41E2A"; GREY = "666666"
FONT = "Tahoma"
def ft(size=12, bold=False, color="000000", italic=False): return Font(name=FONT, size=round(size * 0.85 * 2) / 2, bold=bold, color=color, italic=italic)
thin = Side(style="thin", color="999999"); dot = Side(style="dotted", color="888888"); redl = Side(style="medium", color=RED)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HEADFILL = PatternFill("solid", fgColor="F8E5E6")
NROWS = 15
DATEFMT = "[$-107041E]d/m/yyyy"  # Buddhist-era year (e.g. 31/10/2569)

def form(ws, example=None):
    widths = {"A": 6, "B": 13, "C": 36, "D": 24, "E": 15, "F": 17}
    for k, v in widths.items(): ws.column_dimensions[k].width = v
    # ── header
    logo = XImage(S + "logo-trim.png"); logo.height = 78; logo.width = int(78 * im.width / im.height)
    ws.add_image(logo, "A1")
    lines = [("บริษัท ออลกู๊ดเดย์ จำกัด (สำนักงานใหญ่)", ft(16, True)),
             ("ALL GOOD DAY CO., LTD. (Head Office)", ft(11, True, RED)),
             ("1392 ซอยบางนา-ตราด 27 แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260", ft(10, color=GREY)),
             ("เลขประจำตัวผู้เสียภาษี 0105569163998   โทร. 099-616-1465", ft(10, color=GREY))]
    for i, (t, f) in enumerate(lines, 1):
        ws.merge_cells(start_row=i, start_column=3, end_row=i, end_column=6)
        c = ws.cell(i, 3, t); c.font = f; c.alignment = Alignment(vertical="center")
    for r, h in zip(range(1, 5), [24, 17, 16, 16]): ws.row_dimensions[r].height = h
    for col in range(1, 7): ws.cell(5, col).border = Border(bottom=redl)
    ws.row_dimensions[5].height = 6
    # ── title
    ws.merge_cells("A7:F7"); c = ws["A7"]; c.value = "ใบรับรองแทนใบเสร็จรับเงิน"; c.font = ft(20, True); c.alignment = Alignment(horizontal="center")
    ws.merge_cells("A8:F8"); c = ws["A8"]; c.value = "SUBSTITUTE RECEIPT"; c.font = ft(9, color=GREY); c.alignment = Alignment(horizontal="center")
    ws.row_dimensions[7].height = 30
    # ── number / date / branch
    ws["E10"] = "เลขที่"; ws["E11"] = "วันที่"
    for a in ("E10", "E11"): ws[a].font = ft(12, True); ws[a].alignment = Alignment(horizontal="right")
    for a in ("F10", "F11"): ws[a].border = Border(bottom=dot); ws[a].font = ft(12); ws[a].alignment = Alignment(horizontal="center")
    ws["F11"].number_format = DATEFMT
    # ── table
    hdr = ["ลำดับ", "วัน เดือน ปี", "รายละเอียดรายจ่าย", "ผู้รับเงิน / ร้านค้า", "จำนวนเงิน (บาท)", "หมายเหตุ"]
    T = 13
    for i, h in enumerate(hdr, 1):
        c = ws.cell(T, i, h); c.font = ft(12, True); c.fill = HEADFILL; c.border = BOX
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[T].height = 24
    first, last = T + 1, T + NROWS
    for k in range(NROWS):
        r = first + k
        ws.cell(r, 1, k + 1)
        for col in range(1, 7):
            c = ws.cell(r, col); c.border = BOX; c.font = ft(12)
            c.alignment = Alignment(vertical="center", horizontal="center" if col in (1, 2) else None, wrap_text=col in (3, 4, 6), indent=0 if col in (1, 2) else 1)
        ws.cell(r, 2).number_format = DATEFMT
        ws.cell(r, 5).number_format = '#,##0.00;-#,##0.00;""'
        ws.row_dimensions[r].height = 21
    tot = last + 1
    ws.merge_cells(start_row=tot, start_column=1, end_row=tot, end_column=3)
    # LibreOffice has no BAHTTEXT (shows Err:509), so a filled form gets static Thai words; the blank form keeps the formula
    words = example.get("words") if example else None
    c = ws.cell(tot, 1, f"( {words} )" if words else f'=IFERROR(IF(E{tot}=0,"","( "&BAHTTEXT(E{tot})&" )"),"")'); c.font = ft(12, True); c.alignment = Alignment(horizontal="center", vertical="center")
    c = ws.cell(tot, 4, "รวมทั้งสิ้น"); c.font = ft(12, True); c.alignment = Alignment(horizontal="right", vertical="center")
    c = ws.cell(tot, 5, f"=SUM(E{first}:E{last})"); c.font = ft(12, True); c.number_format = '#,##0.00;-#,##0.00;""'; c.alignment = Alignment(vertical="center", indent=1)
    for col in range(1, 7):
        ws.cell(tot, col).border = BOX; ws.cell(tot, col).fill = HEADFILL
    ws.row_dimensions[tot].height = 24
    # ── certification
    r = tot + 2
    ws.cell(r, 1, "ข้าพเจ้า").font = ft(12)
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    ws.cell(r, 4, "ตำแหน่ง").font = ft(12); ws.cell(r, 4).alignment = Alignment(horizontal="right")
    ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
    for col in (2, 3, 5, 6): ws.cell(r, col).border = Border(bottom=dot)
    ws.cell(r, 2).font = ft(12); ws.cell(r, 5).font = ft(12)
    ws.cell(r, 2).alignment = Alignment(horizontal="center"); ws.cell(r, 5).alignment = Alignment(horizontal="center")
    name_row = r
    r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    c = ws.cell(r, 1, "ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับเงินได้ และข้าพเจ้าได้จ่ายไปในงานของบริษัท ออลกู๊ดเดย์ จำกัด โดยแท้")
    c.font = ft(12); c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 22
    r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
    ws.cell(r, 1, "ตั้งแต่วันที่").font = ft(12)
    ws.cell(r, 3, f'=IF(COUNT(B{first}:B{last})=0,"",MIN(B{first}:B{last}))')
    ws.cell(r, 4, "ถึงวันที่").font = ft(12); ws.cell(r, 4).alignment = Alignment(horizontal="right")
    ws.cell(r, 5, f'=IF(COUNT(B{first}:B{last})=0,"",MAX(B{first}:B{last}))')
    ws.row_dimensions[r].height = 22
    for col in (3, 5):
        c = ws.cell(r, col); c.number_format = DATEFMT; c.font = ft(12); c.border = Border(bottom=dot); c.alignment = Alignment(horizontal="center")
    ws.cell(r, 1).alignment = Alignment(horizontal="left")
    # ── signatures
    r += 3
    sig_rows = [("ลงชื่อ ......................................................", "ลงชื่อ ......................................................"),
                ("(......................................................)", "(......................................................)"),
                ("ผู้เบิกจ่าย", "ผู้อนุมัติ"),
                ("วันที่ ........ / ........ / ........", "วันที่ ........ / ........ / ........")]
    for i, (L, R) in enumerate(sig_rows):
        ws.merge_cells(start_row=r + i, start_column=1, end_row=r + i, end_column=3)
        ws.merge_cells(start_row=r + i, start_column=4, end_row=r + i, end_column=6)
        for col, t in ((1, L), (4, R)):
            c = ws.cell(r + i, col, t); c.font = ft(12, bold=(i == 2)); c.alignment = Alignment(horizontal="center")
        ws.row_dimensions[r + i].height = 22
    sig_name_row = r + 1
    # ── note
    r += 6
    ws.merge_cells(start_row=r, start_column=1, end_row=r + 1, end_column=6)
    c = ws.cell(r, 1, "(หมายเหตุ  เอกสารตัวอย่างเพื่อใช้ประกอบความเข้าใจเท่านั้น อาจต้องปรับเปลี่ยนเพื่อให้เหมาะสมกับกิจการของท่าน)")
    c.font = ft(9, color=GREY); c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 14; ws.row_dimensions[r + 1].height = 14
    # ── print setup
    ws.print_area = f"A1:F{r + 1}"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4; ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 1; ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.5, bottom=0.5)
    ws.print_options.horizontalCentered = True
    ws.sheet_view.showGridLines = False
    if example:
        ws["F10"] = example["no"]; ws["F11"] = example["date"]
        for k, row in enumerate(example["rows"]):
            for col, v in zip(range(2, 7), row): ws.cell(first + k, col, v)
        ws.cell(name_row, 2, example["payer"]); ws.cell(name_row, 5, example["position"])


# ── Fill the form from a JSON spec:  python3 substitute_receipt.py spec.json
# spec = {"no": "SR-6911-001", "date": "2026-11-30", "payer": "นางสาว ศิรัญญา แซ่โค้ว", "position": "",
#         "approver": "นาย ชัชฤทธิ์ เกียรติศักดิ์ศรี", "signed": true,
#         "rows": [["2026-11-03", "รายละเอียด", "ผู้รับเงิน", 763, "หมายเหตุ"], ...]}
def bahttext(n):
    D = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]; P = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]
    def say(x):
        if x == 0: return ""
        if x >= 1_000_000: return say(x // 1_000_000) + "ล้าน" + say(x % 1_000_000)
        out = ""; ds = str(x)[::-1]
        for i in range(len(ds) - 1, -1, -1):
            d = int(ds[i])
            if d == 0: continue
            if i == 1 and d == 1: out += "สิบ"
            elif i == 1 and d == 2: out += "ยี่สิบ"
            elif i == 0 and d == 1 and len(ds) > 1 and int(ds[1:][::-1] or 0) > 0: out += "เอ็ด"
            else: out += D[d] + P[i]
        return out
    b = int(n); st = round((n - b) * 100)
    return (say(b) + "บาท" if b else "") + ("ถ้วน" if st == 0 else say(st) + "สตางค์")

if __name__ == "__main__":
    from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
    from openpyxl.drawing.xdr import XDRPositiveSize2D
    from openpyxl.utils.units import pixels_to_EMU
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    d = lambda x: datetime.datetime.fromisoformat(x)
    rows = [(d(r[0]), r[1], r[2], r[3], r[4]) for r in spec["rows"]]
    total = sum(r[3] for r in rows)
    wb = Workbook(); ws = wb.active; ws.title = spec["no"]
    form(ws, {"no": spec["no"], "date": d(spec["date"]), "rows": rows, "payer": spec["payer"], "position": spec.get("position", ""), "words": bahttext(total)})
    srow = next(r for r in range(30, 60) if ws.cell(r, 1).value and str(ws.cell(r, 1).value).startswith("ลงชื่อ"))
    ws.cell(srow + 1, 1).value = f"( {spec['payer']} )"
    if spec.get("approver"): ws.cell(srow + 1, 4).value = f"( {spec['approver']} )"
    sd = d(spec["date"]); dtxt = f"วันที่  {sd.day:02d} / {sd.month:02d} / {sd.year + 543}"
    for col in (1, 4): ws.cell(srow + 3, col).value = dtxt
    if spec.get("signed", False):   # signature PNGs live in scripts/withholding/private (gitignored)
        for f, col, off in (("sig-siranya.png", 2, 10), ("sig-chatcharit.png", 3, 140)):
            pim = PImage.open(SIGDIR + f); h = 48; w = int(h * pim.width / pim.height)
            img = XImage(SIGDIR + f); img.height = h; img.width = w
            img.anchor = OneCellAnchor(_from=AnchorMarker(col=col, colOff=pixels_to_EMU(off), row=srow - 2, rowOff=pixels_to_EMU(4)),
                                       ext=XDRPositiveSize2D(pixels_to_EMU(w), pixels_to_EMU(h)))
            ws.add_image(img)
    os.makedirs(OUTROOT, exist_ok=True)
    out = f"{OUTROOT}ใบรับรองแทนใบเสร็จ {SHORT} ({spec['no']}).xlsx"
    wb.save(out)
    subprocess.run(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "--headless", "--convert-to", "pdf", out, "--outdir", OUTROOT],
                   env={**os.environ, "FONTCONFIG_FILE": APP + "scripts/office/fonts.conf"}, capture_output=True)
    print("saved", out, "total", total, bahttext(total))
