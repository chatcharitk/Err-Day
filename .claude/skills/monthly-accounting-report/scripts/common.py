import datetime
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from config import *
A = DATA
OUTDIR = PKG
PICKED = DATA + "picked.xlsx"   # the selection workbook the owner sent back
os.makedirs(OUTDIR, exist_ok=True)
CO = "บริษัท ออลกู๊ดเดย์ จำกัด (สำนักงานใหญ่)  เลขประจำตัวผู้เสียภาษี 0105569163998"
PERIOD = f"ประจำเดือน {LABEL} (1–{LAST} {TH_SHORT[M-1]} {Y+543})"

FONT = "Tahoma"
def ft(size=10, bold=False, color="000000", italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)
thin = Side(style="thin", color="BBBBBB")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HEAD = PatternFill("solid", fgColor="F8E5E6")
TOT = PatternFill("solid", fgColor="F2F2F2")
WARN = PatternFill("solid", fgColor="FFF4CC")
RED = "C41E2A"
MONEY = '#,##0.00;-#,##0.00;"-"'
INT = '#,##0;-#,##0;"-"'
DATE = "dd/mm/yyyy"

def title(ws, text, sub=None, ncols=8):
    ws["A1"] = text; ws["A1"].font = ft(14, True, RED)
    ws["A2"] = CO; ws["A2"].font = ft(10, True)
    ws["A3"] = sub or PERIOD; ws["A3"].font = ft(10, color="555555")
    ws.sheet_view.showGridLines = False
    return 5

def table(ws, r0, headers, rows, money=(), ints=(), dates=(), widths=None, total=None, wrap=(), warn_col=None, total_label="รวม"):
    """Write a styled table; returns the row after the table. total = list of column indexes (1-based) to SUM."""
    for i, h in enumerate(headers, 1):
        c = ws.cell(r0, i, h); c.font = ft(10, True); c.fill = HEAD; c.border = BOX
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[r0].height = 30
    r = r0 + 1
    for row in rows:
        for i, v in enumerate(row, 1):
            c = ws.cell(r, i, v); c.font = ft(10); c.border = BOX
            c.alignment = Alignment(vertical="top", wrap_text=i in wrap)
            if i in money: c.number_format = MONEY
            elif i in ints: c.number_format = INT
            elif i in dates: c.number_format = DATE; c.alignment = Alignment(horizontal="center", vertical="top")
        if warn_col and row[warn_col - 1]:
            for i in range(1, len(headers) + 1): ws.cell(r, i).fill = WARN
        r += 1
    if total:
        first, last = r0 + 1, r - 1
        lab = min(set(range(1, len(headers) + 1)) - set(total))
        ws.cell(r, lab, total_label)
        for i in total:
            L = get_column_letter(i)
            ws.cell(r, i, f"=SUM({L}{first}:{L}{last})" if last >= first else 0)
            ws.cell(r, i).number_format = MONEY if i in money else INT
        for i in range(1, len(headers) + 1):
            c = ws.cell(r, i); c.font = ft(10, True); c.fill = TOT; c.border = BOX
        r += 1
    if widths:
        for i, w in enumerate(widths, 1):
            if w: ws.column_dimensions[get_column_letter(i)].width = w
    return r

def note(ws, r, text, ncols=8, color="555555", bold=False, height=None):
    ws.cell(r, 1, text).font = ft(9.5, bold, color)
    ws.cell(r, 1).alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncols)
    if height: ws.row_dimensions[r].height = height
    return r + 1

def section(ws, r, text):
    ws.cell(r, 1, text).font = ft(11, True)
    return r + 1

def page(ws, landscape=True):
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = None

def be(d):  # datetime -> Buddhist-era string
    return f"{d.day:02d}/{d.month:02d}/{d.year + 543}" if d else ""
