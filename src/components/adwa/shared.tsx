"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

// ── Shared types ────────────────────────────────────────────────────────────
export interface RuleDTO {
  id: string; code: string; article: string; articleSubject: string;
  titleEn: string; titleAm: string; statementEn: string; statementAm: string;
  questionEn: string; questionAm: string; checkLogic: string;
  remediationEn: string; remediationAm: string;
  pillar: string; severity: string; priority: string; penaltyRef: string; weight: number;
  frameworkCode?: string | null;
}

export interface FrameworkDTO {
  id: string; code: string; name: string; nameAm: string;
  issuer: string; instrument: string; instrumentNo: string;
  descriptionEn: string; descriptionAm: string;
  pillars: { name: string; nameAm: string; weight: number }[];
  sectorScope: string; sourceUrl?: string | null;
  ruleCount: number; scanCount: number;
}

export interface FrameworkBrief {
  code: string; name: string; instrumentNo: string;
}

export interface OrgDTO {
  id: string; name: string; nameAm: string; sector: string; tier: string;
  contactEmail?: string | null; status: string; notes?: string | null;
  latestScan?: ScanBriefDTO | null; scanCount?: number;
}

export interface ScanBriefDTO {
  id: string; name: string; status: string; overallScore: number | null;
  findingsCount: number; criticalFindings: number;
  startedAt: string; completedAt: string | null; durationMinutes: number | null;
  answeredCount?: number; // in_progress drafts: how many obligations are answered
  organization?: { id: string; name: string; nameAm: string; sector: string; tier: string };
  organizationId?: string;
  framework?: FrameworkBrief | null;
  frameworkId?: string | null;
}

export interface ResultDTO {
  id: string; scanId: string; answer: string; score: number; riskRank: number | null;
  status: string; findingEn?: string | null; findingAm?: string | null; evidenceNote?: string | null;
  dueAt?: string | null; remediatedAt?: string | null;
  rule: RuleDTO;
}

export interface ScanDetailDTO extends ScanBriefDTO {
  organization: OrgDTO;
  results: ResultDTO[];
  pillarScores?: string | null;
  auditorName?: string;
  framework?: (FrameworkBrief & { descriptionEn?: string; descriptionAm?: string }) | null;
}

// ── Severity / status badges (Ethiopian flag palette: green-amber-red) ──────
export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useI18n();
  const label = t(severity);
  if (severity === "critical")
    return <Badge className="bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 hover:bg-red-100">{label}</Badge>;
  if (severity === "high")
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100">{label}</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-100">{label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    open: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    in_progress: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    remediated: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    waived: "bg-muted text-muted-foreground border-border",
  };
  const label = status === "in_progress" ? t("stProgress") : status === "open" ? t("stOpen")
    : status === "remediated" ? t("stRemediated") : status === "waived" ? t("stWaived") : status;
  return <Badge variant="outline" className={`${map[status] ?? map.waived} hover:bg-transparent`}>{label}</Badge>;
}

// ── Remediation SLA badge (Procl. 1426/2026 corrective-action timelines) ────
// Renders the SLA state plus a human deadline hint (“due 12 Nov · 4d left”).
export function SlaBadge({ state, daysRemaining, dueAt }: { state: string; daysRemaining: number | null; dueAt?: string | null }) {
  const { t, lang } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    ON_TRACK: { label: t("slaOnTrack"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900" },
    DUE_SOON: { label: t("slaDueSoon"), cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
    OVERDUE: { label: t("slaOverdue"), cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
    CLOSED_ON_TIME: { label: t("slaClosedOnTime"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900" },
    CLOSED_LATE: { label: t("slaClosedLate"), cls: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" },
    WAIVED: { label: t("slaWaived"), cls: "bg-muted text-muted-foreground border-border" },
    NOT_TRACKED: { label: t("slaNotTracked"), cls: "bg-muted text-muted-foreground border-border" },
  };
  const e = map[state] ?? map.NOT_TRACKED;
  const dateHint = dueAt
    ? new Date(dueAt).toLocaleDateString(lang === "en" ? "en-GB" : "am-ET", { day: "numeric", month: "short" })
    : null;
  const dayHint =
    state === "OVERDUE" && daysRemaining !== null
      ? t("slaDaysOver", String(Math.abs(daysRemaining)))
      : (state === "DUE_SOON" || state === "ON_TRACK") && daysRemaining !== null
        ? t("slaDaysLeft", String(daysRemaining))
        : null;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge variant="outline" className={`${e.cls} hover:bg-transparent`}>{e.label}</Badge>
      {(dateHint || dayHint) && (
        <span className="text-[11px] leading-none text-muted-foreground">
          {dateHint}{dayHint ? ` · ${dayHint}` : ""}
        </span>
      )}
    </span>
  );
}

export function AnswerBadge({ answer }: { answer: string }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    yes: { label: t("answerYes"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
    partial: { label: t("answerPartial"), cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
    no: { label: t("answerNo"), cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
    na: { label: t("answerNa"), cls: "bg-muted text-muted-foreground border-border" },
  };
  const e = map[answer] ?? map.na;
  return <Badge variant="outline" className={`${e.cls} whitespace-nowrap hover:bg-transparent`}>{e.label}</Badge>;
}

export function PillarBadge({ pillar }: { pillar: string }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    Legal: { label: t("legal"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900" },
    Technical: { label: t("technical"), cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900" },
    Organisational: { label: t("organisational"), cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900" },
    Awareness: { label: t("awareness"), cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900" },
    // NBE-IT framework pillars
    Governance: { label: t("governance"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900" },
    Automation: { label: t("automation"), cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900" },
    "Risk Management": { label: t("riskMgmt"), cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900" },
    "Cyber Security": { label: t("cyberSec"), cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900" },
    Continuity: { label: t("continuity"), cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900" },
  };
  const e = map[pillar] ?? { label: pillar, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={`${e.cls} hover:bg-transparent`}>{e.label}</Badge>;
}

// ── Framework badge (which regulatory instrument a rule/scan belongs to) ──
export function FrameworkBadge({ code, full }: { code?: string | null; full?: boolean }) {
  if (!code) return null;
  if (code === "NBE-IT") {
    return (
      <Badge variant="outline" className="whitespace-nowrap bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 hover:bg-teal-50">
        {full ? "NBE SBB/83/2022" : "NBE"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-50">
      {full ? "Procl. 1321/2024" : "PD 1321"}
    </Badge>
  );
}

// ── Score ring gauge ────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const stroke = size / 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? "#059669" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize: size / 4.2 }}>{pct.toFixed(1)}%</span>
        {label && <span className="text-muted-foreground text-[10px] uppercase tracking-wide mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

export function scoreColor(score: number): string {
  return score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
}

// ── Bilingual text helpers ──────────────────────────────────────────────────
export function RuleTitle({ rule }: { rule: RuleDTO }) {
  const { lang } = useI18n();
  return <span>{lang === "en" ? rule.titleEn : rule.titleAm}</span>;
}
export function pickByLang(lang: Lang, en: string, am: string) {
  return lang === "en" ? en : am;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
