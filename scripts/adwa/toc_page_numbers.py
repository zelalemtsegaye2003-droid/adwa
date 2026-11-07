#!/usr/bin/env python3
"""Inject real page numbers into the docx TOC as cached PAGEREF results.

The docx TOC is field-code based; Word resolves numbers on 'Update Field'.
To make the exported PDF show page numbers immediately, we compute each
heading's page from the LibreOffice-rendered PDF and cache it inside the
PAGEREF field result. Fields remain updatable in Word.
"""
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

DOCX = Path("/adwa/download/Adwa_Cyber_Implementation_Roadmap.docx")
PDF = Path("/adwa/download/Adwa_Cyber_Implementation_Roadmap.pdf")
FRONT_PAGES = 3  # PDF pages before body page 1 (cover + 2 TOC pages)


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def main() -> int:
    # 1. Headings in document order
    from docx import Document
    doc = Document(str(DOCX))
    headings = [p.text for p in doc.paragraphs if p.style.name.startswith("Heading")]
    print(f"headings: {len(headings)}")

    # 2. Page count of rendered PDF
    n_pages = int(re.search(r"Pages:\s+(\d+)",
                  subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True).stdout).group(1))
    print(f"pdf pages: {n_pages}")

    # 3. Normalized text of each body page
    page_text = {}
    for pg in range(FRONT_PAGES + 1, n_pages + 1):
        out = subprocess.run(["pdftotext", "-f", str(pg), "-l", str(pg), str(PDF), "-"],
                             capture_output=True, text=True).stdout
        page_text[pg] = norm(out)

    # 4. Locate each heading (search only body pages, moving pointer)
    body_pages = []
    ptr = FRONT_PAGES + 1
    for h in headings:
        needle = norm(h)
        found = None
        for pg in range(ptr, n_pages + 1):
            if needle in page_text[pg]:
                found = pg
                break
        if found is None:
            print(f"ERROR: heading not found in PDF body: {h!r}")
            return 1
        body_pages.append(found - FRONT_PAGES)
        ptr = found  # later headings are on the same or a later page
    print("heading body pages:", body_pages)

    # 5. Patch document.xml
    tmpdir = Path(tempfile.mkdtemp(prefix="tocpages_"))
    with zipfile.ZipFile(DOCX, "r") as zf:
        zf.extractall(tmpdir)
    doc_path = tmpdir / "word" / "document.xml"
    xml = doc_path.read_text(encoding="utf-8")

    field_pat = re.compile(
        r'(PAGEREF _Toc(\d+) \\h</w:instrText><w:fldChar w:fldCharType="separate"/>)'
        r'<w:fldChar w:fldCharType="end"/>'
    )
    matches = list(field_pat.finditer(xml))
    print(f"unpatched PAGEREF fields: {len(matches)}")
    if len(matches) != len(headings) - 1:
        print("ERROR: unexpected field count (first entry is pre-cached)")
        return 1

    # Map each unpatched field (XML order = heading order, skipping Toc1 which is cached)
    counter = {"i": 0}

    def repl(m):
        idx = int(m.group(2)) - 1  # _TocN -> heading index N-1
        page = body_pages[idx]
        counter["i"] += 1
        return (m.group(1)
                + '</w:r><w:r><w:rPr><w:noProof/></w:rPr>'
                + f'<w:t>{page}</w:t></w:r>'
                + '<w:r><w:fldChar w:fldCharType="end"/>')

    xml = field_pat.sub(repl, xml)
    print(f"cached results inserted: {counter['i']}")

    doc_path.write_text(xml, encoding="utf-8")

    # 6. Re-zip
    tmpzip = tmpdir / "repacked.docx"
    with zipfile.ZipFile(tmpzip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(tmpdir.rglob("*")):
            if f == tmpzip or f.is_dir():
                continue
            zf.write(f, f.relative_to(tmpdir))
    shutil.move(str(tmpzip), str(DOCX))
    shutil.rmtree(tmpdir, ignore_errors=True)
    print("DOCX updated with cached TOC page numbers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
