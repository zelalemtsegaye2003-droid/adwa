#!/usr/bin/env python3
"""Fix duplicated first TOC entry produced by the placeholder injection:
- cache a page-number result inside the hyperlink entry's PAGEREF field
- remove the plain duplicate paragraph that follows it
Only touches the TOC region of word/document.xml."""
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path


def main(docx_path: str) -> int:
    src = Path(docx_path)
    if not src.exists():
        print(f"ERROR: {src} not found")
        return 1

    tmpdir = Path(tempfile.mkdtemp(prefix="tocfix_"))
    with zipfile.ZipFile(src, "r") as zf:
        zf.extractall(tmpdir)

    doc_path = tmpdir / "word" / "document.xml"
    xml = doc_path.read_text(encoding="utf-8")

    # 1. Cache a result ("1") inside the PAGEREF field of the hyperlink entry.
    #    docx-js merges begin+instrText+separate+end into one run; split the
    #    separate/end pair and insert a visible result run between them.
    pageref_pat = (
        r'(<w:fldChar w:fldCharType="separate"/>)(<w:fldChar w:fldCharType="end"/></w:r>)'
    )
    # apply only to the FIRST PAGEREF (the _Toc1 hyperlink entry)
    m = re.search(
        r'PAGEREF _Toc\d+ \\h</w:instrText><w:fldChar w:fldCharType="separate"/>'
        r'<w:fldChar w:fldCharType="end"/></w:r>',
        xml,
    )
    cached = 0
    if m:
        xml = (
            xml[: m.start()]
            + 'PAGEREF _Toc1 \\h</w:instrText><w:fldChar w:fldCharType="separate"/>'
            + '</w:r><w:r><w:rPr><w:noProof/></w:rPr><w:t>1</w:t></w:r>'
            + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
            + xml[m.end():]
        )
        cached = 1

    # 2. Remove the plain duplicate paragraph (first TOC1-styled <w:p> whose
    #    text is exactly the first heading, outside the hyperlink).
    #    Find all paragraphs containing >1. Executive Summary< as their only text.
    dup_pat = re.compile(
        r'<w:p><w:pPr><w:pStyle w:val="TOC1"/>(?:(?!</w:p>).)*?'
        r'<w:t>1\. Executive Summary</w:t>(?:(?!</w:p>).)*?</w:p>',
        re.S,
    )
    xml, removed = dup_pat.subn("", xml, count=1)

    doc_path.write_text(xml, encoding="utf-8")

    # 3. Re-zip
    tmpzip = tmpdir / "repacked.docx"
    with zipfile.ZipFile(tmpzip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(tmpdir.rglob("*")):
            if f == tmpzip or f.is_dir():
                continue
            zf.write(f, f.relative_to(tmpdir))
    shutil.move(str(tmpzip), str(src))
    shutil.rmtree(tmpdir, ignore_errors=True)

    print(f"PAGEREF cached results inserted: {cached}")
    print(f"Duplicate plain TOC paragraphs removed: {removed}")
    if cached != 1 or removed != 1:
        print("WARNING: expected exactly 1 of each — inspect manually")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ""))
