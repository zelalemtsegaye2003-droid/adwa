#!/usr/bin/env bash
# Regenerate the three downloadable deliverables into download/:
#   1) AdwaSec_Complete_Repository.zip  — exact git-tracked tree at HEAD
#   2) AdwaSec_Application_Package.zip — the incubator application documents
#   3) AdwaSec_Git_History.bundle       — full git history (all refs)
# Run from repo root:  bash scripts/package-deliverables.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

OUT=download
mkdir -p "$OUT"

echo "==> 1/3 Complete Repository zip (git archive HEAD)"
rm -f "$OUT/AdwaSec_Complete_Repository.zip"
git archive --format=zip --prefix=adwasec/ -o "$OUT/AdwaSec_Complete_Repository.zip" HEAD
echo "    $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

echo "==> 2/3 Application Package zip (documents + screenshots + slides)"
rm -f "$OUT/AdwaSec_Application_Package.zip"
(
  cd "$OUT"
  zip -qr AdwaSec_Application_Package.zip \
    README.md VAPT_Input_Output_Demo.txt \
    AdwaSec_*.docx AdwaSec_*.pdf AdwaSec_*.pptx AdwaSec_*.xlsx \
    Adwa_*.docx Adwa_*.pdf Adwa_System_Architecture.png \
    screenshots slides
)

echo "==> 3/3 Git history bundle (all refs)"
rm -f "$OUT/AdwaSec_Git_History.bundle"
git bundle create "$OUT/AdwaSec_Git_History.bundle" --all

echo "==> verify"
unzip -t "$OUT/AdwaSec_Complete_Repository.zip" >/dev/null && echo "    repo zip: OK"
unzip -t "$OUT/AdwaSec_Application_Package.zip" >/dev/null && echo "    app zip: OK"
git bundle verify "$OUT/AdwaSec_Git_History.bundle" 2>&1 | tail -1
echo "==> sizes"
ls -lh "$OUT"/AdwaSec_Complete_Repository.zip "$OUT"/AdwaSec_Application_Package.zip "$OUT"/AdwaSec_Git_History.bundle
