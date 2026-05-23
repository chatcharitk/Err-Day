"""
Capture mobile-sized screenshots of the err.day customer-facing flow.

Run against a local dev server (npm run dev) and saves screenshots to
infographics/screenshots/ for embedding into the infographic PDFs.
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:59850"
OUT_DIR  = Path(__file__).parent / "screenshots"
OUT_DIR.mkdir(exist_ok=True)

# Mobile viewport — matches what most customers see on LINE in-app browser
VIEWPORT = {"width": 375, "height": 812}
DEVICE_SCALE = 2  # retina for crisp print


async def shoot(page, name, *, full_page=False):
    out = OUT_DIR / f"{name}.png"
    await page.screenshot(path=str(out), full_page=full_page)
    print(f"  ✓ {name}.png ({out.stat().st_size // 1024} KB)")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=DEVICE_SCALE,
            locale="th-TH",
        )
        page = await context.new_page()

        # ── 1) /book — login choice ────────────────────────────────────────
        print("→ /book (login choice)")
        await page.goto(f"{BASE_URL}/book", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)  # let LIFF init settle into the login-choice UI
        await shoot(page, "01-book-login")

        # ── 2) /book — branch selector (after skipping LINE) ───────────────
        print("→ /book (skip → branches)")
        try:
            await page.get_by_text("ดำเนินการต่อโดยไม่เข้าสู่ระบบ").click(timeout=5000)
            await page.wait_for_timeout(1000)
            await shoot(page, "02-book-branches")
        except Exception as e:
            print(f"  ⚠ couldn't click skip button: {e}")

        # ── 3) /book/branch-sukhumvit — booking flow (step through) ─────────
        print("→ /book/branch-sukhumvit (services)")
        await page.goto(f"{BASE_URL}/book/branch-sukhumvit", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        try:
            await page.get_by_text("ดำเนินการต่อโดยไม่เข้าสู่ระบบ").click(timeout=3000)
            await page.wait_for_timeout(1000)
        except Exception:
            pass
        await shoot(page, "03-book-services")

        # Click the first service ("สระไดร์") to advance to the date/time step
        print("→ Click service → date/time step")
        try:
            await page.get_by_text("สระไดร์", exact=False).first.click(timeout=5000)
            await page.wait_for_timeout(1500)
            await shoot(page, "04-book-datetime")
        except Exception as e:
            print(f"  ⚠ couldn't click service: {e}")

        # Click "ถัดไป" / next button if present, capture customer info step
        print("→ Try advancing to customer info")
        try:
            # Pick the first available time slot
            for label in ["10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "14:00", "15:00"]:
                try:
                    await page.get_by_text(label, exact=True).first.click(timeout=1500)
                    await page.wait_for_timeout(700)
                    break
                except Exception:
                    continue
            # Click "ถัดไป" / continue
            for label in ["ถัดไป", "ต่อไป", "ยืนยัน"]:
                try:
                    await page.get_by_text(label, exact=False).first.click(timeout=1500)
                    await page.wait_for_timeout(1500)
                    break
                except Exception:
                    continue
            await shoot(page, "05-book-customer-info")
        except Exception as e:
            print(f"  ⚠ couldn't advance: {e}")

        # ── 4) /membership — try the listing/lookup page ───────────────────
        print("→ /membership/lookup")
        try:
            await page.goto(f"{BASE_URL}/membership/lookup", wait_until="networkidle", timeout=15000)
            await page.wait_for_timeout(2000)
            await shoot(page, "06-membership-lookup")
        except Exception as e:
            print(f"  ⚠ membership/lookup failed: {e}")

        # ── 5) /my-bookings — list of customer bookings ────────────────────
        print("→ /my-bookings")
        await page.goto(f"{BASE_URL}/my-bookings", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        await shoot(page, "08-my-bookings")

        await browser.close()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
