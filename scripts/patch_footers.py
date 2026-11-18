"""Post-process the roadmap docx for WPS/Word page-number compatibility.

1. Map each section's footerReference to its footer XML file.
2. Patch instrText: TOC section footer -> PAGE \\* ROMAN; body -> PAGE \\* arabic.
3. Remove empty <w:pgNumType/> elements from document.xml.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOCX = Path("download/Adwa_Cyber_Implementation_Roadmap.docx")
WORK = Path("/tmp/docx_patch")


def main():
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    with zipfile.ZipFile(DOCX) as z:
        z.extractall(WORK)

    doc_path = WORK / "word" / "document.xml"
    doc_xml = doc_path.read_text(encoding="utf-8")

    # --- 1. Find sectPr blocks in order and their footer references ---
    sect_blocks = re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc_xml, re.S)
    print(f"Found {len(sect_blocks)} sectPr blocks")

    rels_path = WORK / "word" / "_rels" / "document.xml.rels"
    rels_xml = rels_path.read_text(encoding="utf-8")
    rid_to_target = dict(re.findall(
        r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))

    def footer_files_for(block):
        rids = re.findall(
            r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', block)
        if not rids:
            rids = re.findall(
                r'<w:footerReference[^>]*r:id="([^"]+)"[^>]*w:type="default"', block)
        return [rid_to_target.get(r) for r in rids if rid_to_target.get(r)]

    # Expectation: 3 sections (cover / TOC / body); the last sectPr is the
    # body's (document-level). Cover has no footer reference.
    section_footers = []
    for i, block in enumerate(sect_blocks):
        targets = footer_files_for(block)
        section_footers.append(targets)
        print(f"Section {i + 1}: footers = {targets}")

    if len(sect_blocks) < 3:
        print("ERROR: expected at least 3 sections", file=sys.stderr)
        sys.exit(1)

    toc_footer_targets = section_footers[1]   # section 2 = TOC (Roman)
    body_footer_targets = section_footers[2]  # section 3 = body (arabic)

    def patch_footer(target, fmt):
        path = WORK / "word" / target
        xml = path.read_text(encoding="utf-8")
        new_xml, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            rf"\1 PAGE \\* {fmt} \\* MERGEFORMAT \2",
            xml,
        )
        if n:
            path.write_text(new_xml, encoding="utf-8")
        print(f"Patched {target} with {fmt}: {n} field(s)")

    for t in toc_footer_targets:
        if t:
            patch_footer(t, "ROMAN")
    for t in body_footer_targets:
        if t:
            patch_footer(t, "arabic")

    # --- 3. Remove empty pgNumType (cover section artifact) ---
    doc_xml2, n = re.subn(r"<w:pgNumType/>", "", doc_xml)
    if n:
        doc_path.write_text(doc_xml2, encoding="utf-8")
    print(f"Removed {n} empty pgNumType elements")

    # --- Repack ---
    out = DOCX.with_suffix(".docx")
    tmp_out = WORK / "out.docx"
    with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in WORK.rglob("*"):
            if f == tmp_out or f.is_dir():
                continue
            z.write(f, f.relative_to(WORK))
    shutil.copy(tmp_out, out)
    print("Repacked:", out)


if __name__ == "__main__":
    main()
