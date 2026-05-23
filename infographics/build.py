"""
Generate three customer-facing infographic PDFs (Thai) for err.day with
phone screenshots embedded next to each step.

Layout per step card:
    ┌─────────────────────────────────────────────┐
    │  ① │  Step title              │              │
    │    │  Body / description      │  [phone]    │
    └─────────────────────────────────────────────┘

Steps without a screenshot (e.g. LINE OA / Rich Menu actions that happen
inside the LINE app itself) show a soft LINE-themed placeholder.
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

# ── Fonts ─────────────────────────────────────────────────────────────────────
SUKHUMVIT_TTC = "/System/Library/Fonts/Supplemental/SukhumvitSet.ttc"
pdfmetrics.registerFont(TTFont("Sukhumvit",      SUKHUMVIT_TTC, subfontIndex=1))  # Text
pdfmetrics.registerFont(TTFont("Sukhumvit-Bold", SUKHUMVIT_TTC, subfontIndex=4))  # Bold

# ── Brand palette ─────────────────────────────────────────────────────────────
PRIMARY     = (139/255,  29/255,  36/255)   # #8B1D24
TEXT        = ( 59/255,  42/255,  36/255)
MUTED       = (160/255, 128/255, 112/255)
BG_BEIGE    = (253/255, 248/255, 243/255)
CARD_BG     = (255/255, 255/255, 255/255)
CARD_BG_ALT = (255/255, 248/255, 244/255)
BORDER      = (232/255, 216/255, 204/255)
ACCENT      = (197/255, 115/255,  74/255)
LINE_GREEN  = (  6/255, 199/255,  85/255)

A4_W, A4_H = A4
HERE = Path(__file__).parent
SHOTS = HERE / "screenshots"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _draw_step_circle(c, cx, cy, n, *, diameter=34):
    c.setFillColorRGB(*PRIMARY, alpha=1)
    c.setStrokeColorRGB(*PRIMARY, alpha=1)
    c.circle(cx, cy, diameter / 2, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1, alpha=1)
    c.setFont("Sukhumvit-Bold", 17)
    c.drawCentredString(cx, cy - 6, str(n))


def _draw_line_placeholder(c, x, y, w, h):
    """Soft green LINE-themed badge for steps that happen inside the LINE app."""
    c.saveState()
    c.setFillColorRGB(*LINE_GREEN, alpha=0.08)
    c.setStrokeColorRGB(*LINE_GREEN, alpha=0.4)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 8, stroke=1, fill=1)
    # LINE chat-bubble glyph: rounded square with a "tail"
    bx = x + w / 2 - 14
    by = y + h / 2 - 4
    c.setFillColorRGB(*LINE_GREEN, alpha=0.85)
    c.setStrokeColorRGB(*LINE_GREEN, alpha=0)
    c.roundRect(bx, by, 28, 22, 5, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1, alpha=1)
    c.setFont("Sukhumvit-Bold", 9)
    c.drawCentredString(bx + 14, by + 7, "LINE")
    # Label below
    c.setFillColorRGB(*LINE_GREEN, alpha=0.9)
    c.setFont("Sukhumvit", 7)
    c.drawCentredString(x + w / 2, y + 8, "ทำใน LINE")
    c.restoreState()


def _draw_image_thumbnail(c, x, y, w, h, image_path):
    """Phone-shaped screenshot with rounded corners + soft border."""
    c.saveState()
    # Border / frame
    c.setFillColorRGB(1, 1, 1, alpha=1)
    c.setStrokeColorRGB(*BORDER, alpha=1)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    # Inset image
    pad = 2
    img = ImageReader(image_path)
    c.drawImage(img, x + pad, y + pad, w - 2 * pad, h - 2 * pad,
                preserveAspectRatio=True, mask="auto", anchor="n")
    c.restoreState()


def render_infographic(*, out_path, title, subtitle, steps, footer_note=None):
    """
    steps: list of dicts with keys
        title   — bold heading
        body    — descriptive lines, can include "\n"
        image   — optional path to PNG screenshot (relative to SHOTS)
                  if absent OR file missing, the LINE-themed placeholder is used
    """
    c = canvas.Canvas(out_path, pagesize=A4)

    # ── Background ─────────────────────────────────────────────────────────
    c.setFillColorRGB(*BG_BEIGE)
    c.rect(0, 0, A4_W, A4_H, stroke=0, fill=1)

    # ── Header ─────────────────────────────────────────────────────────────
    header_h = 110
    c.setFillColorRGB(*PRIMARY)
    c.rect(0, A4_H - header_h, A4_W, header_h, stroke=0, fill=1)

    c.setFillColorRGB(1, 1, 1, alpha=1)
    c.setFont("Sukhumvit-Bold", 11)
    c.drawString(40, A4_H - 28, "err.day")
    c.setFillColorRGB(1, 1, 1, alpha=0.65)
    c.setFont("Sukhumvit", 8)
    c.drawString(40, A4_H - 40, "ERR EVERY DAY BEAUTY SALON")

    c.setFillColorRGB(1, 1, 1, alpha=1)
    c.setFont("Sukhumvit-Bold", 22)
    c.drawString(40, A4_H - 70, title)
    c.setFillColorRGB(1, 1, 1, alpha=0.85)
    c.setFont("Sukhumvit", 11)
    c.drawString(40, A4_H - 88, subtitle)

    # Accent line
    c.saveState()
    c.setFillColorRGB(*ACCENT, alpha=0.85)
    c.rect(40, A4_H - header_h - 6, 36, 3, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1, alpha=0.9)
    c.rect(80, A4_H - header_h - 6, 14, 3, stroke=0, fill=1)
    c.restoreState()

    # ── Steps area ─────────────────────────────────────────────────────────
    n_steps = len(steps)
    footer_h = 70 if footer_note else 50
    avail_h  = (A4_H - header_h) - footer_h - 25
    card_gap = 6
    card_h   = (avail_h - (n_steps - 1) * card_gap) / n_steps
    card_h   = min(card_h, 100)  # max card height

    y = A4_H - header_h - 25
    x_card   = 40
    card_w   = A4_W - 80
    circle_d = 30

    # Image column on the right of each card — phone proportion (~9:19.5)
    img_w = 58
    img_h = card_h - 12  # leave 6pt padding top/bottom
    img_x = x_card + card_w - img_w - 10

    # Text column to the left of the image
    text_x = x_card + 16 + circle_d + 12
    text_max_w = img_x - text_x - 10

    for i, step in enumerate(steps, start=1):
        y -= card_h
        c.saveState()

        # Card background
        is_alt = i % 2 == 0
        c.setFillColorRGB(*(CARD_BG_ALT if is_alt else CARD_BG))
        c.setStrokeColorRGB(*BORDER)
        c.setLineWidth(0.8)
        c.roundRect(x_card, y, card_w, card_h, 10, stroke=1, fill=1)

        # Numbered circle
        cx = x_card + 16 + circle_d / 2
        cy = y + card_h / 2
        _draw_step_circle(c, cx, cy, i, diameter=circle_d)

        # Title
        c.setFillColorRGB(*TEXT)
        c.setFont("Sukhumvit-Bold", 11.5)
        c.drawString(text_x, y + card_h - 20, step["title"])

        # Body
        c.setFillColorRGB(*MUTED)
        c.setFont("Sukhumvit", 9)
        body_lines = step.get("body", "").split("\n")
        line_y = y + card_h - 34
        for ln in body_lines[:3]:
            c.drawString(text_x, line_y, ln)
            line_y -= 11

        c.restoreState()

        # Image column
        img_rel = step.get("image")
        img_full = (SHOTS / img_rel) if img_rel else None
        if img_full and img_full.exists():
            _draw_image_thumbnail(c, img_x, y + 6, img_w, img_h, str(img_full))
        else:
            _draw_line_placeholder(c, img_x, y + 6, img_w, img_h)

        # Connector dot between cards
        if i < n_steps:
            c.saveState()
            c.setFillColorRGB(*PRIMARY, alpha=0.35)
            c.circle(cx, y - card_gap / 2, 1.5, stroke=0, fill=1)
            c.restoreState()

        y -= card_gap

    # ── Footer ─────────────────────────────────────────────────────────────
    foot_y = 30
    if footer_note:
        c.saveState()
        c.setFillColorRGB(255/255, 240/255, 232/255)
        c.setStrokeColorRGB(*PRIMARY)
        c.setLineWidth(1)
        c.roundRect(40, foot_y + 16, A4_W - 80, 28, 7, stroke=1, fill=1)
        c.setFillColorRGB(*PRIMARY)
        c.setFont("Sukhumvit-Bold", 10)
        c.drawCentredString(A4_W / 2, foot_y + 26, footer_note)
        c.restoreState()

    c.setFillColorRGB(*MUTED)
    c.setFont("Sukhumvit", 9)
    c.drawCentredString(A4_W / 2, foot_y, "err.day  ·  สาขาสุขุมวิท  ·  สาขาบางนา  ·  เปิดทุกวัน")

    c.save()


# ── Content ──────────────────────────────────────────────────────────────────

INFOGRAPHIC_1 = dict(
    out_path="01-วิธีจองคิว.pdf",
    title="วิธีจองคิว err.day",
    subtitle="จองง่าย ในไม่กี่ขั้นตอน  ·  How to Book",
    steps=[
        {"title": "เพิ่มเพื่อนใน LINE OA",
         "body": "ค้นหา @err.daysalon  หรือสแกน QR ที่หน้าร้าน"},
        {"title": "แตะ “จองคิว” บนเมนู LINE",
         "body": "เมนูจะเปิดหน้าจองอัตโนมัติ"},
        {"title": "เข้าสู่ระบบเพื่อเริ่มจอง",
         "body": "ปุ่ม LINE = สะดวกที่สุด  ระบบจะจำคุณไว้",
         "image": "01-book-login.png"},
        {"title": "เลือกสาขา",
         "body": "สาขาสุขุมวิท  หรือ  สาขาบางนา",
         "image": "02-book-branches.png"},
        {"title": "เลือกบริการ",
         "body": "สระไดร์ · ทำสี · ดัด · ทรีตเมนต์",
         "image": "03-book-services.png"},
        {"title": "เลือกบริการเสริม + วันเวลา",
         "body": "บริการเสริม → วันที่ → เวลา ที่ยังว่าง",
         "image": "05-book-customer-info.png"},
        {"title": "รับการยืนยันผ่าน LINE",
         "body": "เห็นการจองได้ที่เมนู “การจองของฉัน”"},
    ],
    footer_note="กรุณามาก่อนเวลานัด 5–10 นาที  เพื่อให้บริการได้เต็มเวลา",
)

INFOGRAPHIC_2 = dict(
    out_path="02-วิธีสมัครสมาชิก.pdf",
    title="วิธีสมัครสมาชิก err.day",
    subtitle="รับส่วนลดและสิทธิพิเศษเฉพาะสมาชิก  ·  Member Sign-up",
    steps=[
        {"title": "เปิด LINE OA “err.day”",
         "body": "ค้นหา @err.daysalon  หรือสแกน QR ที่หน้าร้าน"},
        {"title": "แตะเมนู “สมัครสมาชิก”",
         "body": "ระบบจะพาเข้าหน้าสมัครผ่าน LINE LIFF"},
        {"title": "เข้าสู่ระบบด้วย LINE",
         "body": "อนุญาตให้แอปอ่านชื่อและรูปโปรไฟล์  (ปลอดภัย)"},
        {"title": "กรอกข้อมูลส่วนตัว",
         "body": "ชื่อ · ชื่อเล่น · เบอร์ · วันเกิด · เพศ"},
        {"title": "ยอมรับนโยบายความเป็นส่วนตัว",
         "body": "อ่านและยอมรับนโยบาย PDPA ก่อนยืนยัน"},
        {"title": "ชำระค่าสมาชิกที่หน้าร้าน",
         "body": "เงินสด · โอน · บัตร  แจ้งพนักงานเพื่อบันทึก"},
        {"title": "ตรวจสอบสถานะสมาชิกได้ตลอดเวลา",
         "body": "เข้า LINE → “สมาชิก”  ดูวันหมดอายุและสิทธิ์ที่ใช้ได้",
         "image": "06-membership-lookup.png"},
    ],
    footer_note="สมาชิกได้ราคาพิเศษทุกครั้งที่ใช้บริการ · ไม่มีบัตรพลาสติก ใช้ผ่านระบบเลย",
)

INFOGRAPHIC_3 = dict(
    out_path="03-วิธีเปลี่ยนหรือยกเลิกการจอง.pdf",
    title="วิธีเปลี่ยน / ยกเลิกการจอง",
    subtitle="แจ้งร้านล่วงหน้า เพื่อการบริการที่ดีที่สุด  ·  Reschedule & Cancel",
    steps=[
        {"title": "เปิด LINE → “การจองของฉัน”",
         "body": "เมนูอยู่บน Rich Menu ของ LINE OA",
         "image": "08-my-bookings.png"},
        {"title": "ตรวจสอบการจองที่ต้องการเปลี่ยน",
         "body": "ดูวันที่ เวลา และบริการที่จองไว้"},
        {"title": "แชทหาร้านผ่าน LINE OA  หรือโทร",
         "body": "ช่องทาง LINE สะดวกที่สุด · เห็นข้อความย้อนหลังได้"},
        {"title": "แจ้งรายละเอียดการจอง + การเปลี่ยนแปลง",
         "body": "ระบุ ชื่อ + วัน/เวลาเดิม + สิ่งที่ต้องการเปลี่ยน"},
        {"title": "ทีมงานยืนยันการแก้ไข",
         "body": "อาจใช้เวลา 5–15 นาที ในชั่วโมงทำการ"},
        {"title": "รับการแจ้งเตือนยืนยันใหม่",
         "body": "ข้อความใหม่จะมาที่ LINE พร้อมเวลา/บริการที่ตรงตามที่แก้"},
    ],
    footer_note="ขอความกรุณาแจ้งล่วงหน้าอย่างน้อย 1 ชั่วโมง  เพื่อให้ลูกค้าท่านอื่นได้ใช้คิว",
)


def main():
    out_dir = HERE
    for spec in (INFOGRAPHIC_1, INFOGRAPHIC_2, INFOGRAPHIC_3):
        out = out_dir / spec.pop("out_path")
        render_infographic(out_path=str(out), **spec)
        print(f"  ✓  {out.name}")


if __name__ == "__main__":
    main()
