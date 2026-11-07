/**
 * helpers.js - shared building blocks for the Adwa Cyber Implementation Roadmap
 * English document: Times New Roman (Profile A formal), DM-1 Deep Cyan palette.
 */
const {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  TableLayoutType, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Palette - DM-1 Deep Cyan (AI / tech). Table tokens darkened per design-system.
// ---------------------------------------------------------------------------
const PAL = {
  bg: "162235",
  accent: "37DCF2",
  cover: {
    titleColor: "FFFFFF",
    subtitleColor: "B0B8C0",
    metaColor: "90989F",
    footerColor: "687078",
  },
  table: {
    headerBg: "1B6B7A",
    headerText: "FFFFFF",
    accentLine: "1B6B7A",
    innerLine: "C8DDE2",
    surface: "EDF3F5",
  },
  headingColor: "0E3F49",
  body: "000000",
  secondary: "666666",
};

const EN_FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

// ---------------------------------------------------------------------------
// Headings (manual chapter numbers, Heading styles for TOC pickup)
// ---------------------------------------------------------------------------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 180, line: 312 },
    keepNext: true,
    children: [new TextRun({
      text, bold: true, size: 32, color: PAL.headingColor, font: EN_FONT,
    })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140, line: 312 },
    keepNext: true,
    children: [new TextRun({
      text, bold: true, size: 28, color: PAL.headingColor, font: EN_FONT,
    })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 120, line: 312 },
    keepNext: true,
    children: [new TextRun({
      text, bold: true, size: 24, color: PAL.headingColor, font: EN_FONT,
    })],
  });
}

// ---------------------------------------------------------------------------
// Body paragraphs
// ---------------------------------------------------------------------------
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 312 },
    ...(opts.keepNext ? { keepNext: true } : {}),
    children: [new TextRun({ text, size: 24, color: PAL.body, font: EN_FONT })],
  });
}

/** Paragraph from mixed runs: pass [["plain text ", false], ["bold part", true]] */
function bodyRuns(parts, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 312 },
    ...(opts.keepNext ? { keepNext: true } : {}),
    children: parts.map(([text, bold]) => new TextRun({
      text, bold: !!bold, size: 24, color: PAL.body, font: EN_FONT,
    })),
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, color: PAL.body, font: EN_FONT })],
  });
}

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------
let tableNo = 0;
let figNo = 0;

function tableCaption(text) {
  tableNo += 1;
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 100, line: 312 },
    children: [
      new TextRun({ text: "Table " + tableNo + ": ", bold: true, size: 21, color: PAL.headingColor, font: EN_FONT }),
      new TextRun({ text, size: 21, color: PAL.secondary, font: EN_FONT }),
    ],
  });
}

function figCaption(text) {
  figNo += 1;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 200, line: 312 },
    children: [
      new TextRun({ text: "Figure " + figNo + ": ", bold: true, size: 21, color: PAL.headingColor, font: EN_FONT }),
      new TextRun({ text, size: 21, color: PAL.secondary, font: EN_FONT }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Business table - Horizontal-Only style (DM-1 table tokens)
// ---------------------------------------------------------------------------
function cellPara(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: 276 },
    children: [new TextRun({
      text: String(text),
      bold: !!opts.bold,
      size: opts.size || 20,
      color: opts.color || PAL.body,
      font: EN_FONT,
    })],
  });
}

/**
 * bizTable(headers, rows, widths)
 *  headers: string[]
 *  rows: string[][]
 *  widths: number[] (percentages summing to 100)
 */
function bizTable(headers, rows, widths) {
  const T = PAL.table;
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: T.headerBg },
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      verticalAlign: VerticalAlign.CENTER,
      children: [cellPara(text, { bold: true, color: T.headerText })],
    })),
  });

  const dataRows = rows.map((cells, r) => new TableRow({
    cantSplit: true,
    children: cells.map((text, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: r % 2 === 1
        ? { type: ShadingType.CLEAR, fill: T.surface }
        : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      children: [cellPara(text)],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: T.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

// ---------------------------------------------------------------------------
// Image embedding (aspect ratio preserved)
// ---------------------------------------------------------------------------
function image(path, displayWidthPx, origW, origH) {
  const buf = fs.readFileSync(path);
  const displayHeight = Math.round(displayWidthPx * (origH / origW));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 40 },
    keepNext: true,
    children: [new ImageRun({
      data: buf,
      transformation: { width: displayWidthPx, height: displayHeight },
      type: "png",
    })],
  });
}

module.exports = {
  PAL, EN_FONT, NB, noBorders, allNoBorders,
  h1, h2, h3, body, bodyRuns, bullet,
  tableCaption, figCaption, bizTable, image,
};
