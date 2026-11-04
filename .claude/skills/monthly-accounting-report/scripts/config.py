"""Month configuration shared by every script. Set ACCT_MONTH=YYYY-MM (e.g. 2026-11)."""
import os, calendar, datetime

MONTH = os.environ.get("ACCT_MONTH")
if not MONTH:
    raise SystemExit("set ACCT_MONTH=YYYY-MM first, e.g.  ACCT_MONTH=2026-11 python3 build_workbook.py")
Y, M = (int(x) for x in MONTH.split("-"))
TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
LAST = calendar.monthrange(Y, M)[1]
LABEL = f"{TH_MONTH[M-1]} {Y+543}"            # ตุลาคม 2569
SHORT = f"{TH_SHORT[M-1]} {Y+543}"            # ต.ค. 2569
LABEL_EN = f"{TH_SHORT[M-1]} {Y}"             # ต.ค. 2026
FIRST = datetime.date(Y, M, 1)
NEXT = datetime.date(Y + (M == 12), M % 12 + 1, 1)
VAT_START = datetime.date(2026, 10, 13)       # VAT registration took effect 13 Oct 2026
TODAY = datetime.date.today()

# data pulled from the database (TSV files) and scratch space
DATA = os.environ.get("ACCT_DATA", f"/tmp/err-day-accounting/{MONTH}/")
os.makedirs(DATA, exist_ok=True)
OUTROOT = os.environ.get("ACCT_OUT", "/Users/chatcharit/Err Day App/outputs/")
PKG = f"{OUTROOT}ส่งบัญชี {SHORT}/"           # the clean package for the accountants
APP = "/Users/chatcharit/Err Day App/errday-booking/"
SIGDIR = APP + "scripts/withholding/private/"
