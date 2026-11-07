#!/usr/bin/env python3
"""Patch footer PAGE fields with explicit format switches (WPS compat) and
remove empty <w:pgNumType/> elements, per docx skill toc.md requirements."""
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

    tmpdir = Path(tempfile.mkdtemp(prefix="footerpatch_"))
    with zipfile.ZipFile(src, "r") as zf:
        zf.extractall(tmpdir)

    doc_xml_path = tmpdir / "word" / "document.xml"
    doc_xml = doc_xml_path.read_text(encoding="utf-8")

    # 1. Remove empty pgNumType (emitted by docx-js on sections w/o pageNumbers)
    doc_xml, n_removed = re.subn(r"<w:pgNumType/>", "", doc_xml)

    # 2. Map each sectPr's footerReference r:id -> pgNumType fmt
    #    (order of sectPr in document.xml = section order)
    sectprs = re.findall(r"<w:sectPr.*?</w:sectPr>|<w:sectPr[^>]*/>", doc_xml, re.S)
    rid_fmt = {}  # rId -> "upperRoman" | "decimal" | None
    for sp in sectprs:
        fmt_m = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', sp)
        for rid in re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', sp):
            rid_fmt[rid] = fmt_m.group(1) if fmt_m else None

    # 3. Map rId -> footer file via document rels
    rels_path = tmpdir / "word" / "_rels" / "document.xml.rels"
    rels = rels_path.read_text(encoding="utf-8")
    rid_target = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))

    # 4. Patch each referenced footer file
    patched = []
    for rid, fmt in rid_fmt.items():
        target = rid_target.get(rid)
        if not target or "footer" not in target:
            continue
        fpath = tmpdir / "word" / target.lstrip("/")
        if not fpath.exists():
            continue
        fxml = fpath.read_text(encoding="utf-8")
        switch = "ROMAN" if fmt == "upperRoman" else ("arabic" if fmt == "decimal" else None)
        if switch is None:
            continue  # cover section (no footerReference anyway) or unknown
        new_fxml, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            rf"\1 PAGE \\* {switch} \\* MERGEFORMAT \2",
            fxml,
        )
        if n:
            fpath.write_text(new_fxml, encoding="utf-8")
            patched.append((target, switch, n))

    doc_xml_path.write_text(doc_xml, encoding="utf-8")

    # 5. Re-zip
    out = src.with_suffix(".docx")
    tmpzip = tmpdir / "repacked.docx"
    with zipfile.ZipFile(tmpzip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(tmpdir.rglob("*")):
            if f == tmpzip or f.is_dir():
                continue
            zf.write(f, f.relative_to(tmpdir))
    shutil.move(str(tmpzip), str(out))
    shutil.rmtree(tmpdir, ignore_errors=True)

    print(f"Removed {n_removed} empty <w:pgNumType/> element(s)")
    print(f"Sections mapped: {len(sectprs)}; footer refs: {len(rid_fmt)}")
    for target, switch, n in patched:
        print(f"Patched {target}: PAGE -> PAGE \\* {switch} ({n} field(s))")
    if not patched:
        print("WARNING: no footer fields patched — check footer references")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ""))
