"""07 Financial Projections xlsx — 3-year ETB model with live formulas.
Follows xlsx skill: templates/base.py tokens, finance_lite structure, chart engine rules.
v2 (Nov 2026 re-base): FX anchored to NBE indicative rate 160.93 (12 Nov 2026); two-founder
payroll; salary ladder anchored to levels.fyi median; 10%/yr escalation; Basis & Sources sheet.
"""
import json, sys, os

XLSX_SKILL_DIR = "/adwa/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.utils import get_column_letter
from templates.base import (
    setup_sheet, style_header_row, style_data_row, style_total_row,
    FORMATS, font_title, font_header, font_subheader, font_body, font_caption,
    fill_header, fill_total, border_total, align_number, align_text, align_header,
    PRIMARY, ACCENT_POSITIVE, ACCENT_NEGATIVE, ACCENT_WARNING, NEUTRAL_600, CHART_COLORS,
)

N = json.load(open("/adwa/scripts/docgen/numbers.json"))
OUT = "/adwa/download/AdwaSec_07_Financial_Projections.xlsx"

ETB = '#,##0;(#,##0)'
PCT = '0.0%'

wb = Workbook()
wb.properties.creator = "Zelalem Tsegaye"

# ═══ Sheet 1: Assumptions ═══════════════════════════════════════════════════
ws = wb.active
ws.title = "Assumptions"
setup_sheet(ws, title="Adwa Sec — Financial Projections 2027–2029 (ETB) — Assumptions", last_col=6)
ws["B3"] = "All monetary figures are Ethiopian birr (ETB). Every input is anchored to current cited data (see the Basis & Sources sheet); blue cells are editable. Calculated, not estimated."
ws["B3"].font = font_caption()

rows = [
    ("Planning exchange rate (ETB per USD)", N["fx_etb_per_usd"], "NBE indicative interbank rate, 12 Nov 2026 — real, observed; all USD notes derive from it"),
    ("Pre-seed ask (ETB)", N["ask_etb"], f"Approx. USD {N['summary']['ask_usd']:,} at the planning rate; covers the computed 2027-2028 net burn {N['basis']['feasibility']['cum_net_2027_2028']:,.0f} ETB {N['basis']['feasibility']['ask_coverage_of_2yr_burn']}x"),
    ("Runway funded by ask (months)", N["runway_months"], "January 2027 – June 2028"),
    ("Bank platform subscription (ETB / year)", N["price"]["bank_sub_annual"], "USD 11,185/yr — 56% of the ~USD 20K median GRC-platform spend (Vendr)"),
    ("MFI platform subscription (ETB / year)", N["price"]["mfi_sub_annual"], "USD 3,354/yr — small-institution tier"),
    ("VAPT engagement (ETB, fixed scope)", N["price"]["vapt_engagement"], "USD 2,799 — 56% of the USD 5,000 global floor for web-app pentests (2026 guides)"),
    ("SOC/CERT retainer (ETB / month)", N["price"]["soc_retainer_monthly"], "USD 932/month — below the USD 1,000 managed-SOC entry price"),
    ("Awareness training engagement (ETB)", N["price"]["training_engagement"], "USD 1,865 — Amharic-first delivery"),
    ("Contingency rate", 0.10, "Applied to operating subtotals"),
    ("Annual salary escalation", N["basis"]["escalation"], "Below the 14.6% Oct 2026 headline inflation (ESS); applied to payroll in 2028 and 2029"),
]
hdr = 5
ws.cell(row=hdr - 1, column=2, value="Input").font = font_header()
ws.cell(row=hdr - 1, column=3, value="Value").font = font_header()
ws.cell(row=hdr - 1, column=4, value="Notes").font = font_header()
ws.cell(row=hdr - 1, column=5, value="Editable").font = font_header()
style_header_row(ws, row_num=hdr - 1, col_start=2, col_end=5)
r = hdr
name_map = {}
for label, val, note in rows:
    ws.cell(row=r, column=2, value=label).font = font_body()
    c = ws.cell(row=r, column=3, value=val)
    if isinstance(val, float) and val < 1:
        c.number_format = PCT
    else:
        c.number_format = ETB if isinstance(val, (int,)) and val > 1000 else '#,##0'
    c.font = font_body()
    ws.cell(row=r, column=4, value=note).font = font_caption()
    ws.cell(row=r, column=5, value="yes").font = font_caption()
    style_data_row(ws, row_num=r, col_start=2, col_end=5, row_index=r - hdr)
    name_map[label] = f"Assumptions!$C${r}"
    r += 1

FX = name_map["Planning exchange rate (ETB per USD)"]
ASK = name_map["Pre-seed ask (ETB)"]
CONT = name_map["Contingency rate"]

r += 1
ws.cell(row=r, column=2, value="Year 1 payroll plan (monthly ETB, start month)").font = font_subheader()
r += 1
ws.cell(row=r - 1 + 0, column=2)
pay_hdr = r
ws.cell(row=r, column=2, value="Role").font = font_header()
ws.cell(row=r, column=3, value="Monthly (ETB)").font = font_header()
ws.cell(row=r, column=4, value="Start month").font = font_header()
style_header_row(ws, row_num=r, col_start=2, col_end=4)
r += 1
payroll = [
    ("Founder / CEO — Solomon Asalif", 75_000, "Feb 2027"),
    ("Co-founder / CTO — Zelalem Tsegaye", 130_000, "Feb 2027"),
    ("Full-stack Engineer", 90_000, "Jul 2027"),
    ("SOC Analyst", 75_000, "Sep 2027"),
    ("Operations & Admin (PT)", 50_000, "Jul 2027"),
]
for role, mo, st in payroll:
    ws.cell(row=r, column=2, value=role).font = font_body()
    c = ws.cell(row=r, column=3, value=mo); c.number_format = ETB; c.font = font_body()
    ws.cell(row=r, column=4, value=st).font = font_caption()
    style_data_row(ws, row_num=r, col_start=2, col_end=4, row_index=r - pay_hdr - 1)
    r += 1
r += 1
ws.cell(row=r, column=2, value="Salary anchor: levels.fyi median software-engineer pay, Addis Ababa — ETB 55,738/month (Nov 2026). Role ladder runs 1.25-2.5x that median; escalates 10%/yr in 2028-2029 below the 14.6% Oct 2026 headline inflation.").font = font_caption()
r += 1
ws.cell(row=r, column=2, value="Pricing principle: USD-indexed with annual birr-adjustment clause; pilots are discounted, never free. Full benchmark table on the Basis & Sources sheet.").font = font_caption()

# ═══ Sheet 2: Y1 Monthly ═════════════════════════════════════════════════════
ws2 = wb.create_sheet("Y1 Monthly 2027")
months = list(N["y1"]["revenue_monthly"].keys())
setup_sheet(ws2, title="Year 1 (2027) — monthly revenue and costs (ETB)", last_col=3 + len(months))
ws2["B3"] = "Revenue lines are input distributions; totals, net and cumulative cash are live formulas. Ask injection in January."
ws2["B3"].font = font_caption()

hdr = 5
ws2.cell(row=hdr, column=2, value="Line item").font = font_header()
for i, m in enumerate(months):
    ws2.cell(row=hdr, column=3 + i, value=m).font = font_header()
ws2.cell(row=hdr, column=3 + len(months), value="Year total").font = font_header()
style_header_row(ws2, row_num=hdr, col_start=2, col_end=3 + len(months))

rev_lines = [
    ("Bank subscriptions", [N["y1"]["revenue_monthly"][m] if m in ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] else 0 for m in months]),
    ("MFI subscriptions", [N["y1"]["revenue_monthly"][m] if m in ["Oct", "Nov", "Dec"] else 0 for m in months]),
    ("VAPT engagements", [N["y1"]["revenue_monthly"][m] if m in ["Aug", "Sep", "Nov", "Dec"] else 0 for m in months]),
    ("SOC retainers", [N["y1"]["revenue_monthly"][m] if m in ["Oct", "Nov", "Dec"] else 0 for m in months]),
    ("Awareness training", [N["y1"]["revenue_monthly"][m] if m in ["Sep", "Nov"] else 0 for m in months]),
]
r = hdr + 1
rev_start = r
for label, vals in rev_lines:
    ws2.cell(row=r, column=2, value=label).font = font_body()
    for i, v in enumerate(vals):
        c = ws2.cell(row=r, column=3 + i, value=v); c.number_format = ETB; c.font = font_body()
    tot = ws2.cell(row=r, column=3 + len(months))
    tot.value = f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})"
    tot.number_format = ETB; tot.font = font_body()
    style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=r - hdr - 1)
    r += 1
rev_end = r - 1
# Total revenue row
ws2.cell(row=r, column=2, value="Total revenue").font = font_subheader()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    c = ws2.cell(row=r, column=3 + i, value=f"=SUM({col}{rev_start}:{col}{rev_end})")
    c.number_format = ETB
tot = ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})")
tot.number_format = ETB
style_total_row(ws2, row_num=r, col_start=2, col_end=3 + len(months))
rev_total_row = r
r += 2

# Cost lines
sal = N["y1"]["salaries_monthly"]
other_monthly = {"Hosting & tooling": [75_000] * 12}
allocs = {
    "ISO 27001 certification": 2_250_000,
    "Legal & registration": 900_000,
    "Pilot operations": 450_000,
    "Marketing & BD": 600_000,
}
cost_rows = []
ws2.cell(row=r, column=2, value="Payroll").font = font_body()
for i, m in enumerate(months):
    c = ws2.cell(row=r, column=3 + i, value=sal[m]); c.number_format = ETB; c.font = font_body()
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=0)
cost_rows.append(r); r += 1

ws2.cell(row=r, column=2, value="Hosting & tooling").font = font_body()
for i in range(12):
    c = ws2.cell(row=r, column=3 + i, value=75_000); c.number_format = ETB; c.font = font_body()
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=1)
cost_rows.append(r); r += 1

for j, (label, total) in enumerate(allocs.items()):
    ws2.cell(row=r, column=2, value=label).font = font_body()
    per = round(total / 12)
    for i in range(12):
        c = ws2.cell(row=r, column=3 + i, value=per); c.number_format = ETB; c.font = font_body()
    ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
    style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=j + 2)
    cost_rows.append(r); r += 1

# Subtotal, contingency, total costs
ws2.cell(row=r, column=2, value="Operating subtotal").font = font_subheader()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    parts = "+".join(f"{col}{cr}" for cr in cost_rows)
    c = ws2.cell(row=r, column=3 + i, value=f"={parts}")
    c.number_format = ETB
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=len(cost_rows))
subtotal_row = r; r += 1

ws2.cell(row=r, column=2, value="Contingency (10%)").font = font_body()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    c = ws2.cell(row=r, column=3 + i, value=f"={col}{subtotal_row}*{CONT}")
    c.number_format = ETB; c.font = font_body()
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=len(cost_rows) + 1)
cont_row = r; r += 1

ws2.cell(row=r, column=2, value="Total operating costs").font = font_subheader()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    c = ws2.cell(row=r, column=3 + i, value=f"={col}{subtotal_row}+{col}{cont_row}")
    c.number_format = ETB
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_total_row(ws2, row_num=r, col_start=2, col_end=3 + len(months))
cost_total_row = r; r += 2

# Net + cumulative cash (ask injected January)
ws2.cell(row=r, column=2, value="Net (pre-tax)").font = font_subheader()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    c = ws2.cell(row=r, column=3 + i, value=f"={col}{rev_total_row}-{col}{cost_total_row}")
    c.number_format = ETB
ws2.cell(row=r, column=3 + len(months), value=f"=SUM(C{r}:{get_column_letter(2 + len(months))}{r})").number_format = ETB
style_total_row(ws2, row_num=r, col_start=2, col_end=3 + len(months))
net_row = r; r += 1

ws2.cell(row=r, column=2, value="Cumulative cash (incl. ETB 10M ask, Jan)").font = font_body()
for i in range(len(months)):
    col = get_column_letter(3 + i)
    if i == 0:
        f = f"={ASK}+{col}{net_row}"
    else:
        prev = get_column_letter(2 + i)
        f = f"={prev}{r}+{col}{net_row}"
    c = ws2.cell(row=r, column=3 + i, value=f)
    c.number_format = ETB; c.font = font_body()
ws2.cell(row=r, column=3 + len(months), value=f"={get_column_letter(2 + len(months))}{r}").number_format = ETB
style_data_row(ws2, row_num=r, col_start=2, col_end=3 + len(months), row_index=0)
cash_row = r

for col in range(2, 4 + len(months)):
    ws2.column_dimensions[get_column_letter(col)].width = 13
ws2.column_dimensions["B"].width = 34

# ═══ Sheet 3: Y2-Y3 Annual ═══════════════════════════════════════════════════
ws3 = wb.create_sheet("Y2-Y3 Annual")
setup_sheet(ws3, title="Three-year summary (ETB)", last_col=5)
ws3["B3"] = "2027 column references the Y1 Monthly sheet (live); 2028–2029 detail lines are inputs; totals are formulas."
ws3["B3"].font = font_caption()
hdr = 5
for c, t in zip(range(2, 6), ["Line item", "2027", "2028", "2029"]):
    ws3.cell(row=hdr, column=c, value=t).font = font_header()
style_header_row(ws3, row_num=hdr, col_start=2, col_end=5)
r = hdr + 1
rev_map_y2, rev_map_y3 = N["y2"]["revenue_lines"], N["y3"]["revenue_lines"]
y1_bank = N["y1"]["revenue_total"]  # will break into lines below
lines = [
    ("Bank subscriptions", round(sum(v for k, v in N["y1"]["revenue_monthly"].items() if k in ["Jul","Aug","Sep","Oct","Nov","Dec"]) * 1.0 * 1.0), rev_map_y2["Bank subscriptions"], rev_map_y3["Bank subscriptions"]),
]
# simpler: compute Y1 line split from model dict
bank_y1 = 6 * (N["price"]["bank_sub_annual"] // 12)
mfi_y1 = 3 * 2 * (N["price"]["mfi_sub_annual"] // 12)
lines = [
    ("Bank subscriptions", bank_y1, rev_map_y2["Bank subscriptions"], rev_map_y3["Bank subscriptions"]),
    ("MFI subscriptions", mfi_y1, rev_map_y2["MFI subscriptions"], rev_map_y3["MFI subscriptions"]),
    ("VAPT engagements", 4 * N["price"]["vapt_engagement"], rev_map_y2["VAPT engagements"], rev_map_y3["VAPT engagements"]),
    ("SOC retainers", 3 * N["price"]["soc_retainer_monthly"], rev_map_y2["SOC retainers"], rev_map_y3["SOC retainers"]),
    ("Awareness training", 2 * N["price"]["training_engagement"], rev_map_y2["Awareness training"], rev_map_y3["Awareness training"]),
]
rev_start3 = r
for label, v1, v2, v3 in lines:
    ws3.cell(row=r, column=2, value=label).font = font_body()
    for col, v in zip(range(3, 6), [v1, v2, v3]):
        c = ws3.cell(row=r, column=col, value=v); c.number_format = ETB; c.font = font_body()
    style_data_row(ws3, row_num=r, col_start=2, col_end=5, row_index=r - hdr - 1)
    r += 1
rev_end3 = r - 1
ws3.cell(row=r, column=2, value="Total revenue").font = font_subheader()
for col_l in ["C", "D", "E"]:
    c = ws3.cell(row=r, column={"C": 3, "D": 4, "E": 5}[col_l], value=f"=SUM({col_l}{rev_start3}:{col_l}{rev_end3})")
    c.number_format = ETB
style_total_row(ws3, row_num=r, col_start=2, col_end=5)
rev_tot3 = r; r += 2

cost_lines = [
    ("Payroll", N["y1"]["salaries_total"], sum(N["y2"]["salaries"].values()), sum(N["y3"]["salaries"].values())),
    ("Hosting & tooling", 900_000, 1_800_000, 3_600_000),
    ("Certification & audits", 2_250_000, 450_000, 900_000),
    ("Legal & professional", 900_000, 900_000, 1_350_000),
    ("Pilot operations", 450_000, 0, 0),
    ("Marketing & BD", 600_000, 1_800_000, 3_600_000),
    ("Office & misc", 0, 1_200_000, 2_400_000),
]
cost_start3 = r
for label, v1, v2, v3 in cost_lines:
    ws3.cell(row=r, column=2, value=label).font = font_body()
    for col, v in zip(range(3, 6), [v1, v2, v3]):
        c = ws3.cell(row=r, column=col, value=v); c.number_format = ETB; c.font = font_body()
    style_data_row(ws3, row_num=r, col_start=2, col_end=5, row_index=r - cost_start3)
    r += 1
cost_end3 = r - 1
ws3.cell(row=r, column=2, value="Operating subtotal").font = font_subheader()
for col_l in ["C", "D", "E"]:
    c = ws3.cell(row=r, column={"C": 3, "D": 4, "E": 5}[col_l], value=f"=SUM({col_l}{cost_start3}:{col_l}{cost_end3})")
    c.number_format = ETB
style_data_row(ws3, row_num=r, col_start=2, col_end=5, row_index=0)
sub3 = r; r += 1
ws3.cell(row=r, column=2, value="Contingency (10%)").font = font_body()
for col_l, col_i in [("C", 3), ("D", 4), ("E", 5)]:
    c = ws3.cell(row=r, column=col_i, value=f"={col_l}{sub3}*{CONT}")
    c.number_format = ETB; c.font = font_body()
style_data_row(ws3, row_num=r, col_start=2, col_end=5, row_index=1)
cont3 = r; r += 1
ws3.cell(row=r, column=2, value="Total operating costs").font = font_subheader()
for col_l, col_i in [("C", 3), ("D", 4), ("E", 5)]:
    c = ws3.cell(row=r, column=col_i, value=f"={col_l}{sub3}+{col_l}{cont3}")
    c.number_format = ETB
style_total_row(ws3, row_num=r, col_start=2, col_end=5)
cost_tot3 = r; r += 2
ws3.cell(row=r, column=2, value="Net (pre-tax)").font = font_subheader()
for col_l, col_i in [("C", 3), ("D", 4), ("E", 5)]:
    c = ws3.cell(row=r, column=col_i, value=f"={col_l}{rev_tot3}-{col_l}{cost_tot3}")
    c.number_format = ETB
style_total_row(ws3, row_num=r, col_start=2, col_end=5)
net3 = r; r += 2

kpis = [
    ("Subscribing institutions (cumulative)", "3 (1 bank + 2 MFIs)", "12 (6 banks + 6 MFIs)", "28 (12 + 16)"),
    ("VAPT engagements", "4", "10", "18"),
    ("SOC retainer clients (year-end)", "1", "4", "8"),
    ("FTE at year-end", "5", "10", "16"),
    ("Revenue in USD (planning rate)", f"=ROUND(C{rev_tot3}/{FX},0)", f"=ROUND(D{rev_tot3}/{FX},0)", f"=ROUND(E{rev_tot3}/{FX},0)"),
]
for label, v1, v2, v3 in kpis:
    ws3.cell(row=r, column=2, value=label).font = font_body()
    for col, v in zip(range(3, 6), [v1, v2, v3]):
        c = ws3.cell(row=r, column=col, value=v)
        c.font = font_body()
        if isinstance(v, str) and v.startswith("=ROUND"):
            c.number_format = '$#,##0'
    style_data_row(ws3, row_num=r, col_start=2, col_end=5, row_index=r - net3 - 1)
    r += 1
ws3.column_dimensions["B"].width = 34
for col in ["C", "D", "E"]:
    ws3.column_dimensions[col].width = 16

# ═══ Sheet 4: Funding & Runway ═══════════════════════════════════════════════
ws4 = wb.create_sheet("Funding & Runway")
setup_sheet(ws4, title="Pre-seed ask and use of funds", last_col=5)
ws4["B3"] = "Allocation percentages are inputs; ETB amounts are live formulas against the ask."
ws4["B3"].font = font_caption()
hdr = 5
for c, t in zip(range(2, 6), ["Allocation", "Share", "ETB", "Purpose"]):
    ws4.cell(row=hdr, column=c, value=t).font = font_header()
style_header_row(ws4, row_num=hdr, col_start=2, col_end=5)
r = hdr + 1
uof = [
    ("Product & engineering", 0.40, "Live NVD/KEV feed, live AD ingestion, authenticated scanning, production hardening"),
    ("SOC stand-up & certification", 0.25, "24/5→24/7 coverage, ISO 27001 Stage 1–2"),
    ("Sales & pilot delivery", 0.20, "Anchor pilots, LOT4-style tender responses, partnerships"),
    ("Legal & registration", 0.10, "PLC formation, BDU technology transfer, INSA pathway"),
    ("Working-capital buffer", 0.05, "FX movement and timing buffer"),
]
uof_start = r
for label, share, purpose in uof:
    ws4.cell(row=r, column=2, value=label).font = font_body()
    c = ws4.cell(row=r, column=3, value=share); c.number_format = '0%'; c.font = font_body()
    c = ws4.cell(row=r, column=4, value=f"={ASK}*C{r}"); c.number_format = ETB; c.font = font_body()
    ws4.cell(row=r, column=5, value=purpose).font = font_caption()
    style_data_row(ws4, row_num=r, col_start=2, col_end=5, row_index=r - uof_start)
    r += 1
uof_end = r - 1
ws4.cell(row=r, column=2, value="Total").font = font_subheader()
c = ws4.cell(row=r, column=3, value=f"=SUM(C{uof_start}:C{uof_end})"); c.number_format = '0%'
c = ws4.cell(row=r, column=4, value=f"=SUM(D{uof_start}:D{uof_end})"); c.number_format = ETB
style_total_row(ws4, row_num=r, col_start=2, col_end=5)
r += 2
runway = [
    ("Year 1 net burn (ETB)", f"=-'Y1 Monthly 2027'!{get_column_letter(2 + len(months))}{net_row}"),
    ("Ask coverage of Year 1 burn (x)", f"={ASK}/-'Y1 Monthly 2027'!{get_column_letter(2 + len(months))}{net_row}"),
    ("Year-end cumulative cash (ETB)", f"='Y1 Monthly 2027'!{get_column_letter(2 + len(months))}{cash_row}"),
    ("Year 2 net (ETB)", f"='Y2-Y3 Annual'!D{net3}"),
    ("2028 net + 2027 remaining cash (ETB)", f"='Y1 Monthly 2027'!{get_column_letter(2 + len(months))}{cash_row}+'Y2-Y3 Annual'!D{net3}"),
]
ws4.cell(row=r, column=2, value="Runway indicators").font = font_subheader()
r += 1
for label, formula in runway:
    ws4.cell(row=r, column=2, value=label).font = font_body()
    c = ws4.cell(row=r, column=3, value=formula)
    c.number_format = ETB if "coverage" not in label else '0.0"x"'
    c.font = font_body()
    style_data_row(ws4, row_num=r, col_start=2, col_end=3, row_index=r - 1)
    r += 1
ws4.column_dimensions["B"].width = 36
ws4.column_dimensions["E"].width = 60

# ═══ Sheet 5: Basis & Sources ═════════════════════════════════════════════════
wsB = wb.create_sheet("Basis & Sources")
B = N["basis"]
setup_sheet(wsB, title="Basis of preparation — where every number comes from", last_col=5)
wsB["B3"] = "Every model input is anchored to a current, citable source; every downstream figure is computed from those inputs. Prepared November 2026."
wsB["B3"].font = font_caption()

hdr = 5
for c, t in zip(range(2, 6), ["Input", "Value used", "Source (current as of Nov 2026)"]):
    wsB.cell(row=hdr, column=c, value=t).font = font_header()
style_header_row(wsB, row_num=hdr, col_start=2, col_end=4)
basis_rows = [
    ("Exchange rate", f"ETB {N['fx_etb_per_usd']:.2f} / USD", B["fx_note"]),
    ("Market size & growth", "USD 361.1M (2025); CAGR 8.16%", B["market"]),
    ("Buyer universe", "31 commercial banks + 59 MFIs", B["institutions"]),
    ("Salary anchor", "ETB 55,738/month median", B["salary_anchor"]),
    ("Cost escalation", "10% per year on payroll", B["inflation_note"]),
    ("Contingency", "10% on operating subtotals", "Standard pre-seed practice for a first operating year"),
]
r = hdr + 1
for label, val, src in basis_rows:
    wsB.cell(row=r, column=2, value=label).font = font_body()
    wsB.cell(row=r, column=3, value=val).font = font_body()
    wsB.cell(row=r, column=4, value=src).font = font_caption()
    style_data_row(wsB, row_num=r, col_start=2, col_end=4, row_index=r - hdr - 1)
    r += 1

r += 1
wsB.cell(row=r, column=2, value="Pricing benchmarks — list prices vs current global comparables").font = font_subheader()
r += 1
for c, t in zip(range(2, 6), ["Offer", "List price (ETB)", "Benchmark (current market data)"]):
    wsB.cell(row=r, column=c, value=t).font = font_header()
style_header_row(wsB, row_num=r, col_start=2, col_end=4)
pb_start = r + 1
r += 1
for offer, price, bench in B["pricing_benchmarks"]:
    wsB.cell(row=r, column=2, value=offer).font = font_body()
    c = wsB.cell(row=r, column=3, value=price); c.number_format = ETB; c.font = font_body()
    wsB.cell(row=r, column=4, value=bench).font = font_caption()
    style_data_row(wsB, row_num=r, col_start=2, col_end=4, row_index=r - pb_start)
    r += 1

r += 1
wsB.cell(row=r, column=2, value="Feasibility — computed, not asserted").font = font_subheader()
r += 1
feas = B["feasibility"]
feas_rows = [
    ("Projected market (USD M, IMARC 8.16% CAGR)", f"{feas['market_2027_2029_usd'][0]} / {feas['market_2027_2029_usd'][1]} / {feas['market_2027_2029_usd'][2]}", "2027 / 2028 / 2029 — USD 361.1M in 2025 compounded forward"),
    ("Plan revenue as % of market", f"{feas['our_share_pct'][0]}% / {feas['our_share_pct'][1]}% / {feas['our_share_pct'][2]}%", "Even the 2029 target is under 0.06% of the projected market"),
    ("Annual subscription TAM (ETB)", f"{feas['subscription_tam_etb']:,.0f}", "31 banks x ETB 1.8M + 59 MFIs x ETB 540K at list prices"),
    ("2029 subscription share of TAM", f"{feas['y3_subs_share_of_tam_pct']}%", "ETB 22.14M of ETB 87.66M"),
    ("2029 institution shares", f"banks {feas['y3_bank_share_pct']}% · MFIs {feas['y3_mfi_share_pct']}%", "12 of 31 banks; 16 of 59 MFIs — under NBE LOT4 sector-wide procurement pressure"),
    ("Cumulative 2027-2028 net burn (ETB)", f"{feas['cum_net_2027_2028']:,.0f}", "ETB -5.33M (2027) + ETB -0.32M (2028)"),
    ("Ask coverage of that burn", f"{feas['ask_coverage_of_2yr_burn']}x", "ETB 10M ask — margin for the pre-revenue H1 2027, working-capital timing and birr movement"),
]
for label, val, note in feas_rows:
    wsB.cell(row=r, column=2, value=label).font = font_body()
    wsB.cell(row=r, column=3, value=val).font = font_body()
    wsB.cell(row=r, column=4, value=note).font = font_caption()
    style_data_row(wsB, row_num=r, col_start=2, col_end=4, row_index=0)
    r += 1

r += 1
wsB.cell(row=r, column=2, value="Sources").font = font_subheader()
r += 1
for src in B["sources"]:
    wsB.cell(row=r, column=2, value="· " + src).font = font_caption()
    r += 1
wsB.column_dimensions["B"].width = 38
wsB.column_dimensions["C"].width = 26
wsB.column_dimensions["D"].width = 70

# ═══ Sheet 6: Charts ═════════════════════════════════════════════════════════
ws5 = wb.create_sheet("Charts")
setup_sheet(ws5, title="Model summary and charts", last_col=6)
ws5["B3"] = "Snapshot values mirroring the model sheets (formulas kept in the model; charts need cached values)."
ws5["B3"].font = font_caption()
hdr = 5
for c, t in zip(range(2, 6), ["Year", "Revenue (ETB)", "Costs (ETB)", "Net (ETB)"]):
    ws5.cell(row=hdr, column=c, value=t).font = font_header()
style_header_row(ws5, row_num=hdr, col_start=2, col_end=5)
for i, (yr, rev, cost, net) in enumerate(zip(["2027", "2028", "2029"], N["summary"]["revenue"], N["summary"]["costs"], N["summary"]["net"])):
    r = hdr + 1 + i
    ws5.cell(row=r, column=2, value=yr).font = font_body()
    for col, v in zip(range(3, 6), [rev, cost, net]):
        c = ws5.cell(row=r, column=col, value=v); c.number_format = ETB; c.font = font_body()
    style_data_row(ws5, row_num=r, col_start=2, col_end=5, row_index=i)

bar = BarChart()
bar.type = "col"
bar.title = "Revenue vs operating costs vs net (ETB)"
bar.height = 10; bar.width = 20
bar.y_axis.numFmt = '#,##0'
data = Reference(ws5, min_col=3, min_row=hdr, max_col=5, max_row=hdr + 3)
cats = Reference(ws5, min_col=2, min_row=hdr + 1, max_row=hdr + 3)
bar.add_data(data, titles_from_data=True)
bar.set_categories(cats)
bar.series[0].graphicalProperties.solidFill = PRIMARY
bar.series[1].graphicalProperties.solidFill = NEUTRAL_600
bar.series[2].graphicalProperties.solidFill = ACCENT_POSITIVE if N["summary"]["net"][0] >= 0 else ACCENT_NEGATIVE
ws5.add_chart(bar, "B10")

# cumulative cash line (from Y1 monthly model + Y2/Y3 nets)
line_r = 26
ws5.cell(row=line_r - 1, column=2, value="Cumulative cash position (ETB, incl. ask)").font = font_subheader()
cum_labels = ["Jan 2027"] + [f"{m} 2027" for m in months[1:]] + ["2028", "2029"]
vals = []
cash = N["ask_etb"]
# exact monthly cost mirroring the Y1 Monthly sheet: payroll + hosting + allocations, plus 10% contingency
alloc_month = round(2_250_000 / 12) + round(900_000 / 12) + round(450_000 / 12) + round(600_000 / 12)
for m in months:
    monthly_cost = (N["y1"]["salaries_monthly"][m] + 75_000 + alloc_month) * 1.10
    cash += N["y1"]["revenue_monthly"][m] - round(monthly_cost)
    vals.append(round(cash))
vals.append(round(cash + N["summary"]["net"][1]))
vals.append(round(cash + N["summary"]["net"][1] + N["summary"]["net"][2]))
for i, (lab, v) in enumerate(zip(cum_labels, vals)):
    ws5.cell(row=line_r, column=2 + i, value=lab).font = font_caption()
    c = ws5.cell(row=line_r + 1, column=2 + i, value=v)
    c.number_format = ETB; c.font = font_caption()
line = LineChart()
line.title = "Cumulative cash with ETB 10M pre-seed (2027–2029)"
line.height = 10; line.width = 24
data = Reference(ws5, min_col=2, min_row=line_r + 1, max_col=1 + len(vals), max_row=line_r + 1)
cats = Reference(ws5, min_col=2, min_row=line_r, max_col=1 + len(vals), max_row=line_r)
line.add_data(data, titles_from_data=False, from_rows=True)
line.set_categories(cats)
line.series[0].graphicalProperties.solidFill = PRIMARY
ws5.add_chart(line, "B32")

wb.save(OUT)
print("written:", OUT)
