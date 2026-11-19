#!/usr/bin/env python3
"""
Adwa Cyber — roadmap deliverable Phase 3 status note patch.

Inserts the Phase 3 implementation-status note under "6. Phase 3 - Production
Bindings" of download/AdwaSec_Real_Data_Review_and_Roadmap.docx, mirroring the
Phase 2 note pattern (bold "Note: " lead + Times New Roman 11pt body), then
regenerates the PDF twin via soffice.
"""
from docx import Document
from docx.shared import Pt

DOCX = "download/AdwaSec_Real_Data_Review_and_Roadmap.docx"
PDF = "download/AdwaSec_Real_Data_Review_and_Roadmap.pdf"

NOTE_TEXT = (
    "Status as of 19 November 2026: Phase 3 is now more than coordination-ready - "
    "it is observable. The platform serves a production bindings registry (14 "
    "bindings across identity, mail, the national exchange, threat intelligence, "
    "enrichment and VAPT) as data: the System Bindings tab for SUPER_ADMIN, "
    "GET /api/system/bindings, and bun run bindings:report as the pre-boot "
    "go-live checklist. Every binding carries a closed-set status (live, mock, "
    "fixture, snapshot, unconfigured, disabled - kill switches included), the "
    "exact environment variables that flip it to production, and snapshot as-of "
    "dates; secret values never leave the server (names only, by design and by "
    "test). The operator guide is docs/PRODUCTION_BINDINGS.md. What remains is "
    "exactly the coordination this chapter describes: INSA's production endpoint "
    "and key for the bilateral exchange, Google Cloud Console registration for "
    "real sign-in, SMTP credentials for real mail delivery, and pilot tenants "
    "onboarding themselves through the existing create-organization flow - each "
    "a named env var flip, never a code change."
)

d = Document(DOCX)

# Idempotency: skip if the note already exists.
if any("Phase 3 is now more than coordination-ready" in p.text for p in d.paragraphs):
    print("Phase 3 note already present - nothing to do")
    raise SystemExit(0)

# Anchor: the "6.1 The real Ethio-CERT / INSA exchange" heading — insert before it.
anchor = next(p for p in d.paragraphs if p.text.strip().startswith("6.1 The real Ethio-CERT"))

note = anchor.insert_paragraph_before("")
lead = note.add_run("Note: ")
lead.bold = True
lead.font.name = "Times New Roman"
lead.font.size = Pt(11)
body = note.add_run(NOTE_TEXT)
body.font.name = "Times New Roman"
body.font.size = Pt(11)

d.save(DOCX)
print("inserted Phase 3 status note ->", DOCX)
