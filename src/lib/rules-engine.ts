/**
 * Adwa Cyber — Rules Engine (evidence ↔ obligation mapping).
 *
 * Connects the Evidence Vault to the obligation catalogue:
 *  - Freshness policy: each evidence category has a maximum age (in months)
 *    before it is considered stale for audit purposes (NBE SBB/83/2022 expects
 *    periodic review cycles; PD-1321 Art. 22 expects current records).
 *  - Coverage evaluation: for every rule, classify the organization's linked
 *    evidence as SATISFIED (fresh evidence on file) / STALE (evidence exists
 *    but every document is past its freshness window) / GAP (no evidence).
 *  - Auto-linking: document tags that reference rule codes (e.g. "NBE-15,
 *    ART22-01") are resolved into EvidenceLink rows (source = AUTO_TAG).
 *
 * This module is server-only (imports nothing Node-specific today but is
 * intended for API routes); pure helpers are exported for unit testing.
 */
import { db } from "./db";
import type { EvidenceCategory } from "./evidence-shared";

// ── Freshness policy ─────────────────────────────────────────────────────────

/**
 * Maximum age (in months) of an evidence artefact per category before it is
 * considered stale. Aligned with common review cycles:
 *  - Policies & certificates: reviewed/issued on 1–3 year cycles → 24 months.
 *  - Audit reports & risk assessments: annual cycles → 12 months.
 *  - Training records: annual awareness requirements → 12 months.
 *  - Incident logs & technical config exports: quarterly review → 3 months.
 */
export const FRESHNESS_MONTHS: Record<EvidenceCategory, number> = {
  POLICY: 24,
  AUDIT_REPORT: 12,
  CERTIFICATE: 24,
  TRAINING_RECORD: 12,
  INCIDENT_LOG: 3,
  ASSESSMENT: 12,
  CONFIG_EXPORT: 3,
  OTHER: 24,
};

export interface FreshnessInfo {
  fresh: boolean;
  ageDays: number;
  maxAgeDays: number;
}

export function freshnessOf(category: string, createdAt: Date, now = new Date()): FreshnessInfo {
  const months = FRESHNESS_MONTHS[category as EvidenceCategory] ?? FRESHNESS_MONTHS.OTHER;
  const maxAgeDays = months * 30; // conservative 30-day months
  const ageDays = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
  return { fresh: ageDays <= maxAgeDays, ageDays, maxAgeDays };
}

// ── Coverage evaluation (pure) ───────────────────────────────────────────────

export type CoverageStatus = "SATISFIED" | "STALE" | "GAP";

export interface CoverageEvidence {
  linkId: string;
  evidenceId: string;
  title: string;
  fileName: string;
  category: string;
  version: number;
  status: string; // evidence document status (ACTIVE / ARCHIVED / SUPERSEDED)
  linkType: string; // SATISFIES | SUPPORTS
  source: string; // MANUAL | AUTO_TAG
  ageDays: number;
  fresh: boolean;
}

export interface RuleCoverage {
  ruleId: string;
  ruleCode: string;
  article: string;
  titleEn: string;
  titleAm: string;
  pillar: string;
  severity: string;
  weight: number;
  status: CoverageStatus;
  evidence: CoverageEvidence[];
  /** Engine suggestion: "yes" when fresh SATISFIES evidence exists. */
  suggestedAnswer: "yes" | null;
}

export interface CoverageSummary {
  total: number;
  satisfied: number;
  stale: number;
  gap: number;
  coveragePercent: number; // satisfied / total
  evidenceDocuments: number; // distinct ACTIVE evidence docs linked
}

export interface CoverageInputRule {
  id: string;
  code: string;
  article: string;
  titleEn: string;
  titleAm: string;
  pillar: string;
  severity: string;
  weight: number;
}

export interface CoverageInputLink {
  linkId: string;
  ruleId: string;
  linkType: string;
  source: string;
  evidence: {
    id: string;
    title: string;
    fileName: string;
    category: string;
    version: number;
    status: string;
    createdAt: Date;
  };
}

/**
 * Classify every rule against the organization's linked evidence.
 * Only ACTIVE documents that have not passed their freshness window count as
 * satisfying an obligation; ARCHIVED/SUPERSEDED/stale evidence still shows in
 * the per-rule list (auditors need to see it) but downgrades the status.
 */
export function evaluateRuleCoverage(
  rules: CoverageInputRule[],
  links: CoverageInputLink[],
  now = new Date()
): { coverage: RuleCoverage[]; summary: CoverageSummary } {
  const byRule = new Map<string, CoverageInputLink[]>();
  for (const l of links) {
    if (!byRule.has(l.ruleId)) byRule.set(l.ruleId, []);
    byRule.get(l.ruleId)!.push(l);
  }

  const coverage: RuleCoverage[] = rules.map((r) => {
    const linksForRule = byRule.get(r.id) ?? [];
    const evidence: CoverageEvidence[] = linksForRule.map((l) => {
      const f = freshnessOf(l.evidence.category, l.evidence.createdAt, now);
      return {
        linkId: l.linkId,
        evidenceId: l.evidence.id,
        title: l.evidence.title,
        fileName: l.evidence.fileName,
        category: l.evidence.category,
        version: l.evidence.version,
        status: l.evidence.status,
        linkType: l.linkType,
        source: l.source,
        ageDays: f.ageDays,
        fresh: f.fresh,
      };
    });

    const satisfies = evidence.filter((e) => e.linkType === "SATISFIES");
    const satisfyingActive = satisfies.filter((e) => e.status === "ACTIVE");
    const anyFresh = satisfyingActive.some((e) => e.fresh);
    const anyPresent = evidence.length > 0;

    const status: CoverageStatus = anyFresh ? "SATISFIED" : anyPresent ? "STALE" : "GAP";

    return {
      ruleId: r.id,
      ruleCode: r.code,
      article: r.article,
      titleEn: r.titleEn,
      titleAm: r.titleAm,
      pillar: r.pillar,
      severity: r.severity,
      weight: r.weight,
      status,
      evidence,
      suggestedAnswer: anyFresh ? "yes" : null,
    };
  });

  const satisfied = coverage.filter((c) => c.status === "SATISFIED").length;
  const summary: CoverageSummary = {
    total: coverage.length,
    satisfied,
    stale: coverage.filter((c) => c.status === "STALE").length,
    gap: coverage.filter((c) => c.status === "GAP").length,
    coveragePercent: coverage.length ? Math.round((satisfied / coverage.length) * 1000) / 10 : 0,
    evidenceDocuments: new Set(
      links
        .filter((l) => l.evidence.status === "ACTIVE")
        .map((l) => l.evidence.id)
    ).size,
  };

  return { coverage, summary };
}

// ── Tag parsing & auto-linking ───────────────────────────────────────────────

/**
 * Extract candidate rule-code references from a tag string.
 * Rule codes come in two shapes: "NBE-15" (letters-hyphen-number) and
 * "ART52-01" (letters+number-hyphen-suffix). Article references ("Art. 22")
 * are deliberately NOT auto-linked: one article fans out to several
 * obligations, so those stay manual.
 */
export function parseRuleRefs(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return [
    ...new Set(
      tags
        .split(",")
        .map((s) => s.trim())
        // NBE-15 | NBE-15-01 | ART52-01 (plain words like "awareness" never match)
        .filter((s) => /^([A-Za-z]{2,10}-\d{1,3}|[A-Za-z]{2,10}\d{1,3}-\d{1,3})$/.test(s))
        .map((s) => s.toUpperCase())
    ),
  ];
}

export interface AutoLinkResult {
  created: number;
  ruleCodes: string[];
}

/**
 * Reconcile AUTO_TAG links for one evidence document against its current
 * tags. MANUAL links are never touched. Returns the number created.
 */
export async function autoLinkEvidence(evidenceId: string, userId: string): Promise<AutoLinkResult> {
  const doc = await db.evidenceDocument.findUnique({
    where: { id: evidenceId },
    select: { id: true, tags: true, organizationId: true },
  });
  if (!doc) return { created: 0, ruleCodes: [] };

  const refs = parseRuleRefs(doc.tags);
  const rules = refs.length
    ? await db.rule.findMany({
        where: { isActive: true, code: { in: refs } },
        select: { id: true, code: true },
      })
    : [];

  const existing = await db.evidenceLink.findMany({
    where: { evidenceId, source: "AUTO_TAG" },
    select: { ruleId: true },
  });
  const existingIds = new Set(existing.map((l) => l.ruleId));

  let created = 0;
  for (const rule of rules) {
    if (existingIds.has(rule.id)) continue;
    await db.evidenceLink.create({
      data: {
        ruleId: rule.id,
        evidenceId,
        linkType: "SATISFIES",
        source: "AUTO_TAG",
        createdById: userId,
      },
    });
    created++;
  }

  // Drop AUTO_TAG links whose rule code is no longer referenced in the tags.
  const wantedIds = new Set(rules.map((r) => r.id));
  const staleAuto = [...existingIds].filter((id) => !wantedIds.has(id));
  if (staleAuto.length) {
    await db.evidenceLink.deleteMany({
      where: { evidenceId, source: "AUTO_TAG", ruleId: { in: staleAuto } },
    });
  }

  return { created, ruleCodes: rules.map((r) => r.code) };
}

// ── DB-facing coverage loader ────────────────────────────────────────────────

/**
 * Load rule coverage for an organization (optionally scoped to one framework)
 * straight from the database. Used by the coverage API, the scan wizard and
 * the catalogue badges.
 */
export async function getCoverageForOrg(
  orgId: string,
  frameworkCode?: string | null
): Promise<{ coverage: RuleCoverage[]; summary: CoverageSummary }> {
  const rules = await db.rule.findMany({
    where: {
      isActive: true,
      ...(frameworkCode ? { framework: { code: frameworkCode } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, code: true, article: true, titleEn: true, titleAm: true,
      pillar: true, severity: true, weight: true,
    },
  });

  const links = await db.evidenceLink.findMany({
    where: {
      evidence: { organizationId: orgId, status: { not: "DELETED" } },
      ...(frameworkCode ? { rule: { framework: { code: frameworkCode } } } : {}),
    },
    include: {
      evidence: {
        select: { id: true, title: true, fileName: true, category: true, version: true, status: true, createdAt: true },
      },
    },
  });

  const mapped: CoverageInputLink[] = links.map((l) => ({
    linkId: l.id,
    ruleId: l.ruleId,
    linkType: l.linkType,
    source: l.source,
    evidence: l.evidence,
  }));

  return evaluateRuleCoverage(rules, mapped);
}
