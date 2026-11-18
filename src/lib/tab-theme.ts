/**
 * Adwa Cyber — per-module visual identity.
 *
 * Each workspace tab carries its own accent colour, chosen to echo the
 * module's mission (the same convention commercial platforms use — e.g. a
 * red "offensive testing" module vs a violet SOC):
 *
 *   dashboard   emerald   the Adwa brand — live posture
 *   catalogue    indigo   the statutory rulebook
 *   organizations blue    the registry of monitored entities
 *   scan         cyan     active radar-style assessment
 *   findings     rose     open risk & remediation
 *   evidence     amber    the vault of artefacts
 *   soc          violet   24/7 operations centre
 *   vapt         red      offensive security (VAPT / red team)
 *   awareness    sky       education & outreach
 *   trackc       orange   governance & CII monitoring
 *   report      slate     board-grade reporting
 *   team       fuchsia    people & access
 *   audit        zinc      immutable trail
 *
 * The hex values double as: sidebar active gradient, hero banner gradient,
 * 3D globe tint and the ambient page tint — one source of truth.
 */

export interface TabTheme {
  /** primary accent (600-level) — hero/sidebar */
  accent: string;
  /** darker companion (700/800-level) for gradient depth */
  accentDeep: string;
  /** lighter companion (300/400-level) for gradient tail */
  accentSoft: string;
  /** i18n keys for the hero banner */
  titleKey: string;
  subKey: string;
  /** optional chip on the hero (module tagline) */
  chip: string;
  /** optional live-data chip */
  liveChip?: string;
}

export const TAB_THEMES: Record<string, TabTheme> = {
  dashboard: {
    accent: "#059669", accentDeep: "#065f46", accentSoft: "#34d399",
    titleKey: "dashTitle", subKey: "dashSub",
    chip: "PD-1321 · NBE SBB/83/2022",
    liveChip: "Live posture",
  },
  catalogue: {
    accent: "#4f46e5", accentDeep: "#3730a3", accentSoft: "#818cf8",
    titleKey: "catTitle", subKey: "catSub",
    chip: "47 obligations · machine-readable",
  },
  organizations: {
    accent: "#2563eb", accentDeep: "#1e40af", accentSoft: "#60a5fa",
    titleKey: "orgTitle", subKey: "orgSub",
    chip: "Pilot & monitored entities",
  },
  scan: {
    accent: "#0891b2", accentDeep: "#0e7490", accentSoft: "#22d3ee",
    titleKey: "scanTitle", subKey: "scanSub",
    chip: "Evidence-based · 47 rules",
  },
  findings: {
    accent: "#e11d48", accentDeep: "#9f1239", accentSoft: "#fb7185",
    titleKey: "findTitle", subKey: "findSub",
    chip: "SLA-tracked remediation",
  },
  evidence: {
    accent: "#d97706", accentDeep: "#b45309", accentSoft: "#fbbf24",
    titleKey: "evTitle", subKey: "evSub",
    chip: "SHA-256 integrity · versioned",
  },
  report: {
    accent: "#334155", accentDeep: "#1e293b", accentSoft: "#64748b",
    titleKey: "repTitle", subKey: "repSub",
    chip: "Board-ready · PDF export",
  },
  soc: {
    accent: "#7c3aed", accentDeep: "#5b21b6", accentSoft: "#a78bfa",
    titleKey: "socTitle", subKey: "socSub",
    chip: "CERT-as-a-Service · Ethio-CERT",
    liveChip: "24/7 monitoring",
  },
  vapt: {
    accent: "#dc2626", accentDeep: "#991b1b", accentSoft: "#f87171",
    titleKey: "vaptTitle", subKey: "vaptSub",
    chip: "NBE LOT4 §B · four-eyes authorization",
    liveChip: "NVD · FIRST · CT logs",
  },
  awareness: {
    accent: "#0284c7", accentDeep: "#0369a1", accentSoft: "#38bdf8",
    titleKey: "awTitle", subKey: "awSub",
    chip: "Amharic-first curriculum",
  },
  trackc: {
    accent: "#ea580c", accentDeep: "#9a3412", accentSoft: "#fb923c",
    titleKey: "tcTitle", subKey: "tcSub",
    chip: "ACFS gates · CII monitor",
  },
  team: {
    accent: "#c026d3", accentDeep: "#86198f", accentSoft: "#e879f9",
    titleKey: "team", subKey: "teamSub",
    chip: "RBAC · MFA",
  },
  audit: {
    accent: "#3f3f46", accentDeep: "#18181b", accentSoft: "#71717a",
    titleKey: "auditLog", subKey: "auditSub",
    chip: "Hash-chained · immutable",
  },
};

export function tabTheme(view: string): TabTheme {
  return TAB_THEMES[view] ?? TAB_THEMES.dashboard;
}
