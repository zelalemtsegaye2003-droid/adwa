// ─────────────────────────────────────────────────────────────────────────────
// Adwa Cyber — Compliance Engine v1.0
// Evaluates evidence answers against the 47-rule catalogue and produces
// pillar-weighted scores, findings, risk ranking, and remediation plans
// (proposal Table 18: Automated Scoring, Predictive Violation Detection,
// Smart Remediation Engine, Risk Prioritisation).
// ─────────────────────────────────────────────────────────────────────────────

export type Answer = "yes" | "partial" | "no" | "na";

export interface EngineRuleInput {
  code: string;
  article: string;
  titleEn: string;
  titleAm: string;
  statementEn: string;
  statementAm: string;
  remediationEn: string;
  remediationAm: string;
  pillar: string;
  severity: string;
  penaltyRef: string;
  weight: number;
}

export interface EngineAnswerInput {
  ruleCode: string;
  answer: Answer;
  evidenceNote?: string;
}

export interface EngineResult {
  ruleCode: string;
  answer: Answer;
  score: number; // 0 / 50 / 100
  riskRank: number; // 0 when compliant or NA
  isFinding: boolean;
  predictive: boolean; // partial + high penalty → likely violation trajectory
  findingEn?: string;
  findingAm?: string;
}

export const PILLARS = ["Legal", "Technical", "Organisational", "Awareness"] as const;
export type PillarName = (typeof PILLARS)[number];

// Weighted pillars (proposal Table 18 — four weighted pillars)
export const PILLAR_WEIGHTS: Record<PillarName, number> = {
  Legal: 0.35,
  Technical: 0.3,
  Organisational: 0.2,
  Awareness: 0.15,
};

const ANSWER_SCORE: Record<Answer, number> = { yes: 100, partial: 50, no: 0, na: 0 };

// Penalty exposure factor — turnover-based and longest custodial penalties rank highest
function penaltyFactor(penaltyRef: string): number {
  if (penaltyRef.includes("4%")) return 3;
  if (penaltyRef.includes("5–10 years")) return 3;
  if (penaltyRef.includes("3–5 years")) return 2;
  if (penaltyRef.includes("1–3 years")) return 1.5;
  return 1; // administrative fine
}

export interface EngineOutput {
  overallScore: number;
  pillarScores: Record<string, number>;
  results: EngineResult[];
  findingsCount: number;
  criticalFindings: number;
  remediationPlan: {
    rank: number;
    code: string;
    article: string;
    titleEn: string;
    titleAm: string;
    remediationEn: string;
    remediationAm: string;
    riskRank: number;
    severity: string;
    penaltyRef: string;
  }[];
}

export function evaluate(
  rules: EngineRuleInput[],
  answers: EngineAnswerInput[]
): EngineOutput {
  const answerMap = new Map(answers.map((a) => [a.ruleCode, a.answer]));

  const results: EngineResult[] = rules.map((rule) => {
    const answer = (answerMap.get(rule.code) ?? "na") as Answer;
    const score = ANSWER_SCORE[answer];
    const isFinding = answer === "no" || answer === "partial";
    const pf = penaltyFactor(rule.penaltyRef);
    // Risk rank = rule weight × penalty exposure × answer severity
    const answerFactor = answer === "no" ? 1 : answer === "partial" ? 0.6 : 0;
    const riskRank = isFinding ? Math.round(rule.weight * pf * answerFactor * 10) / 10 : 0;
    // Predictive Violation Detection: partial compliance on a rule with real penalty exposure
    const predictive = answer === "partial" && pf >= 2;
    return {
      ruleCode: rule.code,
      answer,
      score,
      riskRank,
      isFinding,
      predictive,
      findingEn: isFinding
        ? `${rule.titleEn} — ${answer === "no" ? "not implemented" : "partially implemented"} (${rule.article}, ${rule.severity} severity)`
        : undefined,
      findingAm: isFinding
        ? `${rule.titleAm} — ${answer === "no" ? "አልተተገበረም" : "በከፊል ተተገብሯል"} (${rule.article})`
        : undefined,
    };
  });

  // Pillar scores: weighted by rule weight, NA excluded
  const pillarScores: Record<string, number> = {};
  for (const pillar of PILLARS) {
    const pillarRules = rules
      .map((r, i) => ({ r, res: results[i] }))
      .filter(({ r }) => r.pillar === pillar);
    const applicable = pillarRules.filter(({ res }) => res.answer !== "na");
    if (applicable.length === 0) {
      pillarScores[pillar] = 0;
      continue;
    }
    const totalWeight = applicable.reduce((s, { r }) => s + r.weight, 0);
    const earned = applicable.reduce((s, { r, res }) => s + r.weight * (res.score / 100), 0);
    pillarScores[pillar] = totalWeight > 0 ? Math.round((earned / totalWeight) * 1000) / 10 : 0;
  }

  // Overall: pillar-weighted (only pillars with applicable rules count)
  let weightedSum = 0;
  let weightSum = 0;
  for (const pillar of PILLARS) {
    const pillarRules = rules
      .map((r, i) => ({ r, res: results[i] }))
      .filter(({ r }) => r.pillar === pillar);
    if (pillarRules.some(({ res }) => res.answer !== "na")) {
      weightedSum += pillarScores[pillar] * PILLAR_WEIGHTS[pillar];
      weightSum += PILLAR_WEIGHTS[pillar];
    }
  }
  const overallScore = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0;

  // Smart Remediation Engine: prioritised plan ranked by risk
  const plan = rules
    .map((r, i) => ({ r, res: results[i] }))
    .filter(({ res }) => res.isFinding)
    .sort((a, b) => b.res.riskRank - a.res.riskRank)
    .map(({ r, res }, idx) => ({
      rank: idx + 1,
      code: r.code,
      article: r.article,
      titleEn: r.titleEn,
      titleAm: r.titleAm,
      remediationEn: r.remediationEn,
      remediationAm: r.remediationAm,
      riskRank: res.riskRank,
      severity: r.severity,
      penaltyRef: r.penaltyRef,
    }));

  const criticalFindings = results.filter(
    ({ ruleCode, answer }) =>
      (answer === "no" || answer === "partial") &&
      rules.find((r) => r.code === ruleCode)?.severity === "critical"
  ).length;

  return {
    overallScore,
    pillarScores,
    results,
    findingsCount: results.filter((r) => r.isFinding).length,
    criticalFindings,
    remediationPlan: plan,
  };
}

// RQ1 reporting: manual baseline 40–80 hours (proposal Table 37) vs engine time
export function auditTimeComparison(durationMinutes: number) {
  const manualHigh = 80;
  const manualLow = 40;
  const reduction = Math.round((1 - durationMinutes / 60 / manualLow) * 1000) / 10;
  return {
    manualRangeHours: [manualLow, manualHigh] as [number, number],
    engineMinutes: Math.round(durationMinutes * 10) / 10,
    reductionPercent: Math.max(0, reduction),
    rq1Target: 70,
  };
}
