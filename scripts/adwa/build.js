// build.js — assemble the Adwa Cyber Implementation Roadmap document
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  NumberFormat, AlignmentType, SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const path = require("path");

const H = require("./helpers");
const contentA = require("./content_a");
const contentB = require("./content_b");
const contentC = require("./content_c");

const OUT = process.cwd() + "/download/Adwa_Cyber_Implementation_Roadmap.docx";

// ── Build body content FIRST so numberingConfigs gets populated ──
const bodyChildren = [...contentA.build(), ...contentB.build(), ...contentC.build()];

// ── Page geometry (common rules) ──
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// ── Header / footer factories (front matter + body) ──
function docHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: "Adwa Cyber — Implementation Roadmap & Strategic Recommendations",
            size: 18, color: "808080", font: H.FONT,
          }),
        ],
      }),
    ],
  });
}
function pageNumFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, line: 240 },
        children: [
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: H.FONT }),
        ],
      }),
    ],
  });
}

// ── Cover config (Recipe R1, DM-1 palette) ──
const coverChildren = H.buildCoverR1({
  title: "Adwa Cyber",
  subtitle: "Implementation Roadmap & Strategic Recommendations (2026–2029)",
  englishLabel: "IMPLEMENTATION ROADMAP",
  metaLines: [
    "Prepared by: Solomon Asalif, Adwa Cyber Research Lab",
    "Prepared for: Bahir Dar University and Pilot Partners",
    "Companion to: Adwa Cyber Startup Proposal, v1.0 (May 2026)",
    "Date: November 2026",
  ],
  footerLeft: "ADWA CYBER RESEARCH LAB",
  footerRight: "BAHIR DAR, ETHIOPIA",
  palette: H.P,
});

// ── Front matter: TOC ──
const frontMatterChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [
      new TextRun({
        text: "Table of Contents",
        bold: true, size: 32, color: H.P.heading, font: H.FONT_H,
      }),
    ],
  }),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [
      new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \u201cUpdate Field.\u201d",
        italics: true, size: 18, color: "888888", font: H.FONT,
      }),
    ],
  }),
];

// ── Document ──
const doc = new Document({
  creator: "Solomon Asalif — Adwa Cyber Research Lab",
  title: "Adwa Cyber — Implementation Roadmap & Strategic Recommendations",
  description:
    "Implementation roadmap and strategic recommendations for the Adwa Cyber startup proposal (Bahir Dar University).",
  styles: {
    default: {
      document: {
        run: { font: H.FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: H.FONT_H, size: 32, bold: true, color: H.P.heading },
        paragraph: { spacing: { before: 400, after: 180, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: H.FONT_H, size: 30, bold: true, color: H.P.heading },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: H.FONT_H, size: 28, bold: true, color: H.P.heading3 },
        paragraph: { spacing: { before: 220, after: 110, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  numbering: { config: H.numberingConfigs },
  sections: [
    // ── Section 1: Cover — margin 0, no page numbers, no header/footer ──
    {
      properties: {
        page: {
          size: pgSize,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: coverChildren,
    },
    // ── Section 2: Front matter (TOC) — Roman numerals ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: frontMatterChildren,
    },
    // ── Section 3: Body — Arabic, restart at 1 ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buffer);
  console.log("WROTE:", OUT, `(${(buffer.length / 1024).toFixed(1)} KB)`);
  console.log("Numbering configs used:", H.numberingConfigs.map((c) => c.reference).join(", "));
  console.log("Tables built:", H.tableTitle ? "ok" : "n/a");
}).catch((err) => {
  console.error("BUILD FAILED:", err);
  process.exit(1);
});
