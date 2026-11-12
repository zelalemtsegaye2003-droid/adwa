/**
 * main.js - assembles the Adwa Cyber Implementation Roadmap docx.
 * 3-section architecture: Cover (no page numbers) / TOC (Roman) / Body (Arabic from 1).
 */
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, NumberFormat, SectionType,
  TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");

const { EN_FONT, PAL } = require("./helpers");
const { buildCoverR1 } = require("./cover");

const chapters = [
  ...require("./content1"),
  ...require("./content2"),
  ...require("./content3"),
];

const OUTPUT = "/adwa/download/Adwa_Cyber_Implementation_Roadmap.docx";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        children: [PageNumber.CURRENT],
        size: 18, color: "808080", font: EN_FONT,
      })],
    })],
  });
}

function titleHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: "single", size: 2, color: "C8DDE2", space: 4 } },
      children: [new TextRun({
        text: "Adwa Cyber - Implementation Roadmap",
        size: 18, color: "808080", font: EN_FONT,
      })],
    })],
  });
}

// ---------------------------------------------------------------------------
// Cover config
// ---------------------------------------------------------------------------
const coverConfig = {
  title: "Adwa Cyber Implementation Roadmap",
  subtitle: "Strategic Recommendations and Execution Plan, 2026 - 2029",
  englishLabel: "IMPLEMENTATION ROADMAP",
  metaLines: [
    "Prepared for: Solomon Asalif, Adwa Cyber Research Lab",
    "Bahir Dar University - Bahir Dar, Ethiopia",
    "Companion to: Adwa Cyber Startup Proposal v1.0 (May 2026)",
    "Version 1.0 - November 2026",
  ],
  footerLeft: "Adwa Cyber Research Lab",
  footerRight: "Confidential - For Review and Decision",
};

// ---------------------------------------------------------------------------
// TOC section children
// ---------------------------------------------------------------------------
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({
      text: "Table of Contents",
      bold: true, size: 32, color: PAL.headingColor, font: EN_FONT,
    })],
  }),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field\".",
      italics: true, size: 18, color: "888888", font: EN_FONT,
    })],
  }),
];

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
const doc = new Document({
  creator: "Adwa Cyber Research Lab",
  title: "Adwa Cyber Implementation Roadmap",
  description: "Strategic recommendations and 36-month execution plan for the Adwa Cyber ecosystem",
  styles: {
    default: {
      document: {
        run: { font: EN_FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: EN_FONT, size: 32, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 400, after: 180, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: EN_FONT, size: 28, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: EN_FONT, size: 24, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 220, after: 120, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // Section 1: Cover - margin 0, no header/footer, no page numbers
    {
      properties: {
        page: {
          size: pgSize,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCoverR1(coverConfig),
    },
    // Section 2: TOC - Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageNumFooter() },
      children: tocChildren,
    },
    // Section 3: Body - Arabic numerals restarting at 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: titleHeader() },
      footers: { default: pageNumFooter() },
      children: chapters,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Written:", OUTPUT, buf.length, "bytes");
});
