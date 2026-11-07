#!/usr/bin/env python3
"""Programmatic visual + structural verification of the rebuilt roadmap."""
import glob
import re
import subprocess

from PIL import Image

DOCX = "/home/z/my-project/download/Adwa_Cyber_Implementation_Roadmap.docx"
PDF = "/home/z/my-project/download/Adwa_Cyber_Implementation_Roadmap.pdf"

print("=== 1. Pixel-level page checks ===")
pages = sorted(glob.glob("/tmp/render/page-*.jpg"))
blank, dark = [], []
for pg in pages:
    im = Image.open(pg).convert("L")
    px = list(im.getdata())
    n = len(px)
    white = sum(1 for v in px if v > 245) / n
    darkpx = sum(1 for v in px if v < 100) / n
    if white > 0.995:
        blank.append(pg)
    if darkpx > 0.5:
        dark.append(pg)
print(f"pages: {len(pages)}; blank pages: {len(blank)}; dark pages: {len(dark)} (expect exactly 1 dark = cover)")
assert not blank, f"BLANK PAGES FOUND: {blank}"
assert len(dark) == 1 and pages[0] in dark, "cover should be the only dark page"
print("OK: no blank pages; cover is dark, all body pages white-based")

print()
print("=== 2. docx structural checks (python-docx) ===")
from docx import Document

doc = Document(DOCX)
heads = [p.text for p in doc.paragraphs if p.style.name.startswith("Heading")]
h1 = [h for h in heads if re.match(r"^\d+\.", h)]
print(f"H1 sections: {len(h1)}")
for h in h1:
    print("  ", h)
tables = doc.tables
print(f"Tables: {len(tables)} (expect 13 incl. the cover wrapper table)")
# cover wrapper is table 0; content tables 1..13
assert len(tables) == 14, f"expected 14 tables (1 cover wrapper + 13 content), got {len(tables)}"

fulltext = "\n".join(p.text for p in doc.paragraphs)
for t in tables:
    for row in t.rows:
        for cell in row.cells:
            fulltext += "\n" + cell.text

placeholders = ["XXX", "TODO", "待补充", "【", "____", "undefined", "NaN"]
found = [ph for ph in placeholders if ph in fulltext]
assert not found, f"placeholders found: {found}"
print("OK: no placeholders")

stale = ["already have working implementations", "two phases are already implemented",
         "are already built", "already implemented", "is implemented",
         "curriculum is already complete", "60 percent done", "localhost"]
low = fulltext.lower()
stale_found = [s for s in stale if s.lower() in low]
assert not stale_found, f"stale phrases still present: {stale_found}"
print("OK: no stale 'already implemented' / localhost claims anywhere")

print()
print("=== 3. New from-scratch content present ===")
required = [
    "built from scratch in Months 1\u20136",
    "4.1 The Phase 1 Build Plan",
    "Rule formalisation",
    "Phase 1 build workstreams, activities, and exit criteria",
    "Rule catalogue v1.0: all 47 obligations formalised",
    "The Phase 1 from-scratch build (rule formalisation, engine, dashboards) overruns",
    "The Four Risks That Matter Most",
    "Build milestone adherence",
    "103,840", "193,160", "50,400", "90,600", "94,400", "175,600",
    "USD 104,000\u2013193,000",
    "Full-stack Engineer",
    "Kick off the Phase 1 rule catalogue",
    "Start the Phase 1 build now",
]
missing = [s for s in required if s not in fulltext]
assert not missing, f"missing required strings: {missing}"
print(f"OK: all {len(required)} required from-scratch strings present")

print()
print("=== 4. PDF text spot checks ===")
out = subprocess.run(["pdftotext", PDF, "-"], capture_output=True, text=True).stdout
for s in ["The Phase 1 Build Plan (Months 1\u20136)", "R1", "30-60-90 day action plan",
          "Consolidated Strategic Recommendations"]:
    assert s in out, f"missing in PDF text: {s}"
print("OK: PDF contains the new sections")
print()
print("ALL VERIFICATION CHECKS PASSED")
