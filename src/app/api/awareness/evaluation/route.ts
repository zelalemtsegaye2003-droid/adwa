import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { anovaOneWay, gainHistogram, groupStat, pairedT, type ScorePair } from "@/lib/awareness-engine";
import { resolveInstrument } from "@/lib/awareness-server";

export const runtime = "nodejs";

/**
 * GET /api/awareness/evaluation — the RQ2 evaluation export for the research
 * team (BDU ethical-review design): full pseudonymised pre/post dataset,
 * paired t-tests per group, the one-way ANOVA control-group contrast,
 * per-school breakdown and gain histograms. ?format=csv returns the raw
 * learner-level table for SPSS/R.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;

  const [learners, assessments, instrument] = await Promise.all([
    db.awarenessLearner.findMany({
      include: { class: { include: { school: true } } },
      orderBy: { code: "asc" },
    }),
    db.awarenessAssessment.findMany({ select: { learnerId: true, kind: true, score: true, takenAt: true } }),
    resolveInstrument(),
  ]);

  const byLearner = new Map<string, Map<string, { score: number; takenAt: Date }>>();
  for (const a of assessments) {
    if (!byLearner.has(a.learnerId)) byLearner.set(a.learnerId, new Map());
    byLearner.get(a.learnerId)!.set(a.kind, { score: a.score, takenAt: a.takenAt });
  }

  const rows = learners
    .filter((l) => l.consent === "GRANTED")
    .map((l) => {
      const s = byLearner.get(l.id);
      const pre = s?.get("PRE");
      const post = s?.get("POST");
      return {
        code: l.code,
        school: l.class.school.name,
        subCity: l.class.school.subCity,
        className: l.class.name,
        grade: l.grade,
        group: l.class.groupType,
        pre: pre ? pre.score : null,
        post: post ? post.score : null,
        gain: pre && post ? Math.round((post.score - pre.score) * 10) / 10 : null,
        preTakenAt: pre ? pre.takenAt : null,
        postTakenAt: post ? post.takenAt : null,
      };
    });

  const pairsOf = (group: string): ScorePair[] =>
    rows.filter((r) => r.group === group && r.pre !== null && r.post !== null).map((r) => ({ pre: r.pre!, post: r.post! }));

  const treatmentPairs = pairsOf("TREATMENT");
  const controlPairs = pairsOf("CONTROL");
  const anova = anovaOneWay({
    TREATMENT: treatmentPairs.map((p) => p.post - p.pre),
    CONTROL: controlPairs.map((p) => p.post - p.pre),
  });

  // Per-school × group aggregation for the ANOVA annex table.
  const schools = [...new Set(rows.map((r) => r.school))].sort();
  const perSchool = schools.map((sn) => {
    const cells: Record<string, ReturnType<typeof groupStat> | null> = {};
    const groups: Record<string, number[]> = {};
    for (const g of ["TREATMENT", "CONTROL"]) {
      const pairs: ScorePair[] = rows
        .filter((r) => r.school === sn && r.group === g && r.pre !== null && r.post !== null)
        .map((r) => ({ pre: r.pre!, post: r.post! }));
      groups[g] = pairs.map((p) => p.post - p.pre);
      cells[g] = groupStat(pairs);
    }
    return { school: sn, n: rows.filter((r) => r.school === sn && r.gain !== null).length, groups, cells };
  });

  const csv = req.nextUrl.searchParams.get("format") === "csv";
  if (csv) {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "participant_code,school,sub_city,class,grade,group,pre_score,post_score,gain,pre_taken_at,post_taken_at";
    const lines = rows.map((r) =>
      [r.code, r.school, r.subCity, r.className, r.grade, r.group, r.pre, r.post, r.gain, r.preTakenAt?.toISOString() ?? "", r.postTakenAt?.toISOString() ?? ""].map(esc).join(",")
    );
    return new NextResponse([header, ...lines].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="adwa-awareness-rq2-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    instrument: {
      items: instrument.length,
      draw: "First and third bank item of each active module (fixed for PRE and POST)",
    },
    design: "RQ2 — pre/post knowledge assessment, control-group design (ANOVA on gains; paired t within group)",
    n: {
      consented: rows.length,
      withBoth: rows.filter((r) => r.pre !== null && r.post !== null).length,
      treatmentPaired: treatmentPairs.length,
      controlPaired: controlPairs.length,
    },
    treatment: { stat: groupStat(treatmentPairs), pairedT: pairedT(treatmentPairs), histogram: gainHistogram(treatmentPairs.map((p) => p.post - p.pre)) },
    control: { stat: groupStat(controlPairs), pairedT: pairedT(controlPairs), histogram: gainHistogram(controlPairs.map((p) => p.post - p.pre)) },
    anova,
    perSchool,
    rows,
  });
}
