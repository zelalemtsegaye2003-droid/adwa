// helpers.js — shared design system + builders for the Adwa Cyber roadmap document
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  LevelFormat, TableOfContents, SectionType, TableLayoutType,
} = require("docx");

// ── Palette: DM-1 Deep Cyan (cover) + darkened table tokens for white pages ──
const P = {
  // cover (dark background)
  bg: "162235",
  accent: "37DCF2", // bright cyan — dark cover ONLY
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
  // body (white pages)
  ink: "000000",        // body text — pure black (Profile A)
  heading: "162235",    // H1/H2 — dark navy
  heading3: "1B6B7A",   // H3 — darkened cyan
  secondary: "5B6B7D",  // captions / notes
  // table tokens (DM-1 table — desaturated for white pages)
  tHeaderBg: "1B6B7A",
  tHeaderText: "FFFFFF",
  tAccentLine: "1B6B7A",
  tInnerLine: "C8DDE2",
  tSurface: "EDF3F5",
};

// ── Fonts (English document, Profile A formal) ──
const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const FONT_H = { ascii: "Times New Roman", eastAsia: "SimHei" };

// ── Borders ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

// ── Safe text guard (mandatory) ──
function safeText(value, placeholder) {
  if (
    value === undefined || value === null || value === "" ||
    String(value) === "NaN" || String(value) === "undefined"
  ) {
    return placeholder || "【Please fill in】";
  }
  return String(value);
}

// ── Run builder: spec = string | [{t, b(old), i(talic)}] ──
function runs(spec, opts = {}) {
  const size = opts.size || 24;
  const color = opts.color || P.ink;
  const font = opts.font || FONT;
  const items = typeof spec === "string" ? [{ t: spec }] : Array.isArray(spec) ? spec : [spec];
  return items.map(
    (r) =>
      new TextRun({
        text: safeText(r.t, " "),
        bold: !!r.b,
        italics: !!r.i,
        size,
        color,
        font,
      })
  );
}

// ── Headings (literal numbering, TOC-indexed via HeadingLevel) ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 180, line: 312 },
    keepNext: true,
    children: [
      new TextRun({ text: safeText(text), bold: true, size: 32, color: P.heading, font: FONT_H }),
    ],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140, line: 312 },
    keepNext: true,
    children: [
      new TextRun({ text: safeText(text), bold: true, size: 30, color: P.heading, font: FONT_H }),
    ],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 110, line: 312 },
    keepNext: true,
    children: [
      new TextRun({ text: safeText(text), bold: true, size: 28, color: P.heading3, font: FONT_H }),
    ],
  });
}

// ── Body paragraph (justified, 1.3x) ──
function p(spec, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: opts.after != null ? opts.after : 160, line: 312 },
    keepNext: !!opts.keepNext,
    children: runs(spec),
  });
}

// ── Bullet / numbered lists ──
function bullet(spec, level = 0) {
  return new Paragraph({
    bullet: { level },
    alignment: AlignmentType.LEFT,
    spacing: { after: 60, line: 312 },
    children: runs(spec),
  });
}

const numberingConfigs = [];
function numbered(ref, spec) {
  if (!numberingConfigs.find((c) => c.reference === ref)) {
    numberingConfigs.push({
      reference: ref,
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    });
  }
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { after: 30, line: 312 },
    children: runs(spec),
  });
}

// ── Table caption + table builder ──
let tableCounter = 0;
function tableTitle(text) {
  tableCounter += 1;
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 220, after: 100, line: 312 },
    children: [
      new TextRun({
        text: `Table ${tableCounter}: ${safeText(text)}`,
        bold: true, size: 21, color: P.heading, font: FONT,
      }),
    ],
  });
}

function makeTable({ headers, rows, widths, zebra = true, fontSize = 20, vPad = 70 }) {
  const cellPara = (spec) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 276 },
      children: runs(spec, { size: fontSize, color: P.ink, font: FONT }),
    });

  const headerCell = (text, i) =>
    new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 276 },
          children: [
            new TextRun({
              text: safeText(text), bold: true, size: fontSize,
              color: P.tHeaderText, font: FONT,
            }),
          ],
        }),
      ],
      shading: { type: ShadingType.CLEAR, fill: P.tHeaderBg },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    });

  const dataCell = (spec, i, ri) =>
    new TableCell({
      children: [cellPara(spec)],
      shading:
        zebra && ri % 2 === 1
          ? { type: ShadingType.CLEAR, fill: P.tSurface }
          : undefined,
      margins: { top: vPad, bottom: vPad, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: P.tAccentLine },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: P.tAccentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.tInnerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((t, i) => headerCell(t, i)),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            cantSplit: true,
            children: row.map((c, i) => dataCell(c, i, ri)),
          })
      ),
    ],
  });
}

// small gray note under tables / figures
function note(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 200, line: 276 },
    children: [
      new TextRun({ text: safeText(text), italics: true, size: 18, color: P.secondary, font: FONT }),
    ],
  });
}

// ══════════════════════════════════════════════════════════════════
// Cover — Recipe R1 (Pure Paragraph, Left-Aligned), DM-1 palette
// ══════════════════════════════════════════════════════════════════

// English/CJK mixed width estimate (twips) — CJK ≈ pt*20, Latin ≈ pt*11
function estimateTextWidth(text, pt) {
  let w = 0;
  for (const ch of text) w += /[\u4e00-\u9fff\u3000-\u303f]/.test(ch) ? pt * 20 : pt * 11;
  return w;
}

function splitTitleLines(title, maxWidthTwips, pt) {
  if (estimateTextWidth(title, pt) <= maxWidthTwips) return [title];
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? cur + " " + word : word;
    if (estimateTextWidth(cand, pt) <= maxWidthTwips || !cur) cur = cand;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  // orphan prevention — merge tiny last line
  if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    lines = splitTitleLines(title, maxWidthTwips, titlePt);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, maxWidthTwips, minPt);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? 12 * 23 + 600 : 0;
  const englishLabelHeight = hasEnglishLabel ? 9 * 23 + 600 : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight =
    titleHeight + subtitleHeight + englishLabelHeight + metaHeight +
    fixedHeight + implicitParaHeight;
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

function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 12 };
  const children = [];

  // 1. dynamic top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(
      new Paragraph({
        indent: { left: padL, right: padR },
        spacing: { after: 500 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 8 } },
        children: [
          new TextRun({
            text: config.englishLabel.split("").join("  "),
            size: 18, color: C.accent,
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            characterSpacing: 40,
          }),
        ],
      })
    );
  }

  // 3. main title — dynamic size, explicit atLeast line spacing
  for (let i = 0; i < titleLines.length; i++) {
    children.push(
      new Paragraph({
        indent: { left: padL },
        spacing: {
          after: i < titleLines.length - 1 ? 100 : 300,
          line: Math.ceil(titlePt * 23), lineRule: "atLeast",
        },
        children: [
          new TextRun({
            text: titleLines[i], size: titleSize, bold: true,
            color: C.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" },
          }),
        ],
      })
    );
  }

  // 4. subtitle
  if (config.subtitle) {
    children.push(
      new Paragraph({
        indent: { left: padL, right: padR },
        spacing: { after: 800 },
        children: [
          new TextRun({
            text: config.subtitle, size: 24, color: C.subtitleColor,
            font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
          }),
        ],
      })
    );
  }

  // 5. meta lines with left accent border
  for (const line of config.metaLines || []) {
    children.push(
      new Paragraph({
        indent: { left: padL + 200, right: padR },
        spacing: { after: 80 },
        border: { left: accentLeft },
        children: [
          new TextRun({
            text: line, size: 24, color: C.metaColor,
            font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
          }),
        ],
      })
    );
  }

  // 6. dynamic bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. footer with top accent separator
  children.push(
    new Paragraph({
      indent: { left: padL, right: padR },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
      spacing: { before: 200 },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
        new TextRun({ text: "                                        " }),
        new TextRun({ text: config.footerRight || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
      ],
    })
  );

  // single 16838 wrapper — the ONLY table, explicit allNoBorders
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: allNoBorders,
      rows: [
        new TableRow({
          height: { value: 16838, rule: "exact" },
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: C.bg },
              borders: noBorders,
              children,
            }),
          ],
        }),
      ],
    }),
  ];
}

module.exports = {
  P, FONT, FONT_H, NB, noBorders, allNoBorders,
  safeText, runs, h1, h2, h3, p, bullet, numbered, numberingConfigs,
  tableTitle, makeTable, note, buildCoverR1,
};
