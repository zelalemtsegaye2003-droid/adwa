/**
 * Adwa Cyber — Track C Gate Dossier PDF generator (server-only).
 *
 * The funder/regulator-facing record of the gated-expansion posture
 * (proposal Phases 4–5, roadmap §3.2 Table 2 + §14): per-phase readiness,
 * every criterion with its status, note and evidence register (SHA-256
 * sealed), plus the platform posture line. Rendered as a vector PDF with
 * pdfkit; script-aware fonts exactly like the executive report, so Amharic
 * titles render beside Latin metadata. A canonical payload hash in the
 * footer lets any recipient re-verify the numbers against GET /api/gates.
 */
import PDFDocument from "pdfkit";
import { createHash } from "crypto";
import path from "path";

// ── Types (mirrors the /api/gates payload) ───────────────────────────────────

export interface DossierCriterion {
  code: string;
  titleEn: string;
  titleAm: string;
  status: string;
  category: string;
  notes: string | null;
  updatedAt: Date;
  updatedByName: string | null;
  evidence: { fileName: string; fileSize: number; checksum: string; uploadedByName: string | null; createdAt: Date }[];
}

export interface DossierPhase {
  phase: string;
  label: string;
  labelAm: string;
  instrument: string;
  readinessPct: number;
  satisfied: number;
  total: number;
  open: boolean;
  criteria: DossierCriterion[];
}

export interface DossierPayload {
  phases: DossierPhase[];
  policy: string;
  deploymentAllowed: boolean;
  generatedAt: Date;
}

// ── Fonts & script-aware text ────────────────────────────────────────────────

const F = {
  latin: { regular: path.join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"), bold: path.join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf") },
  ethiopic: { regular: path.join(process.cwd(), "src/assets/fonts/NotoSansEthiopic-Regular.ttf"), bold: path.join(process.cwd(), "src/assets/fonts/NotoSansEthiopic-Bold.ttf") },
};

const ETHIOPIC_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;
const isEthiopic = (ch: string) => ETHIOPIC_RE.test(ch);

function mixedText(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; x?: number; y?: number; width?: number; align?: "left" | "center" | "right" } = {}
) {
  const pick = opts.bold ? { latin: F.latin.bold, eth: F.ethiopic.bold } : { latin: F.latin.regular, eth: F.ethiopic.regular };
  doc.x = opts.x ?? doc.page.margins.left;
  if (opts.y !== undefined) doc.y = opts.y;
  if (opts.size) doc.fontSize(opts.size);
  if (opts.color) doc.fillColor(opts.color);
  const runs: Array<{ eth: boolean; s: string }> = [];
  for (const ch of text) {
    const eth = isEthiopic(ch);
    const last = runs[runs.length - 1];
    if (last && (last.eth === eth || /\s/.test(ch))) last.s += ch;
    else runs.push({ eth, s: ch });
  }
  if (runs.length === 0) return;
  runs.forEach((r, i) => {
    const isLast = i === runs.length - 1;
    doc.font(r.eth ? pick.eth : pick.latin).text(r.s, {
      continued: !isLast,
      ...(!isLast ? { lineBreak: false } : {}),
      ...(opts.width ? { width: opts.width } : {}),
      ...(opts.align && isLast ? { align: opts.align } : {}),
    });
  });
}

// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  ink: "#1F2937",
  muted: "#6B7280",
  line: "#E5E7EB",
  headFill: "#F3F4F6",
  brand: "#047857",
  brandSoft: "#ECFDF5",
  red: "#DC2626",
  amber: "#D97706",
  green: "#059669",
};

const STATUS_COLOR: Record<string, string> = {
  SATISFIED: C.green,
  IN_PROGRESS: C.amber,
  BLOCKED: C.red,
  NOT_STARTED: C.muted,
};
const STATUS_LABEL: Record<string, string> = {
  SATISFIED: "SATISFIED",
  IN_PROGRESS: "IN PROGRESS",
  BLOCKED: "BLOCKED",
  NOT_STARTED: "NOT STARTED",
};

// ── Canonical payload hash (recipient-verifiable) ────────────────────────────

export function dossierContentHash(p: DossierPayload): string {
  const payload = {
    generatedAt: p.generatedAt.toISOString(),
    deploymentAllowed: p.deploymentAllowed,
    phases: p.phases.map((ph) => ({
      phase: ph.phase,
      readinessPct: ph.readinessPct,
      open: ph.open,
      criteria: ph.criteria
        .map((c) => ({ code: c.code, status: c.status, evidence: c.evidence.map((e) => e.checksum.slice(0, 16)) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

// ── Generator ────────────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4
const M = 48;

export function generateGateDossierPdf(p: DossierPayload, lang: "en" | "am" = "en"): Promise<{ buffer: Buffer; hash: string; pages: number }> {
  return new Promise((resolve, reject) => {
    const pick = (en: string, am: string) => (lang === "en" ? en : am);
    const H = 841.89; // A4 height
    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true, // keep pages editable until end() so footers can be stamped
      margins: { top: 56, bottom: 64, left: M, right: M },
      info: {
        Title: "Track C Gate Dossier",
        Author: "Adwa Cyber Compliance Platform",
        Subject: "Gated expansion governance record (proposal Phases 4–5)",
      },
    });
    const chunks: Buffer[] = [];
    // pdfkit 0.20 exposes the buffered page count via _pageBuffer
    // (bufferedPageCount does not exist in this build)
    const pagesOf = () => (doc as PDFKit.PDFDocument & { _pageBuffer: unknown[] })._pageBuffer.length;
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), hash: dossierContentHash(p), pages: pagesOf() }));
    doc.on("error", reject);

    // ── footer stamp on every finished page ──────────────────────────────────
    const stampFooters = () => {
      const hash = dossierContentHash(p);
      const pages = pagesOf();
      for (let i = 0; i < pages; i++) {
        doc.switchToPage(i);
        // The footer lives INSIDE the bottom margin zone — shrink the
        // per-page bottom margin while stamping so pdfkit's overflow check
        // does not silently add spurious pages, then restore.
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 12;
        const fy = H - 42;
        doc.moveTo(M, fy).lineTo(PAGE_W - M, fy).lineWidth(0.5).strokeColor(C.line).stroke();
        doc.font(F.latin.regular).fontSize(7).fillColor(C.muted);
        doc.text(
          `Adwa Cyber — Track C Gate Dossier · ${pick("Confidential: institutional partners only. Not for redistribution.", "በምስጢር፦ ለተቋማዊ አጋርነቶች ብቻ። እንደገና እንዳይሰራጭ።")}`,
          M, fy + 5, { width: PAGE_W - 2 * M, lineBreak: false, ellipsis: true }
        );
        doc.text(`payload sha256 ${hash}`, M, fy + 15, { lineBreak: false });
        doc.text(`${pick("Page", "ገጽ")} ${i + 1}/${pages}`, PAGE_W - M - 60, fy + 15, { width: 60, align: "right", lineBreak: false });
        doc.page.margins.bottom = savedBottom;
      }
    };

    // ══ Header ════════════════════════════════════════════════════════════
    doc.save();
    doc.rect(0, 0, PAGE_W, 6).fill(C.brand);
    doc.restore();
    doc.font(F.latin.bold).fontSize(19).fillColor(C.ink);
    doc.text(pick("Track C Gate Dossier", "የTrack C በር ማስረጃ መዝገብ"), M, 34);
    doc.font(F.latin.regular).fontSize(9.5).fillColor(C.muted);
    doc.text(
      pick(
        "Adwa Cyber — gated expansion governance record (proposal Phases 4–5, roadmap §3.2 + §14)",
        "አድዋ ሳይበር — የተቆለፈ የስፋት ልማት የአስተዳደር መዝገብ (ምክረ ሀሳብ ምዕራፎች 4–5)"
      ),
      M, 58, { width: PAGE_W - 2 * M }
    );
    doc.fontSize(8.5);
    doc.text(
      `${pick("Generated", "የተዘጋጀው")}: ${p.generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC  ·  ${pick("posture", "አቋም")}: ${
        p.deploymentAllowed ? "DEPLOYMENT PERMITTED" : "DEPLOYMENT LOCKED"
      }`,
      M, 74, { width: PAGE_W - 2 * M }
    );

    // ══ Posture banner ═════════════════════════════════════════════════════
    let y = 100;
    doc.save();
    doc.roundedRect(M, y, PAGE_W - 2 * M, 44, 6)
      .fill(p.deploymentAllowed ? C.brandSoft : "#FFFBEB")
      .stroke(p.deploymentAllowed ? "#A7F3D0" : "#FDE68A")
      .lineWidth(1);
    doc.restore();
    doc.font(F.latin.bold).fontSize(10.5).fillColor(p.deploymentAllowed ? "#065F46" : "#92400E");
    doc.text(
      p.deploymentAllowed
        ? pick("All blocking criteria satisfied — the phase gate is OPEN.", "ሁሉም አግዳዊ መስፈርቶች ተሟልተዋል — የምዕራፉ በር ክፍት ነው።")
        : pick("Deployment locked: at least one blocking gate criterion is unsatisfied.", "ማቅረብ ተቆልፏል፦ ቢያንስ አንድ አግዳዊ የበር መስፈርት አልተሟለም።"),
      M + 12, y + 8, { width: PAGE_W - 2 * M - 24 }
    );
    doc.font(F.latin.regular).fontSize(8).fillColor(C.muted);
    doc.text(p.policy, M + 12, y + 25, { width: PAGE_W - 2 * M - 24 });
    y += 58;

    // ══ Phase sections ═════════════════════════════════════════════════════
    for (const ph of p.phases) {
      if (y > 620) { doc.addPage(); y = 60; }

      doc.font(F.latin.bold).fontSize(12.5).fillColor(C.ink);
      mixedText(doc, lang === "am" ? ph.labelAm : ph.label, { size: 12.5, color: C.ink, bold: true, y });
      doc.font(F.latin.regular).fontSize(8).fillColor(C.muted);
      doc.text(ph.instrument, M, y + 16, { width: PAGE_W - 2 * M });
      y += 30;

      // readiness bar
      const barW = PAGE_W - 2 * M - 130;
      doc.save();
      doc.roundedRect(M, y, barW, 10, 5).fill(C.headFill);
      doc.roundedRect(M, y, Math.max(6, (barW * ph.readinessPct) / 100), 10, 5).fill(ph.open ? C.green : C.amber);
      doc.restore();
      doc.font(F.latin.bold).fontSize(10).fillColor(ph.open ? C.green : C.amber);
      doc.text(`${ph.readinessPct}%`, M + barW + 8, y - 2, { lineBreak: false });
      doc.font(F.latin.regular).fontSize(8).fillColor(C.muted);
      doc.text(
        `${ph.satisfied}/${ph.total} ${pick("blocking criteria satisfied", "አግዳዊ መስፈርቶች ተሟልተዋል")} · ${ph.open ? pick("GATE OPEN", "በሩ ክፍት ነው") : pick("GATE LOCKED", "በሩ ተቆልፏል")}`,
        M + barW + 46, y + 1, { width: 80, lineBreak: false }
      );
      y += 22;

      // criteria table
      for (const c of ph.criteria) {
        if (y > 745) { doc.addPage(); y = 60; }
        doc.save();
        doc.roundedRect(M, y, PAGE_W - 2 * M, 46, 4).stroke(C.line).lineWidth(0.75);
        doc.restore();
        // status pip
        const sc = STATUS_COLOR[c.status] ?? C.muted;
        doc.save();
        doc.circle(M + 12, y + 12, 4).fill(sc);
        doc.restore();

        mixedText(doc, lang === "am" ? c.titleAm : c.titleEn, { bold: true, size: 9, color: C.ink, x: M + 24, y: y + 6, width: PAGE_W - 2 * M - 170 });
        doc.font(F.latin.regular).fontSize(7).fillColor(C.muted);
        doc.text(c.code, M + 24, y + 35, { lineBreak: false });

        doc.font(F.latin.bold).fontSize(7.5).fillColor(sc);
        doc.text(STATUS_LABEL[c.status] ?? c.status, PAGE_W - M - 128, y + 6, { width: 104, align: "right", lineBreak: false });
        doc.font(F.latin.regular).fontSize(7).fillColor(C.muted);
        doc.text(
          `${c.evidence.length} ${pick("artefact(s)", "ማስረጃ(ዎች)")} · ${c.updatedAt.toISOString().slice(0, 10)}`,
          PAGE_W - M - 128, y + 18, { width: 104, align: "right", lineBreak: false }
        );
        if (c.notes) {
          doc.font(F.latin.regular).fontSize(7).fillColor(C.muted);
          doc.text(`“${c.notes.slice(0, 110)}”`, M + 24, y + 20, { width: PAGE_W - 2 * M - 165, lineBreak: false, ellipsis: true });
        }
        y += 52;
      }
      y += 12;
    }

    // ══ Evidence register ═══════════════════════════════════════════════════
    doc.addPage();
    y = 60;
    doc.font(F.latin.bold).fontSize(12.5).fillColor(C.ink);
    doc.text(pick("Evidence register (SHA-256 sealed artefacts)", "የማስረጃ መዝገብ (SHA-256 የተባለ ማስረጃዎች)"), M, y);
    doc.font(F.latin.regular).fontSize(8).fillColor(C.muted);
    doc.text(
      pick(
        "Every satisfied criterion is backed by a stored artefact whose bytes are re-hashed against the sealed checksum on each download.",
        "እያንዳንዱ የተሟላ መስፈርት በአውራጅ የተቀመጠ ማስረጃ ይደገፋል — በእያንዳንዱ ማውረጃ የተባለ checksum ይመረመራል።"
      ),
      M, y + 16, { width: PAGE_W - 2 * M }
    );
    y += 38;

    let any = false;
    for (const ph of p.phases) {
      for (const c of ph.criteria) {
        for (const e of c.evidence) {
          any = true;
          if (y > 745) { doc.addPage(); y = 60; }
          doc.save();
          doc.roundedRect(M, y, PAGE_W - 2 * M, 34, 4).stroke(C.line).lineWidth(0.75);
          doc.restore();
          doc.font(F.latin.bold).fontSize(8).fillColor(C.ink);
          doc.text(e.fileName, M + 10, y + 5, { width: PAGE_W - 2 * M - 150, lineBreak: false, ellipsis: true });
          doc.font(F.latin.regular).fontSize(7).fillColor(C.muted);
          doc.text(`${c.code} · ${e.createdAt.toISOString().slice(0, 10)} · ${Math.max(1, Math.round(e.fileSize / 1024))} KB · ${e.uploadedByName ?? "—"}`, M + 10, y + 19, { lineBreak: false });
          doc.font(F.latin.regular).fontSize(6.5).fillColor(C.muted);
          doc.text(`sha256 ${e.checksum.slice(0, 24)}…`, PAGE_W - M - 140, y + 5, { width: 130, align: "right", lineBreak: false });
          doc.text(e.checksum.slice(24, 48), PAGE_W - M - 140, y + 15, { width: 130, align: "right", lineBreak: false });
          doc.text(e.checksum.slice(48, 64), PAGE_W - M - 140, y + 25, { width: 130, align: "right", lineBreak: false });
          y += 40;
        }
      }
    }
    if (!any) {
      doc.font(F.latin.regular).fontSize(8.5).fillColor(C.muted);
      doc.text(
        pick(
          "No artefacts attached yet — satisfaction without an artefact is refused by the platform (EVIDENCE_REQUIRED).",
          "እስካሁን ምንም ማስረጃ አልተያዘም — ያለ ማስረጃ ማሟላት በመድረኩ ውስጥ ይከለከላል (EVIDENCE_REQUIRED)።"
        ),
        M, y, { width: PAGE_W - 2 * M }
      );
    }

    stampFooters();
    doc.end();
  });
}
