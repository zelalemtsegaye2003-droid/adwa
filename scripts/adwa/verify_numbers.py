#!/usr/bin/env python3
"""Verify Year-1 arithmetic in the Adwa roadmap content files."""
import re

SRC = "/home/z/my-project/scripts/adwa/content_b.js"
txt = open(SRC, encoding="utf-8").read()

# Personnel rows: (label, months, low, high, count)
people = [
    ("Founder/CEO", 9, 500, 1000, 1),
    ("CTO", 12, 1500, 2500, 1),
    ("Full-stack Engineer", 9, 800, 1500, 1),
    ("SOC Manager", 6, 1200, 2000, 1),
    ("Sales Lead", 6, 600, 1200, 1),
    ("SOC Analysts", 6, 400, 800, 3),
    ("Ops & Admin", 9, 300, 500, 1),
]
plow = sum(m * lo * n for _, m, lo, hi, n in people)
phigh = sum(m * hi * n for _, m, lo, hi, n in people)
print(f"Personnel total: {plow:,} - {phigh:,}  (doc says 50,400-90,600)")
assert (plow, phigh) == (50400, 90600), "personnel mismatch"

# Budget lines
lines_low = [plow, 10000, 15000, 6000, 8000, 5000]
lines_high = [phigh, 18000, 30000, 12000, 15000, 10000]
slow, shigh = sum(lines_low), sum(lines_high)
clow, chigh = round(slow * 0.10), round(shigh * 0.10)
tlow, thigh = slow + clow, shigh + chigh
print(f"Subtotal: {slow:,} - {shigh:,}  (doc says 94,400-175,600)")
print(f"Contingency: {clow:,} - {chigh:,}  (doc says 9,440-17,560)")
print(f"Total: {tlow:,} - {thigh:,}  (doc says 103,840-193,160)")
print(f"Midpoint: {(tlow + thigh) / 2:,}  (doc says 148,500)")
assert (slow, shigh) == (94400, 175600)
assert (clow, chigh) == (9440, 17560)
assert (tlow, thigh) == (103840, 193160)

# Check the doc actually contains these strings
for s in ["50,400", "90,600", "94,400", "175,600", "9,440", "17,560",
          "103,840", "193,160", "148,500"]:
    assert s in txt, f"missing in content_b.js: {s}"
print("content_b.js figures OK")

# content_a exec summary must carry the same budget range
a = open("/home/z/my-project/scripts/adwa/content_a.js", encoding="utf-8").read()
assert "USD 104,000\u2013193,000" in a, "exec summary budget range missing"
assert "104k\u2013193k" in txt, "scenario op-cost range missing"
print("content_a.js exec summary budget OK")

# Forbidden stale phrases anywhere
stale = [
    "already have working implementations",
    "two phases are already implemented",
    "are already built",
    "already implemented",
    "is implemented",
    "implemented engine",
    "curriculum is already complete",
    "60 percent done",
    "Phases 1\u20132 implemented",
]
for f in ["content_a.js", "content_b.js", "content_c.js"]:
    body = open(f"/home/z/my-project/scripts/adwa/{f}", encoding="utf-8").read()
    for s in stale:
        assert s.lower() not in body.lower(), f"stale phrase '{s}' still in {f}"
print("No stale 'already implemented' claims remain")
print("ALL CHECKS PASSED")
