import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { anovaOneWay, groupStat, pairedT, type ScorePair } from "@/lib/awareness/awareness-engine";
import { AWARENESS_TOOLS } from "@/lib/awareness/awareness-tools";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;

/**
 * GET /api/awareness/overview — the Track B programme dashboard feed
 * (proposal Phase 3): pilot KPIs, consent register summary, curriculum
 * engagement, AI-tool usage telemetry, and the RQ2 pre/post knowledge
 * results with the ANOVA control-group contrast. SUPER_ADMIN only — school
 * data (minors) never leaves the platform level.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["awareness:manage"]);
  if (guard.error) return guard.error;

  // 14-day telemetry window aligned to local midnights so the daily series
  // and the per-tool counters describe exactly the same rows.
  const seriesStart = new Date();
  seriesStart.setHours(0, 0, 0, 0);
  seriesStart.setDate(seriesStart.getDate() - 13);
  const [schools, classes, learners, modules, assessments, progressRows, toolPings, recentPings] = await Promise.all([
    db.awarenessSchool.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.awarenessClass.findMany({ where: { isActive: true }, include: { school: true, _count: { select: { learners: true } } } }),
    db.awarenessLearner.findMany({ include: { class: true } }),
    db.awarenessModule.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { questions: { where: { isActive: true } } },
    }),
    db.awarenessAssessment.findMany({ select: { learnerId: true, kind: true, score: true, takenAt: true } }),
    db.awarenessProgress.findMany({ select: { moduleId: true, status: true, quizScore: true } }),
    db.awarenessToolPing.findMany({ select: { tool: true, lang: true, createdAt: true } }),
    db.awarenessToolPing.findMany({ where: { createdAt: { gte: seriesStart } }, select: { tool: true, lang: true, createdAt: true } }),
  ]);

  // RQ2 instrument modules are pinned to the KIDS pilot curriculum (Table 22).
  const kidsModules = modules.filter((m) => m.audience === "KIDS");

  // ── Consent register ──────────────────────────────────────────────────────
  const consent = { granted: 0, pending: 0, denied: 0 };
  for (const l of learners) {
    if (l.consent === "GRANTED") consent.granted++;
    else if (l.consent === "PENDING") consent.pending++;
    else consent.denied++;
  }

  // ── RQ2 pre/post pairs (consented learners with both sittings) ────────────
  const byLearner = new Map<string, Map<string, number>>();
  for (const a of assessments) {
    if (!byLearner.has(a.learnerId)) byLearner.set(a.learnerId, new Map());
    byLearner.get(a.learnerId)!.set(a.kind, a.score);
  }
  const pairsOf = (group: string | null): ScorePair[] => {
    const out: ScorePair[] = [];
    for (const l of learners) {
      if (l.consent !== "GRANTED") continue;
      if (group && l.class.groupType !== group) continue;
      const s = byLearner.get(l.id);
      const pre = s?.get("PRE");
      const post = s?.get("POST");
      if (typeof pre === "number" && typeof post === "number") out.push({ pre, post });
    }
    return out;
  };

  const treatmentPairs = pairsOf("TREATMENT");
  const controlPairs = pairsOf("CONTROL");
  const gainsByGroup: Record<string, number[]> = {
    TREATMENT: treatmentPairs.map((p) => p.post - p.pre),
    CONTROL: controlPairs.map((p) => p.post - p.pre),
  };
  const anova = anovaOneWay(gainsByGroup);

  // ── Per-school × group breakdown ──────────────────────────────────────────
  const perSchool = schools.map((s) => {
    const rows = classes
      .filter((c) => c.schoolId === s.id)
      .map((c) => {
        const pairs: ScorePair[] = [];
        for (const l of learners) {
          if (l.classId !== c.id || l.consent !== "GRANTED") continue;
          const sc = byLearner.get(l.id);
          const pre = sc?.get("PRE");
          const post = sc?.get("POST");
          if (typeof pre === "number" && typeof post === "number") pairs.push({ pre, post });
        }
        const g = groupStat(pairs);
        return {
          classId: c.id,
          className: c.name,
          grade: c.grade,
          groupType: c.groupType,
          joinCode: c.joinCode,
          learners: c._count.learners,
          instrument: g,
        };
      });
    return {
      schoolId: s.id,
      schoolName: s.name,
      schoolNameAm: s.nameAm,
      subCity: s.subCity,
      classes: rows,
    };
  });

  // ── Curriculum engagement (all tracks; the RQ2 curriculum is KIDS) ──────
  const moduleEngagement = modules.map((m) => {
    const rows = progressRows.filter((p) => p.moduleId === m.id);
    const completed = rows.filter((p) => p.status === "completed");
    const scores = completed.map((p) => p.quizScore ?? 0).filter((x) => x > 0);
    return {
      id: m.id,
      code: m.code,
      sortOrder: m.sortOrder,
      topic: m.topic,
      titleEn: m.titleEn,
      titleAm: m.titleAm,
      audience: m.audience,
      durationMin: m.durationMin,
      questions: m.questions.length,
      started: rows.length,
      completed: completed.length,
      avgQuizScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    };
  });

  // ── AI Enhancement Lab usage (aggregate telemetry — no personal data) ────
  const toolStats = AWARENESS_TOOLS.map((t) => {
    const total = toolPings.filter((p) => p.tool === t.id);
    const recent = recentPings.filter((p) => p.tool === t.id);
    return {
      id: t.id,
      nameEn: t.nameEn,
      nameAm: t.nameAm,
      audiences: t.audiences,
      moduleCode: t.moduleCode,
      total: total.length,
      last14d: recent.length,
      amShare: total.length ? Math.round((total.filter((p) => p.lang === "am").length / total.length) * 100) : null,
    };
  });
  const series: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(seriesStart.getTime() + (13 - i) * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    series.push({
      day: dayStart.toISOString().slice(0, 10),
      count: recentPings.filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd).length,
    });
  }

  const totalCompletions = progressRows.filter((p) => p.status === "completed").length;
  const treatmentLearners = learners.filter((l) => l.class.groupType === "TREATMENT" && l.consent === "GRANTED").length;
  const preSittings = assessments.filter((a) => a.kind === "PRE").length;
  const postSittings = assessments.filter((a) => a.kind === "POST").length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    programme: {
      schools: schools.length,
      classes: classes.length,
      treatmentClasses: classes.filter((c) => c.groupType === "TREATMENT").length,
      controlClasses: classes.filter((c) => c.groupType === "CONTROL").length,
      learners: learners.length,
      consent,
      consentRate: learners.length ? Math.round((consent.granted / learners.length) * 1000) / 10 : 0,
      modules: modules.length,
      modulesByAudience: {
        KIDS: modules.filter((m) => m.audience === "KIDS").length,
        TEENS: modules.filter((m) => m.audience === "TEENS").length,
        PRO: modules.filter((m) => m.audience === "PRO").length,
        AWARE: modules.filter((m) => m.audience === "AWARE").length,
      },
      instrumentItems: kidsModules.reduce((acc, m) => acc + (m.questions.length >= 3 ? 2 : Math.min(1, m.questions.length)), 0),
    },
    engagement: {
      lessonCompletions: totalCompletions,
      treatmentLearners,
      completionsPerTreatmentLearner: treatmentLearners ? Math.round((totalCompletions / treatmentLearners) * 10) / 10 : 0,
      preSittings,
      postSittings,
      modules: moduleEngagement,
    },
    tools: {
      total: toolPings.length,
      last14d: recentPings.length,
      amShare: toolPings.length ? Math.round((toolPings.filter((p) => p.lang === "am").length / toolPings.length) * 1000) / 10 : 0,
      tools: toolStats,
      series,
    },
    rq2: {
      design: "Pre/post knowledge assessment, control-group design (paired t within group; one-way ANOVA on gains between groups)",
      treatment: { stat: groupStat(treatmentPairs), pairedT: pairedT(treatmentPairs) },
      control: { stat: groupStat(controlPairs), pairedT: pairedT(controlPairs) },
      anova,
    },
    schools: perSchool,
  });
}
