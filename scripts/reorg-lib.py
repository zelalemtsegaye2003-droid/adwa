#!/usr/bin/env python3
"""
reorg-lib.py — architectural reorganization of src/lib into domain modules.

Moves the flat ~45-file src/lib into six domain folders + platform core:

  src/lib/vapt/         VAPT Center domain engines + feed snapshot
  src/lib/soc/          SOC / threat-intel hub + intel snapshots
  src/lib/ethio/        Ethiopian ecosystem (Ethio-CERT, INSA, NBE) + snapshots
  src/lib/awareness/    awareness curriculum / tools / server
  src/lib/compliance/   Proclamation 1321 rules, engine, evidence, SLA, PDF
  src/lib/governance/   Track C gates, CII, ACFS, gate dossier PDF
  src/lib/              platform core stays: db, env, api-error, utils, i18n,
                        tab-theme, auth-client, auth/

Import rewriting (all styles):
  - "@/lib/<mod>"            (src/app, src/components, src/lib)  -> mapped alias
  - "<rel>/src/lib/<mod>"    (scripts, prisma, mini-services)     -> mapped path
  - "./x" / "../x"           (inside src/lib)                     -> resolve from
                              the ORIGINAL location, recompute from the NEW one

Plain string references like process.cwd()+"/src/lib/compliance/report-pdf.ts" in
non-import code are rewritten too (targeted pass over scripts/).

Usage:  python3 scripts/reorg-lib.py          # apply (git mv + rewrites)
        python3 scripts/reorg-lib.py --dry    # print the plan only
"""
import os, re, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "src", "lib")

DRY = "--dry" in sys.argv

# ── the move map ────────────────────────────────────────────────────────────
DOMAINS = {
    # VAPT Center (NBE LOT4)
    "vapt": ["vapt-ad-engine", "vapt-ad-paths", "vapt-audit", "vapt-bid-matrix",
             "vapt-checks", "vapt-cve-feed", "vapt-data", "vapt-db-audit",
             "vapt-easm", "vapt-engine", "vapt-epss", "vapt-netengine",
             "vapt-scope", "vapt-snmp", "vapt-feed-snapshot.json"],
    # SOC + threat intelligence
    "soc": ["soc-engine", "intel-feeds"],
    # Ethiopian ecosystem
    "ethio": ["ethio-landscape", "ethiocert-client", "ethiocert-feed",
              "ethiocert-web"],
    # Awareness platform
    "awareness": ["awareness-data", "awareness-engine", "awareness-server",
                  "awareness-tools"],
    # Compliance core
    "compliance": ["engine", "rules-data", "nbe-rules-data", "rules-engine",
                   "evidence", "evidence-shared", "sla", "report-pdf"],
    # Track C governance
    "governance": ["acfs-gates", "cii-engine", "gate-dossier-pdf",
                   "gate-evidence", "gates"],
}
DIRS = {"intel-snapshots": "soc", "ethio-snapshots": "ethio"}
TOP_LEVEL = {"api-error", "auth-client", "db", "env", "i18n", "tab-theme",
             "utils", "auth"}  # stay at src/lib root

# basename (with ext stripped) -> domain
NAME2DOM = {}
for dom, names in DOMAINS.items():
    for n in names:
        NAME2DOM[re.sub(r"\.(ts|tsx|json)$", "", n)] = dom


def map_lib_path(p):
    """Map a lib-relative path ('vapt-engine', 'auth/jwt',
    'intel-snapshots/kev.json') to its new lib-relative path, or None if
    it is not a known lib module."""
    parts = p.split("/")
    head = parts[0]
    if head in DIRS:                       # snapshot dirs move with a domain
        return DIRS[head] + "/" + p
    base = re.sub(r"\.(ts|tsx|json)$", "", head)
    if base in NAME2DOM:
        return NAME2DOM[base] + "/" + p
    if base in TOP_LEVEL or head == "auth":
        return p                            # unchanged
    return None


def rel_spec(from_dir, target_lib_path):
    """Relative specifier from a directory (absolute) to src/lib/<target>."""
    out = os.path.relpath(os.path.join(LIB, target_lib_path), from_dir)
    return out if out.startswith(".") else "./" + out


def iter_files():
    for sub in ("src", "scripts", "prisma", "mini-services"):
        for dirpath, _dirs, files in os.walk(os.path.join(ROOT, sub)):
            if "node_modules" in dirpath:
                continue
            for f in files:
                if f.endswith((".ts", ".tsx", ".mjs", ".cjs", ".js")):
                    yield os.path.join(dirpath, f)


SPEC_RE = re.compile(
    r"""(?P<ref>from|import\s*\(|require\s*\(\s*)\s*(?P<q>['"])(?P<spec>[^'"]+)(?P=q)"""
)


def _mk_repl(path, moves):
    """Build the regex replacement fn for one file. `moves` maps old absolute
    path -> new absolute path for every moved file (for resolving relative
    specs from the ORIGINAL location and regenerating from the NEW one)."""
    fdir = os.path.dirname(path)
    in_lib = fdir.startswith(LIB)

    def repl(m):
        spec = m.group("spec")
        new = spec
        if spec.startswith("@/lib/"):
            mapped = map_lib_path(spec[len("@/lib/"):])
            if mapped:
                new = "@/lib/" + mapped
        else:
            mrel = re.match(r"^((?:\.\./)+)src/lib/(.+)$", spec)
            if mrel and not in_lib:
                mapped = map_lib_path(mrel.group(2))
                if mapped:
                    new = mrel.group(1) + "src/lib/" + mapped
            elif spec.startswith(("./", "../")) and in_lib:
                resolved = os.path.normpath(os.path.join(fdir, spec))
                if resolved.startswith(LIB + os.sep) or resolved == LIB:
                    librel = os.path.relpath(resolved, LIB)
                    mapped = map_lib_path(librel)
                    if mapped:
                        # recompute the relative spec from the NEW file location
                        newdir = os.path.dirname(moves.get(path, path))
                        new = rel_spec(newdir, mapped)
        if new != spec:
            return m.group("ref") + " " + m.group("q") + new + m.group("q")
        return m.group(0)

    return repl


def rewrite_plain_strings(text):
    """Targeted pass for plain string references to src/lib/<module> outside
    import statements (e.g. process.cwd()+"/src/lib/compliance/report-pdf.ts")."""
    for dom, names in DOMAINS.items():
        for n in names:
            for pat in (f"src/lib/{n}", f"src\\lib\\{n}"):
                if pat in text:
                    text = text.replace(pat, f"src/lib/{dom}/{n}")
    return text


def main():
    moves = {}
    for dom, names in DOMAINS.items():
        for n in names:
            old = os.path.join(LIB, n + ".ts") if not n.endswith(".json") \
                else os.path.join(LIB, n)
            if not os.path.exists(old):
                # .tsx fallback (i18n stays top-level but be safe for others)
                old = os.path.join(LIB, n + ".tsx")
            new = os.path.join(LIB, dom, n + ("" if n.endswith(".json") else ".ts"))
            if not os.path.exists(old):
                print(f"!! missing: {n}")
                continue
            moves[old] = new
    for d, dom in DIRS.items():
        old = os.path.join(LIB, d)
        if os.path.isdir(old):
            moves[old] = os.path.join(LIB, dom, d)

    if DRY:
        for old, new in sorted(moves.items()):
            print(f"mv {os.path.relpath(old, ROOT)} -> {os.path.relpath(new, ROOT)}")
        print(f"({len(moves)} entries to move)")

    changed = []
    for f in iter_files():
        moved_f = moves.get(f, f)
        with open(f, "r", encoding="utf-8") as fh:
            orig = fh.read()
        # pass 1: import specifiers (in memory)
        text = SPEC_RE.sub(_mk_repl(f, moves), orig)
        # pass 2: plain string references (in memory)
        text = rewrite_plain_strings(text)
        if text != orig:
            changed.append((f, moved_f, text))

    if DRY:
        print(f"({len(changed)} files need import rewrites)")
        for f, nf, _ in changed:
            print(f"rewrite {os.path.relpath(f, ROOT)}")
        return

    # 1) git mv
    for old, new in moves.items():
        os.makedirs(os.path.dirname(new), exist_ok=True)
        r = os.path.relpath(old, ROOT).replace(os.sep, "/")
        n2 = os.path.relpath(new, ROOT).replace(os.sep, "/")
        subprocess.run(["git", "mv", r, n2], cwd=ROOT, check=True)
    print(f"moved {len(moves)} entries into domain folders")

    # 2) write rewritten files (to their new paths when moved)
    for f, nf, new_text in changed:
        target = nf
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(new_text)
        print(f"rewrote {os.path.relpath(target, ROOT)}")
    print(f"rewrote {len(changed)} files")


if __name__ == "__main__":
    main()
