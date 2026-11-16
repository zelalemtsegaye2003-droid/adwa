"""Post-process generated docx (per docx skill toc.md / common-rules.md):
1. Remove empty <w:pgNumType/> from cover section.
2. Patch footer PAGE fields with explicit \\* arabic format switch (WPS compat).
"""
import sys, re, zipfile, shutil, os

def patch(path):
    tmp = path + ".tmp"
    shutil.copy(path, tmp)
    with zipfile.ZipFile(tmp, "r") as zin:
        items = zin.namelist()
        data = {n: zin.read(n) for n in items}
    # 1) strip empty pgNumType
    docxml = data["word/document.xml"].decode("utf-8")
    docxml = docxml.replace("<w:pgNumType/>", "")
    data["word/document.xml"] = docxml.encode("utf-8")
    # 2) patch footer PAGE instrText
    for n in items:
        if re.match(r"word/footer\d+\.xml", n):
            xml = data[n].decode("utf-8")
            xml = re.sub(r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
                         r"\1 PAGE \\* arabic \\* MERGEFORMAT \2", xml)
            data[n] = xml.encode("utf-8")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in items:
            zout.writestr(n, data[n])
    os.remove(tmp)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        patch(p)
        print("patched:", p)
