#!/usr/bin/env python3
"""Render scripts/architecture-diagram.html -> docs/architecture.png (2x).

Follows the charts skill Playwright rules: element screenshot of #root,
viewport auto-resized to the real bounding box, device_scale_factor=2.
Also runs in-page overflow checks (no text may overflow its chip) and a
non-blank pixel check on the output.
"""
import asyncio
import os
from playwright.async_api import async_playwright

HTML = os.path.abspath("scripts/architecture-diagram.html")
OUT = os.path.abspath("docs/architecture.png")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": 1500, "height": 900}, device_scale_factor=2
        )
        await page.goto(f"file://{HTML}", wait_until="networkidle")
        await page.wait_for_timeout(400)

        el = page.locator("#root")
        bbox = await el.bounding_box()
        await page.set_viewport_size(
            {"width": max(1500, int(bbox["width"] + 40)), "height": int(bbox["height"] + 60)}
        )
        await page.wait_for_timeout(200)

        # ── Anti-overlap / overflow verification ──────────────────────────
        overflow = await page.evaluate(
            """() => {
              const bad = [];
              for (const el of document.querySelectorAll('.chip, .layer-bar, .sg-label')) {
                if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                  bad.push(el.textContent.slice(0, 60));
                }
              }
              return bad;
            }"""
        )
        if overflow:
            for b in overflow:
                print("OVERFLOW:", b)
            raise SystemExit("text overflow detected — fix the diagram")

        await el.screenshot(path=OUT)
        await browser.close()

    size_kb = os.path.getsize(OUT) / 1024
    print(f"OK {OUT} ({size_kb:.0f} KB)")

    # non-blank check: variance of pixels must be > threshold
    from PIL import Image
    import statistics
    img = Image.open(OUT).convert("L").resize((200, 200))
    px = list(img.getdata())
    print(f"pixel stdev: {statistics.pstdev(px):.1f} (blank images are near 0)")
    if statistics.pstdev(px) < 5:
        raise SystemExit("output looks blank")

asyncio.run(main())
