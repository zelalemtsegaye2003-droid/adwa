/** Adwa Sec startup package — shared docx builders.
 *  Implements the docx skill rules: R1 cover recipe (design-system.md),
 *  DM-1 palette, calcTitleLayout/calcCoverSpacing, Profile A English typography,
 *  table margins + tableHeader/cantSplit, percentage widths, safeText.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableLayoutType, SectionType, TableOfContents, ExternalHyperlink, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ── Palette: DM-1 Deep Cyan (tech) from design-system.md ──────────────────
const P = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  // body tokens (white pages)
  primary: "0A1628", body: "1A2B40", secondary: "506070", accentDark: "1B6B7A",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function safeText(v, ph) {
  if (v === undefined || v === null || v === "" || String(v) === "NaN" || String(v) === "undefined") {
    return ph || "[To be completed]";
  }
  return String(v);
}

// ── Title layout (English adaptation: avg char ≈ pt × 11 twips) ────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."-_/·:;,".split(""), " ", "\t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24, charFactor = 11) {
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / (pt * charFactor));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── Cover Recipe R1 (left-aligned, full-page dark bg) ──────────────────────
function buildCoverR1(config) {
  const PA = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24, 11);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PA.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PA.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: PA.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: PA.cover.titleColor, font: { eastAsia: "Arial", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: PA.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: PA.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PA.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: PA.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: PA.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PA.bg }, borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children,
      })],
    })],
  })];
}

// ── Body helpers (Profile A English) ───────────────────────────────────────
const EN_FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const HEAD_FONT = { ascii: "Arial", eastAsia: "Arial" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: HEAD_FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.primary, font: HEAD_FONT })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: HEAD_FONT })],
  });
}
function para(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 24, color: P.body, font: EN_FONT })];
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after ?? 120, before: opts.before ?? 0 },
    children: runs,
    ...(opts.keepNext ? { keepNext: true } : {}),
  });
}
function run(text, o = {}) {
  return new TextRun({ text, size: o.size || 24, bold: !!o.bold, italics: !!o.italics, color: o.color || P.body, font: o.font || EN_FONT });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: Array.isArray(text) ? text : [new TextRun({ text, size: 24, color: P.body, font: EN_FONT })],
  });
}

// ── Table builder ───────────────────────────────────────────────────────────
function cellPara(content, o = {}) {
  const runs = Array.isArray(content) ? content : [new TextRun({
    text: String(content), size: o.size || 20, bold: !!o.bold,
    color: o.color || P.body, font: EN_FONT,
  })];
  return new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { line: 312, before: 20, after: 20 }, children: runs });
}
function dataTable({ headers, rows, widths, caption, alignRight = [] }) {
  const out = [];
  if (caption) {
    out.push(new Paragraph({
      keepNext: true, spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: caption, bold: true, size: 21, color: P.secondary, font: HEAD_FONT })],
    }));
  }
  const nCols = headers.length;
  const colW = widths || Array(nCols).fill(Math.floor(100 / nCols));
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((t, i) => new TableCell({
      children: [cellPara(t, { bold: true, color: P.table.headerText, align: alignRight.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT })],
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: colW[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((c, i) => new TableCell({
      children: [cellPara(c, { align: alignRight.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT, bold: i === 0 && r._strongFirst })],
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.table.surface } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: colW[i], type: WidthType.PERCENTAGE },
    })),
  }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

// ── Figure (PNG with aspect preserved) ─────────────────────────────────────
function pngSize(path) {
  const buf = fs.readFileSync(path);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function figure(path, caption, displayWidthPx = 500) {
  const { w, h } = pngSize(path);
  const dh = Math.round(displayWidthPx * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data: fs.readFileSync(path), transformation: { width: displayWidthPx, height: dh }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 20, color: P.secondary, font: EN_FONT })],
    }),
  ];
}

// ── Footers ─────────────────────────────────────────────────────────────────
function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: EN_FONT })],
    })],
  });
}
function pageHeader(title) {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2" } },
      children: [new TextRun({ text: title, size: 18, color: "808080", font: EN_FONT })],
    })],
  });
}

// ── TOC block (front-matter section children) ──────────────────────────────
function tocBlock() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
      children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: HEAD_FONT, color: P.primary })],
    }),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
        italics: true, size: 18, color: "888888", font: EN_FONT,
      })],
    }),
    // No trailing PageBreak: the body lives in its own NEXT_PAGE section — a
    // PageBreak here would create a blank page (docx skill blank-page rule ①).
  ];
}

// ── Letter helpers ─────────────────────────────────────────────────────────
function letterClose(name, role) {
  return [
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 400 }, children: [new TextRun({ text: "Yours sincerely,", size: 24, font: EN_FONT, color: P.body })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 60 }, children: [new TextRun({ text: name, bold: true, size: 24, font: EN_FONT, color: P.primary })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: role, size: 22, font: EN_FONT, color: P.secondary })] }),
  ];
}

// ── Document assembly ───────────────────────────────────────────────────────
function makeDoc({ cover, toc, body, headerTitle }) {
  const sections = [];
  if (cover) {
    sections.push({
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: cover,
    });
  }
  if (toc) {
    sections.push({
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      children: toc,
    });
  }
  sections.push({
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    headers: headerTitle ? { default: pageHeader(headerTitle) } : undefined,
    footers: { default: pageFooter() },
    children: body,
  });
  return new Document({
    creator: "Adwa Sec",
    styles: {
      default: {
        document: {
          run: { font: EN_FONT, size: 24, color: P.body },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: { run: { font: HEAD_FONT, size: 32, bold: true, color: P.primary }, paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 } },
        heading2: { run: { font: HEAD_FONT, size: 30, bold: true, color: P.primary }, paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 } },
        heading3: { run: { font: HEAD_FONT, size: 28, bold: true, color: P.primary }, paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 } },
      },
    },
    sections,
  });
}

function fmtM(v) { return `ETB ${(v / 1e6).toFixed(2)}M`; }
function fmtK(v) { return `ETB ${(v / 1e3).toFixed(0)}K`; }

module.exports = {
  P, NB, noBorders, allNoBorders, safeText,
  calcTitleLayout, splitTitleLines, calcCoverSpacing, buildCoverR1,
  h1, h2, h3, para, run, bullet, dataTable, figure, pngSize,
  pageFooter, pageHeader, tocBlock, letterClose, makeDoc,
  EN_FONT, HEAD_FONT, fmtM, fmtK,
  docx: { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, TableLayoutType, SectionType, TableOfContents, ExternalHyperlink, VerticalAlign },
};
