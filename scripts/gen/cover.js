/**
 * cover.js - Recipe R1 (Pure Paragraph Left) with DM-1 Deep Cyan palette.
 * Adapted from the design-system recipe; English title width estimation
 * (avg char width ~= pt * 11 twips instead of CJK pt * 20).
 */
const {
  Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, ShadingType, WidthType, TableLayoutType,
} = require("docx");
const { allNoBorders, noBorders } = require("./helpers");

const P = {
  bg: "162235",
  accent: "37DCF2",
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
};

/** English title layout: break at word boundaries, <= 3 lines. */
function calcTitleLayoutEn(title, maxWidthTwips, preferredPt = 38, minPt = 24) {
  const charWidth = (pt) => pt * 11; // avg English glyph width approximation
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));

  const splitWords = (cpl) => {
    const words = title.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const candidate = cur ? cur + " " + w : w;
      if (candidate.length <= cpl) {
        cur = candidate;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    // orphan prevention: merge a very short last line into the previous one
    if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
      const last = lines.pop();
      lines[lines.length - 1] += " " + last;
    }
    return lines;
  };

  let titlePt = preferredPt;
  let lines = splitWords(charsPerLine(titlePt));
  while (titlePt > minPt && (lines.length > 3 || lines.some((l) => l.length > charsPerLine(titlePt)))) {
    titlePt -= 2;
    lines = splitWords(charsPerLine(titlePt));
  }
  return { titlePt, titleLines: lines };
}

/** Dynamic vertical spacing (from design-system calcCoverSpacing, EN variant). */
function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 400, pageHeight = 16838,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;

  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? 12 * 23 + 600 : 0;
  const englishLabelHeight = hasEnglishLabel ? 9 * 23 + 600 : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;

  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight +
    metaHeight + fixedHeight + implicitParaHeight;
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
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayoutEn(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length,
    titlePt,
    hasSubtitle: !!config.subtitle,
    hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. Top whitespace (dynamic)
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent,
        font: { ascii: "Arial", eastAsia: "Arial" },
        characterSpacing: 40,
      })],
    }));
  }

  // 3. Main title lines (Rule 8: explicit line spacing for large fonts)
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 300,
        line: Math.ceil(titlePt * 23),
        lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i],
        size: titleSize,
        bold: true,
        color: P.titleColor,
        font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  // 4. Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { after: 800 },
      children: [new TextRun({
        text: config.subtitle,
        size: 24,
        color: P.subtitleColor,
        font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  // 5. Meta lines with left accent border
  for (const line of config.metaLines || []) {
    children.push(new Paragraph({
      indent: { left: padL + 200 },
      spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line,
        size: 22,
        color: P.metaColor,
        font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  // 6. Bottom whitespace (dynamic)
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                                  " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  // Single 16838 wrapper table - the ONLY table, allNoBorders, exact height
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

module.exports = { buildCoverR1 };
