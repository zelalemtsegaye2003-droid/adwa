"""Adwa Sec startup package — financial model v2 (November 2026 re-base).
Single source of truth for all documents (docx/xlsx/pptx read numbers.json).

Basis of preparation — every input is anchored to a verifiable current source:
  FX        : NBE Indicative Daily Exchange Rate 160.93 ETB/USD (12 Nov 2026)
  Market    : IMARC Group — USD 361.1M (2025) to USD 746.6M (2034), CAGR 8.16%
  Buyers    : NBE Annual Report 2024/25 — 31 commercial banks (+DBE) and 59 MFIs (June 2025)
  Salaries  : levels.fyi median software-engineer pay, Addis Ababa — ETB 55,738/month (Nov 2026);
              role rates set at 1.25-2.5x that median (senior security band)
  Inflation : ESS headline inflation 14.6% (Oct 2026) -> salary escalation planned at 10%/yr
  Pricing   : benchmarks — Vendr median GRC platform ~USD 20K/yr; web-app pentest USD 5-30K
              (2026 buyer guides); managed-SOC floor USD 1,000/month; ISO 27001 small-org
              USD 6-40K total
Model: Y1 (2027) monthly build; Y2 (2028), Y3 (2029) annual. ETB-denominated contracts.
"""
import json, os

FX = 160.93        # ETB per USD — NBE indicative interbank mid-rate, 12 Nov 2026 (real, observed)
ESC = 0.10         # annual salary escalation — planned below the 14.6% Oct 2026 headline inflation
MEDIAN_SWE = 55_738  # levels.fyi median SWE monthly pay, Addis Ababa, Nov 2026 (anchor)

# ── Pricing (ETB) — list prices, benchmarked against current global comparables ──
PRICE = {
    "bank_sub_annual": 1_800_000,    # = USD 11,185 -> 56% of Vendr median GRC platform (USD 20K/yr)
    "mfi_sub_annual": 540_000,       # = USD 3,354  -> MFI/mid-market tier
    "vapt_engagement": 450_000,      # = USD 2,799  -> 56% of the USD 5,000 global floor for web-app pentests
    "soc_retainer_monthly": 150_000,  # = USD 932   -> below the USD 1,000/month managed-SOC minimum
    "training_engagement": 300_000,  # = USD 1,865  -> awareness engagement
}

# ── Y1 2027: monthly revenue build (same commercial plan; ETB contracts) ─────
months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
y1_rev = {m: 0 for m in months}
for m in ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]:
    y1_rev[m] += PRICE["bank_sub_annual"] // 12   # bank #1 subscription (Jul-Dec)
for m in ["Oct", "Nov", "Dec"]:
    y1_rev[m] += PRICE["mfi_sub_annual"] // 12 * 2          # 2 MFIs (Oct-Dec)
y1_rev["Aug"] += PRICE["vapt_engagement"]                   # VAPT engagements x4
y1_rev["Sep"] += PRICE["vapt_engagement"]
y1_rev["Nov"] += PRICE["vapt_engagement"]
y1_rev["Dec"] += PRICE["vapt_engagement"]
for m in ["Oct", "Nov", "Dec"]:
    y1_rev[m] += PRICE["soc_retainer_monthly"]              # 1 SOC retainer from Oct
y1_rev["Sep"] += PRICE["training_engagement"]               # training x2
y1_rev["Nov"] += PRICE["training_engagement"]
Y1_REV = sum(y1_rev.values())

# ── Y1 2027: monthly cost build — two founders from February ────────────────
sal_plan = [  # role, monthly ETB (anchored to levels.fyi median), start month (1-12)
    ("Founder / CEO — Solomon Asalif", 75_000, 2),      # 1.35x median (founder discount)
    ("Co-founder / CTO — Zelalem Tsegaye", 130_000, 2),  # 2.33x median (senior security band)
    ("Full-stack Engineer", 90_000, 7),                  # 1.6x median
    ("SOC Analyst", 75_000, 9),                          # 1.35x median
    ("Operations & Admin (PT)", 50_000, 7),              # 0.9x median (part-time)
]
y1_salary = {m: 0 for m in months}
for role, mo, start in sal_plan:
    for i in range(start, 13):
        y1_salary[months[i - 1]] += mo
Y1_SALARIES = sum(y1_salary.values())
y1_other = {  # non-salary items, each benchmarked
    "Hosting & tooling": 75_000 * 12,        # USD 5,592/yr — Ethiopian cloud hosting + tooling for ~25 users
    "ISO 27001 certification": 2_250_000,    # USD 13,982 — mid of the USD 6-40K small-org range (Vanta/StrongDM)
    "Legal & registration": 900_000,         # PLC formation, BDU tech-transfer agreement, IP ledger
    "Pilot operations": 450_000,             # pilot delivery, travel, evidence collection
    "Marketing & BD": 600_000,               # USD 3,729 — pilot-stage BD
}
Y1_OTHER = sum(y1_other.values())
Y1_SUBTOTAL = Y1_SALARIES + Y1_OTHER
Y1_CONT = round(Y1_SUBTOTAL * 0.10, -3)     # 10% contingency, rounded to ETB 1,000
Y1_COSTS = Y1_SUBTOTAL + Y1_CONT

# ── Y2 2028 (annual; salaries escalated 10% = ESC, below 14.6% inflation) ────
y2_rev = {
    "Bank subscriptions": 1 * PRICE["bank_sub_annual"] + 5 * PRICE["bank_sub_annual"] // 2,
    "MFI subscriptions": 2 * PRICE["mfi_sub_annual"] + 4 * PRICE["mfi_sub_annual"] // 2,
    "VAPT engagements": 10 * PRICE["vapt_engagement"],
    "SOC retainers": (12 + 3 * 6) * PRICE["soc_retainer_monthly"],
    "Awareness training": 6 * PRICE["training_engagement"],
}
Y2_REV = sum(y2_rev.values())
y2_sal = {  # annual ETB, rates x1.10
    "Founder / CEO — Solomon Asalif": round(75_000 * (1 + ESC) * 12, -3),
    "Co-founder / CTO — Zelalem Tsegaye": round(130_000 * (1 + ESC) * 12, -3),
    "Full-stack Engineer": round(90_000 * (1 + ESC) * 12, -3),
    "Full-stack Engineer #2": round(90_000 * (1 + ESC) * 12, -3),
    "SOC Manager": round(140_000 * (1 + ESC) * 12, -3),          # 2.5x median
    "SOC Analysts (2)": round(75_000 * (1 + ESC) * 12 * 2, -3),
    "SOC Analyst #3 (from Jul)": round(75_000 * (1 + ESC) * 6, -3),
    "Partnerships & Sales Lead": round(100_000 * (1 + ESC) * 12, -3),  # 1.8x median
    "Operations & Admin": round(70_000 * (1 + ESC) * 12, -3),     # 1.25x median
}
y2_other = {
    "Hosting & tooling": 150_000 * 12,   # scales with client count (6 banks + 6 MFIs live)
    "ISO 27001 surveillance": 450_000,   # ~20% of initial audit — within surveillance norms
    "Legal & professional": 900_000,
    "Marketing & BD": 1_800_000,         # 9.4% of revenue — B2B SaaS norm is 5-15%
    "Office & misc": 1_200_000,          # USD 7,456/yr shared office, Addis Ababa
}
Y2_SUBTOTAL = sum(y2_sal.values()) + sum(y2_other.values())
Y2_CONT = round(Y2_SUBTOTAL * 0.10, -3)
Y2_COSTS = Y2_SUBTOTAL + Y2_CONT

# ── Y3 2029 (annual; salaries escalated cumulatively x1.21) ─────────────────
y3_rev = {
    "Bank subscriptions": 6 * PRICE["bank_sub_annual"] + 6 * PRICE["bank_sub_annual"] // 2,
    "MFI subscriptions": 6 * PRICE["mfi_sub_annual"] + 10 * PRICE["mfi_sub_annual"] // 2,
    "VAPT engagements": 18 * PRICE["vapt_engagement"],
    "SOC retainers": (4 * 12 + 4 * 6) * PRICE["soc_retainer_monthly"],
    "Awareness training": 12 * PRICE["training_engagement"],
}
Y3_REV = sum(y3_rev.values())
y3_sal = {  # annual ETB, rates x1.10x1.10
    "Founder / CEO — Solomon Asalif": round(75_000 * (1 + ESC) ** 2 * 12, -3),
    "Co-founder / CTO — Zelalem Tsegaye": round(130_000 * (1 + ESC) ** 2 * 12, -3),
    "Full-stack Engineers (3)": round(90_000 * (1 + ESC) ** 2 * 12 * 3, -3),
    "SOC Manager": round(140_000 * (1 + ESC) ** 2 * 12, -3),
    "SOC Analysts (6)": round(75_000 * (1 + ESC) ** 2 * 12 * 6, -3),
    "Partnerships & Sales (2)": round(100_000 * (1 + ESC) ** 2 * 12 * 2, -3),
    "Operations & Admin (2)": round(70_000 * (1 + ESC) ** 2 * 12 * 2, -3),
}
y3_other = {
    "Hosting & tooling": 300_000 * 12,
    "Certifications & audits": 900_000,
    "Legal & professional": 1_350_000,
    "Marketing & BD": 3_600_000,         # 8.1% of revenue
    "Office & misc": 2_400_000,
}
Y3_SUBTOTAL = sum(y3_sal.values()) + sum(y3_other.values())
Y3_CONT = round(Y3_SUBTOTAL * 0.10, -3)
Y3_COSTS = Y3_SUBTOTAL + Y3_CONT

ASK = 10_000_000
y1_net, y2_net, y3_net = Y1_REV - Y1_COSTS, Y2_REV - Y2_COSTS, Y3_REV - Y3_COSTS

# ── Feasibility math (computed, not asserted) ───────────────────────────────
MKT_2025, CAGR = 361.1e6, 0.0816          # IMARC, USD
mkt = {y: MKT_2025 * (1 + CAGR) ** (y - 2025) for y in (2027, 2028, 2029)}
rev_usd = [Y1_REV / FX, Y2_REV / FX, Y3_REV / FX]
share = [rev_usd[i] / mkt[2027 + i] for i in range(3)]
TAM_SUBS = 31 * PRICE["bank_sub_annual"] + 59 * PRICE["mfi_sub_annual"]  # 31 banks + 59 MFIs (NBE, June 2025)
y3_subs_rev = y3_rev["Bank subscriptions"] + y3_rev["MFI subscriptions"]

numbers = {
    "fx_etb_per_usd": FX,
    "ask_etb": ASK,
    "runway_months": 18,
    "use_of_funds": {
        "Product & engineering": 0.40,
        "SOC stand-up & certification": 0.25,
        "Sales & pilot delivery": 0.20,
        "Legal & registration": 0.10,
        "Working-capital buffer": 0.05,
    },
    "price": PRICE,
    "y1": {
        "revenue_monthly": y1_rev, "revenue_total": Y1_REV,
        "salaries_monthly": y1_salary, "salaries_total": Y1_SALARIES,
        "other_costs": y1_other, "contingency": Y1_CONT, "costs_total": Y1_COSTS,
        "net": y1_net, "fte_eoy": 5,
        "subs_eoy": {"banks": 1, "mfis": 2}, "vapt": 4, "soc_clients": 1, "training": 2,
    },
    "y2": {
        "revenue_lines": y2_rev, "revenue_total": Y2_REV,
        "salaries": y2_sal, "other_costs": y2_other,
        "contingency": Y2_CONT, "costs_total": Y2_COSTS,
        "net": y2_net, "fte_eoy": 10,
        "subs_eoy": {"banks": 6, "mfis": 6}, "vapt": 10, "soc_clients": 4, "training": 6,
    },
    "y3": {
        "revenue_lines": y3_rev, "revenue_total": Y3_REV,
        "salaries": y3_sal, "other_costs": y3_other,
        "contingency": Y3_CONT, "costs_total": Y3_COSTS,
        "net": y3_net, "fte_eoy": 16,
        "subs_eoy": {"banks": 12, "mfis": 16}, "vapt": 18, "soc_clients": 8, "training": 12,
    },
    "summary": {
        "revenue": [Y1_REV, Y2_REV, Y3_REV],
        "costs": [Y1_COSTS, Y2_COSTS, Y3_COSTS],
        "net": [y1_net, y2_net, y3_net],
        "revenue_usd": [round(v) for v in rev_usd],
        "ask_usd": round(ASK / FX),
    },
    "basis": {
        "prepared": "November 2026",
        "fx_note": "NBE Indicative Daily Exchange Rate, 12 Nov 2026 (nbe.gov.et/exchange)",
        "inflation_note": "ESS headline inflation 14.6% (Oct 2026); salaries escalated 10%/yr in the plan",
        "salary_anchor": f"levels.fyi median software-engineer pay, Addis Ababa: ETB {MEDIAN_SWE:,}/month (Nov 2026); roles set at 1.25-2.5x median",
        "escalation": ESC,
        "market": "IMARC Group: USD 361.1M (2025) to USD 746.6M (2034), CAGR 8.16%",
        "institutions": "NBE Annual Report 2024/25: 31 commercial banks (+DBE) and 59 MFIs licensed at June 2025",
        "sources": [
            "National Bank of Ethiopia — Indicative Daily Exchange Rate, 12 Nov 2026 (nbe.gov.et/exchange)",
            "IMARC Group — Ethiopia Cybersecurity Market, 2025-2034 (imarcgroup.com)",
            "NBE Annual Report 2024/25 & Financial Stability Report — bank and MFI counts, June 2025",
            "levels.fyi — Software Engineer salary, Addis Ababa, median ETB 55,738/month, Nov 2026",
            "Ethiopian Statistical Service (via Trading Economics) — headline inflation 14.6%, Oct 2026",
            "Vendr — independent SaaS procurement data, median annual Vanta spend approx. USD 20,000",
            "Blaze InfoSec / Stingrai / Synack 2026 pricing guides — web application penetration testing USD 5,000-30,000",
            "Managed SOC pricing guides 2026 — USD 1,000/month minimum, USD 5-25 per endpoint/month",
            "Vanta / StrongDM ISO 27001 cost guides — USD 6,000-40,000 total for a small organisation",
        ],
        "pricing_benchmarks": [
            ["Bank platform subscription", 1_800_000, "USD 11,185/yr — 56% of the USD 20K median for GRC compliance platforms (Vendr)"],
            ["MFI platform subscription", 540_000, "USD 3,354/yr — small-institution tier"],
            ["VAPT engagement", 450_000, "USD 2,799 — 56% of the USD 5,000 global floor for web-app penetration tests (2026 guides)"],
            ["SOC/CERT retainer", 150_000, "USD 932/month — below the USD 1,000/month managed-SOC entry price (2026 guides)"],
            ["Awareness training engagement", 300_000, "USD 1,865 — Amharic-first delivery no international vendor offers"],
        ],
        "feasibility": {
            "market_2027_2029_usd": [round(mkt[y] / 1e6, 1) for y in (2027, 2028, 2029)],
            "our_share_pct": [round(s * 100, 4) for s in share],
            "subscription_tam_etb": TAM_SUBS,
            "y3_subs_share_of_tam_pct": round(y3_subs_rev / TAM_SUBS * 100, 1),
            "y3_bank_share_pct": round(12 / 31 * 100, 1),
            "y3_mfi_share_pct": round(16 / 59 * 100, 1),
            "cum_net_2027_2028": y1_net + y2_net,
            "ask_coverage_of_2yr_burn": round(ASK / -(y1_net + y2_net), 2),
        },
    },
}

out = "scripts/docgen/numbers.json"
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump(numbers, f, indent=2)

print(f"FX {FX} (NBE, 12 Nov 2026) | ask ETB {ASK:,} = USD {ASK/FX:,.0f}")
print(f"Y1: revenue {Y1_REV:,.0f} costs {Y1_COSTS:,.0f} net {y1_net:,.0f} (salaries {Y1_SALARIES:,.0f})")
print(f"Y2: revenue {Y2_REV:,.0f} costs {Y2_COSTS:,.0f} net {y2_net:,.0f} (salaries {sum(y2_sal.values()):,.0f})")
print(f"Y3: revenue {Y3_REV:,.0f} costs {Y3_COSTS:,.0f} net {y3_net:,.0f} (salaries {sum(y3_sal.values()):,.0f})")
print(f"Cumulative 2027-2028 net: {y1_net+y2_net:,.0f}; ask coverage: {ASK/-(y1_net+y2_net):.2f}x")
print(f"Market USD M 2027-2029: {[round(mkt[y]/1e6,1) for y in (2027,2028,2029)]}; our share %: {[round(s*100,3) for s in share]}")
print(f"Subscription TAM ETB {TAM_SUBS:,.0f}; Y3 subs share {y3_subs_rev/TAM_SUBS*100:.1f}%")
print(f"Y1 monthly salary check: Feb={y1_salary['Feb']:,} Jul={y1_salary['Jul']:,} Sep={y1_salary['Sep']:,} Dec={y1_salary['Dec']:,}")
