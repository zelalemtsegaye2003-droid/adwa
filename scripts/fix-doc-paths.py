#!/usr/bin/env python3
"""fix-doc-paths.py — after reorg-lib.py moved src/lib into domain folders,
rewrite stale flat-path references (src/lib/<module>) in docs and code
comments to the new domain paths (src/lib/<domain>/<module>)."""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOMAINS = {
    "vapt": ["vapt-ad-engine", "vapt-ad-paths", "vapt-audit", "vapt-bid-matrix",
             "vapt-checks", "vapt-cve-feed", "vapt-data", "vapt-db-audit",
             "vapt-easm", "vapt-engine", "vapt-epss", "vapt-netengine",
             "vapt-scope", "vapt-snmp", "vapt-feed-snapshot.json"],
    "soc": ["soc-engine", "intel-feeds"],
    "ethio": ["ethio-landscape", "ethiocert-client", "ethiocert-feed",
              "ethiocert-web"],
    "awareness": ["awareness-data", "awareness-engine", "awareness-server",
                  "awareness-tools"],
    "compliance": ["engine", "rules-data", "nbe-rules-data", "rules-engine",
                   "evidence", "evidence-shared", "sla", "report-pdf"],
    "governance": ["acfs-gates", "cii-engine", "gate-dossier-pdf",
                   "gate-evidence", "gates"],
}
DIRS = {"intel-snapshots": "soc", "ethio-snapshots": "ethio"}

TARGETS = []
for base in ("docs", "src", "scripts", "prisma", "mini-services"):
    for dp, _d, fs in os.walk(os.path.join(ROOT, base)):
        if "node_modules" in dp:
            continue
        for f in fs:
            if f.endswith((".md", ".ts", ".tsx", ".mjs", ".cjs", ".js", ".html", ".sh", ".py")):
                TARGETS.append(os.path.join(dp, f))
TARGETS.append(os.path.join(ROOT, "README.md"))
TARGETS.append(os.path.join(ROOT, "AGENTS.md"))

changed = []
for path in TARGETS:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = orig = fh.read()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    for dom, names in DOMAINS.items():
        for n in names:
            for suffix in ("", ".ts", ".json", ".tsx"):
                old = f"src/lib/{n}{suffix}"
                # boundary: not followed by another name char (avoid partial hits)
                text = re.sub(re.escape(old) + r"(?![\w-])",
                              f"src/lib/{dom}/{n}{suffix}", text)
    for d, dom in DIRS.items():
        text = re.sub(r"src/lib/" + d + r"(?![\w-])",
                      f"src/lib/{dom}/{d}", text)
    if text != orig:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        changed.append(os.path.relpath(path, ROOT))

print("rewrote stale paths in:")
for c in changed:
    print("  " + c)
print(f"({len(changed)} files)")
