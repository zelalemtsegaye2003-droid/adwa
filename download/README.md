# Adwa Sec — Startup Application Package (November 2026)

Ten deliverables answering the incubation programme's requirement checklist,
produced from the venture's real platform work (VAPT Center, AD Attack Paths,
bid matrix, compliance engine) and a benchmarked financial model.

Founders: **Solomon Asalif** (Founder & CEO) and **Zelalem Tsegaye**
(Co-founder & CTO) — named consistently across every document in this package.

## The package (requirement → file)

| # | Programme requirement | File |
|---|---|---|
| 0 | Application cover letter + checklist | `AdwaSec_00_Application_Cover.docx` (+ `.pdf`) |
| 1 | Founder CVs (both founders) — Essential | `AdwaSec_01_Founder_CV.docx` (+ `.pdf`) |
| 2 | Startup concept note, 2–3 pages — Essential | `AdwaSec_02_Concept_Note.docx` (+ `.pdf`) |
| 3 | Business plan — Essential | `AdwaSec_03_Business_Plan.docx` (+ `.pdf`) |
| 4 | Pitch deck, 8–12 slides — Essential | `AdwaSec_04_Pitch_Deck.pptx` (source HTML in `slides/`) |
| 5 | Problem & solution document — Essential | `AdwaSec_05_Problem_and_Solution.docx` (+ `.pdf`) |
| 6 | Product/service roadmap — Important | `AdwaSec_06_Product_Roadmap.docx` (+ `.pdf`) |
| 7 | Financial projections — Important | `AdwaSec_07_Financial_Projections.xlsx` (live model: editable FX/pricing/payroll assumptions + a Basis & Sources sheet documenting every input's current-data anchor) |
| 8 | MVP/prototype demonstration — available | `AdwaSec_08_MVP_Demonstration.docx` (+ `.pdf`; full-resolution screens in `screenshots/`) |
| 9 | Registration/TIN + founder ID — status letter | `AdwaSec_09_Registration_and_Founder_ID.docx` (+ `.pdf`) |

## Figures used across the package (single source of truth)

`scripts/docgen/numbers.json` (repo) — pre-seed ask ETB 10M (~USD 62K at the
NBE indicative rate ETB 160.93/USD of 12 November 2026), 18-month runway;
revenue ETB 4.02M / 19.26M / 44.64M (2027/2028/2029); costs 9.35M / 19.58M /
35.48M; net −5.33M / −0.32M / +9.16M; break-even late 2028; subscribers
3 → 12 → 28; FTE 5 → 10 → 16.

Every input is anchored to current cited data — NBE FX rate and institution
counts (31 commercial banks + 59 MFIs, June 2025), IMARC market sizing
(USD 361.1M 2025, 8.16% CAGR), levels.fyi Addis Ababa salary median
(ETB 55,738/month, Nov 2026), ESS inflation (14.6% Oct 2026; payroll escalates
10%/yr), and 2026 global benchmarks for GRC platforms, penetration tests,
managed SOC and ISO 27001. Plan revenue equals 0.006 / 0.026 / 0.056 percent
of the projected 2027-2029 market. Change an assumption in the xlsx
Assumptions sheet and re-derive before editing any quoted figure in the
documents.

## Fields only the founders can complete

Placeholders are clearly marked in both founders' CVs and the registration
letter: phone and email for each founder, education (degree/institution/year),
previous employment entries, certifications, and Zelalem's background summary.
Everything else is final.

## Earlier deliverables (kept from prior work)

- `AdwaSec_Real_Data_Review_and_Roadmap.docx` / `.pdf` — what is already
  live, what is still fixture, and the phased plan for real internet data
  everywhere (Phase 1 + Phase 2 implemented: public feeds, self-hosted MISP
  exchange, VirusTotal reputation, live EPSS at scan time; Phase 3
  production bindings now observable — the System Bindings registry /
  `bun run bindings:report` go-live surface, remaining items are pure
  coordination: INSA credentials, Google Console registration, SMTP).
- `AdwaSec_SelfScan_Demo_Runbook.docx` / `.pdf` — click-by-click steps for
  the three repeatable self-scan demonstrations.
- `Adwa_Cyber_Implementation_Roadmap.docx` / `.pdf` — the detailed
  29-page implementation roadmap the application documents summarise.
- `Adwa_MVP_Readiness_Assessment.docx` / `.pdf` — MVP readiness assessment.
- `Adwa_System_Architecture.png` — six-layer architecture diagram.
