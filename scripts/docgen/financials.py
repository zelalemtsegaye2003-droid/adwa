"""Adwa Sec startup package — locked financial model (single source of truth).
3-year ETB planning model: Y1 (2027) monthly, Y2 (2028), Y3 (2029) annual.
All documents (docx/xlsx/pptx) read numbers.json for consistency.
"""
import json, os

FX = 150.0  # ETB per USD — planning assumption, adjustable in the xlsx

# ── Pricing (ETB) ─────────────────────────────────────────────────────────
PRICE = {
    "bank_sub_annual": 1_800_000,   # platform subscription, bank tier
    "mfi_sub_annual": 540_000,      # platform subscription, MFI tier
    "vapt_engagement": 450_000,     # per VAPT engagement
    "soc_retainer_monthly": 150_000,  # SOC/CERT retainer per month
    "training_engagement": 300_000,   # awareness training engagement
}

# ── Y1 2027: monthly revenue build ────────────────────────────────────────
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

# ── Y1 2027: monthly cost build ───────────────────────────────────────────
sal_plan = [  # role, monthly ETB, start month (1-12)
    ("Founder / CEO", 75_000, 2),
    ("Senior Security Engineer", 150_000, 2),
    ("Full-stack Engineer", 120_000, 7),
    ("SOC Analyst", 90_000, 9),
    ("Operations & Admin (PT)", 60_000, 7),
]
y1_salary = {m: 0 for m in months}
for role, mo, start in sal_plan:
    for i in range(start, 13):
        y1_salary[months[i - 1]] += mo
Y1_SALARIES = sum(y1_salary.values())
y1_other = {  # non-salary monthly / allocated items
    "Hosting & tooling": 75_000 * 12,
    "ISO 27001 certification": 2_250_000,
    "Legal & registration": 900_000,
    "Pilot operations": 450_000,
    "Marketing & BD": 600_000,
}
Y1_OTHER = sum(y1_other.values())
Y1_SUBTOTAL = Y1_SALARIES + Y1_OTHER
Y1_CONT = round(Y1_SUBTOTAL * 0.10)
Y1_COSTS = Y1_SUBTOTAL + Y1_CONT

# ── Y2 2028 (annual) ───────────────────────────────────────────────────────
y2_rev = {
    "Bank subscriptions": 1 * PRICE["bank_sub_annual"] + 5 * PRICE["bank_sub_annual"] // 2,
    "MFI subscriptions": 2 * PRICE["mfi_sub_annual"] + 4 * PRICE["mfi_sub_annual"] // 2,
    "VAPT engagements": 10 * PRICE["vapt_engagement"],
    "SOC retainers": (12 + 3 * 6) * PRICE["soc_retainer_monthly"],
    "Awareness training": 6 * PRICE["training_engagement"],
}
Y2_REV = sum(y2_rev.values())
y2_sal = {
    "Founder / CEO": 75_000 * 12,
    "Senior Security Engineer": 150_000 * 12,
    "Full-stack Engineer": 120_000 * 12,
    "Full-stack Engineer #2": 120_000 * 12,
    "SOC Manager": 180_000 * 12,
    "SOC Analysts (2)": 90_000 * 12 * 2,
    "SOC Analyst #3 (from Jul)": 90_000 * 6,
    "Partnerships & Sales Lead": 120_000 * 12,
    "Operations & Admin": 90_000 * 12,
}
y2_other = {
    "Hosting & tooling": 150_000 * 12,
    "ISO 27001 surveillance": 450_000,
    "Legal & professional": 900_000,
    "Marketing & BD": 1_800_000,
    "Office & misc": 1_200_000,
}
Y2_SUBTOTAL = sum(y2_sal.values()) + sum(y2_other.values())
Y2_CONT = round(Y2_SUBTOTAL * 0.10)
Y2_COSTS = Y2_SUBTOTAL + Y2_CONT

# ── Y3 2029 (annual) ───────────────────────────────────────────────────────
y3_rev = {
    "Bank subscriptions": 6 * PRICE["bank_sub_annual"] + 6 * PRICE["bank_sub_annual"] // 2,
    "MFI subscriptions": 6 * PRICE["mfi_sub_annual"] + 10 * PRICE["mfi_sub_annual"] // 2,
    "VAPT engagements": 18 * PRICE["vapt_engagement"],
    "SOC retainers": (4 * 12 + 4 * 6) * PRICE["soc_retainer_monthly"],
    "Awareness training": 12 * PRICE["training_engagement"],
}
Y3_REV = sum(y3_rev.values())
y3_sal = {
    "Founder / CEO": 75_000 * 12,
    "Senior Security Engineer / CTO": 180_000 * 12,
    "Full-stack Engineers (3)": 120_000 * 12 * 3,
    "SOC Manager": 180_000 * 12,
    "SOC Analysts (6)": 90_000 * 12 * 6,
    "Partnerships & Sales (2)": 120_000 * 12 * 2,
    "Operations & Admin (2)": 90_000 * 12 * 2,
}
y3_other = {
    "Hosting & tooling": 300_000 * 12,
    "Certifications & audits": 900_000,
    "Legal & professional": 1_350_000,
    "Marketing & BD": 3_600_000,
    "Office & misc": 2_400_000,
}
Y3_SUBTOTAL = sum(y3_sal.values()) + sum(y3_other.values())
Y3_CONT = round(Y3_SUBTOTAL * 0.10)
Y3_COSTS = Y3_SUBTOTAL + Y3_CONT

ASK = 10_000_000
y1_net, y2_net, y3_net = Y1_REV - Y1_COSTS, Y2_REV - Y2_COSTS, Y3_REV - Y3_COSTS

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
        "net": y2_net, "fte_eoy": 11,
        "subs_eoy": {"banks": 6, "mfis": 6}, "vapt": 10, "soc_clients": 4, "training": 6,
    },
    "y3": {
        "revenue_lines": y3_rev, "revenue_total": Y3_REV,
        "salaries": y3_sal, "other_costs": y3_other,
        "contingency": Y3_CONT, "costs_total": Y3_COSTS,
        "net": y3_net, "fte_eoy": 20,
        "subs_eoy": {"banks": 12, "mfis": 16}, "vapt": 18, "soc_clients": 8, "training": 12,
    },
    "summary": {
        "revenue": [Y1_REV, Y2_REV, Y3_REV],
        "costs": [Y1_COSTS, Y2_COSTS, Y3_COSTS],
        "net": [y1_net, y2_net, y3_net],
        "revenue_usd": [round(Y1_REV / FX), round(Y2_REV / FX), round(Y3_REV / FX)],
        "ask_usd": round(ASK / FX),
    },
}

out = "/adwa/scripts/docgen/numbers.json"
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump(numbers, f, indent=2)

print(f"Y1: revenue {Y1_REV:,.0f} costs {Y1_COSTS:,.0f} net {y1_net:,.0f}")
print(f"Y2: revenue {Y2_REV:,.0f} costs {Y2_COSTS:,.0f} net {y2_net:,.0f}")
print(f"Y3: revenue {Y3_REV:,.0f} costs {Y3_COSTS:,.0f} net {y3_net:,.0f}")
print(f"Ask ETB {ASK:,} (~USD {ASK/FX:,.0f}); cumulative net through Y3: {y1_net+y2_net+y3_net:,.0f}")
print("Y1 revenue check:", sum(y1_rev.values()) == Y1_REV)
print("Y2 in-year retainer months:", (12 + 3 * 6), "->", y2_rev["SOC retainers"])
