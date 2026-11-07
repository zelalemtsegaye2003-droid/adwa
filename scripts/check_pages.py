"""Programmatic visual sanity checks on the rendered roadmap pages."""
import glob
from PIL import Image

pages = sorted(glob.glob("/tmp/render/page-*.jpg"))
print(f"Total pages: {len(pages)}")

issues = []
for p in pages:
    im = Image.open(p).convert("L")
    w, h = im.size
    # non-white pixel ratio
    hist = im.histogram()
    non_white = sum(hist[:245]) / (w * h)
    name = p.split("/")[-1]
    if non_white < 0.005:
        issues.append(f"{name}: nearly blank ({non_white:.4f})")
    print(f"{name}: {w}x{h}, non-white ratio = {non_white:.4f}")

print("\nBlank-page issues:", issues if issues else "NONE")
