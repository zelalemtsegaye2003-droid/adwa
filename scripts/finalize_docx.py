"""Final post-processor for the Adwa Cyber roadmap docx.

Because docx-js 9.15.2 already emits a fully populated TOC (hyperlink entries
+ PAGEREF fields + heading bookmarks), we do NOT run add_toc_placeholders.py.
Instead this script:

1. Reads the rendered PDF's outline to get the true page number of each heading
   (body page = PDF page - front matter offset).
2. Injects a cached page-number run into every TOC PAGEREF field (splitting the
   merged begin/instr/separate/end run), so the TOC shows numbers in any viewer
   and still refreshes correctly in Word.
3. Adds <w:updateFields w:val="true"/> to settings.xml.
4. Patches footer instrText: TOC section -> PAGE \\* ROMAN, body -> PAGE \\* arabic.
5. Removes empty <w:pgNumType/> from the cover section.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

from lxml import etree
from pypdf import PdfReader

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}

DOCX = Path("/adwa/download/Adwa_Cyber_Implementation_Roadmap.docx")
PDF = Path("/tmp/rawpdf/Adwa_Cyber_Implementation_Roadmap.pdf")
WORK = Path("/tmp/docx_final")

BODY_OFFSET = 3  # cover (1) + TOC pages (2) -> body page = PDF page - 3


def pdf_outline_pages():
    """Return list of (title, body_page) from the rendered PDF outline."""
    reader = PdfReader(str(PDF))
    out = []

    def walk(items):
        for it in items:
            if isinstance(it, list):
                walk(it)
            else:
                pg = reader.get_destination_page_number(it) + 1
                out.append((it.title, pg - BODY_OFFSET))

    walk(reader.outline)
    return out


def qn(tag):
    return f"{{{W}}}{tag}"


def main():
    if not PDF.exists():
        print("ERROR: rendered PDF not found; render it first", file=sys.stderr)
        sys.exit(1)

    title_to_page = {}
    for title, page in pdf_outline_pages():
        title_to_page.setdefault(title, page)
    print(f"Outline entries: {len(title_to_page)}")

    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)
    with zipfile.ZipFile(DOCX) as z:
        z.extractall(WORK)

    # ------------------------------------------------------------------
    # 1. Inject cached page numbers into TOC PAGEREF fields
    # ------------------------------------------------------------------
    doc_path = WORK / "word" / "document.xml"
    tree = etree.parse(str(doc_path))
    root = tree.getroot()

    injected = 0
    missing = []
    for hyperlink in root.iter(qn("hyperlink")):
        # entry text = concatenation of w:t inside the hyperlink, minus PAGEREF numbers
        texts = [t.text or "" for t in hyperlink.findall(f".//{qn('t')}")]
        entry_text = "".join(texts).strip()
        if not entry_text:
            continue
        page = title_to_page.get(entry_text)
        if page is None:
            # try fuzzy: outline titles should match exactly; collect misses
            missing.append(entry_text)
            continue

        # find the merged PAGEREF run: contains fldChar begin + instrText + separate + end
        target_run = None
        for r in hyperlink.findall(qn("r")):
            flds = [f.get(qn("fldCharType")) for f in r.findall(qn("fldChar"))]
            if "begin" in flds and "separate" in flds and "end" in flds:
                instr = r.find(qn("instrText"))
                if instr is not None and "PAGEREF" in (instr.text or ""):
                    target_run = r
                    break
        if target_run is None:
            continue

        instr_el = target_run.find(qn("instrText"))
        instr_text = instr_el.text if instr_el is not None else ""
        parent = target_run.getparent()
        idx = list(parent).index(target_run)

        r_begin = etree.Element(qn("r"))
        fc = etree.SubElement(r_begin, qn("fldChar"))
        fc.set(qn("fldCharType"), "begin")
        fc.set(qn("dirty"), "true")

        r_instr = etree.Element(qn("r"))
        it_el = etree.SubElement(r_instr, qn("instrText"))
        it_el.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        it_el.text = instr_text

        r_sep = etree.Element(qn("r"))
        fc = etree.SubElement(r_sep, qn("fldChar"))
        fc.set(qn("fldCharType"), "separate")

        r_page = etree.Element(qn("r"))
        t_el = etree.SubElement(r_page, qn("t"))
        t_el.text = str(page)

        r_end = etree.Element(qn("r"))
        fc = etree.SubElement(r_end, qn("fldChar"))
        fc.set(qn("fldCharType"), "end")

        parent.remove(target_run)
        for i, el in enumerate([r_begin, r_instr, r_sep, r_page, r_end]):
            parent.insert(idx + i, el)
        injected += 1

    print(f"Injected page numbers into {injected} PAGEREF fields")
    if missing:
        print("WARNING - no outline match for:", missing[:5], file=sys.stderr)

    tree.write(str(doc_path), xml_declaration=True, encoding="UTF-8", standalone=True)

    # ------------------------------------------------------------------
    # 2. settings.xml: updateFields = true
    # ------------------------------------------------------------------
    settings_path = WORK / "word" / "settings.xml"
    s = settings_path.read_text(encoding="utf-8")
    if "updateFields" not in s:
        s = s.replace(
            "<w:settings",
            "<w:settings",
            1,
        )
        # insert right after opening tag
        m = re.search(r"(<w:settings[^>]*>)", s)
        if m:
            s = s[: m.end()] + '<w:updateFields w:val="true"/>' + s[m.end():]
            settings_path.write_text(s, encoding="utf-8")
            print("Added updateFields=true to settings.xml")

    # ------------------------------------------------------------------
    # 3. Footer instrText patches (ROMAN for TOC section, arabic for body)
    # ------------------------------------------------------------------
    doc_xml = doc_path.read_text(encoding="utf-8")
    sect_blocks = re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc_xml, re.S)
    rels_xml = (WORK / "word" / "_rels" / "document.xml.rels").read_text(encoding="utf-8")
    rid_to_target = dict(re.findall(
        r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))

    def footer_targets(block):
        rids = re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', block)
        return [rid_to_target.get(r) for r in rids if rid_to_target.get(r)]

    print(f"Sections found: {len(sect_blocks)}")
    if len(sect_blocks) >= 3:
        for t in footer_targets(sect_blocks[1]):
            patch_footer_file(t, "ROMAN")
        for t in footer_targets(sect_blocks[2]):
            patch_footer_file(t, "arabic")

    # ------------------------------------------------------------------
    # 4. Remove empty pgNumType
    # ------------------------------------------------------------------
    doc_xml2 = doc_path.read_text(encoding="utf-8")
    n = 0
    if "<w:pgNumType/>" in doc_xml2:
        doc_xml2 = doc_xml2.replace("<w:pgNumType/>", "")
        doc_path.write_text(doc_xml2, encoding="utf-8")
        n = 1
    print(f"Removed empty pgNumType: {n}")

    # ------------------------------------------------------------------
    # 5. Repack
    # ------------------------------------------------------------------
    tmp_out = WORK / "out.docx"
    with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in WORK.rglob("*"):
            if f == tmp_out or f.is_dir():
                continue
            z.write(f, f.relative_to(WORK))
    shutil.copy(tmp_out, DOCX)
    print("Repacked:", DOCX)


def patch_footer_file(target, fmt):
    path = WORK / "word" / target
    xml = path.read_text(encoding="utf-8")
    new_xml, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        rf"\1 PAGE \\* {fmt} \\* MERGEFORMAT \2",
        xml,
    )
    if n:
        path.write_text(new_xml, encoding="utf-8")
    print(f"Patched {target} -> {fmt}: {n} field(s)")


if __name__ == "__main__":
    main()
