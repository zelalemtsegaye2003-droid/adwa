"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, ChevronLeft, ChevronRight, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SeverityBadge, PillarBadge, ScoreRing, scoreColor, AnswerBadge, type RuleDTO, type OrgDTO, type ResultDTO } from "./shared";

type Answer = "yes" | "partial" | "no" | "na";

interface EngineOut {
  overallScore: number;
  pillarScores: Record<string, number>;
  findingsCount: number;
  criticalFindings: number;
  remediationPlan: {
    rank: number; code: string; article: string; titleEn: string; titleAm: string;
    remediationEn: string; remediationAm: string; riskRank: number; severity: string; penaltyRef: string;
  }[];
}

export function ScanWizard({
  preselectedOrgId, onDone,
}: {
  preselectedOrgId?: string | null;
  onDone: (scanId: string) => void;
}) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(1);
  const [orgs, setOrgs] = useState<OrgDTO[]>([]);
  const [rules, setRules] = useState<RuleDTO[] | null>(null);
  const [orgId, setOrgId] = useState(preselectedOrgId ?? "");
  const [scanName, setScanName] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [engineOut, setEngineOut] = useState<EngineOut | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/organizations").then((r) => r.json()).then((d) => {
      setOrgs(d.organizations);
      if (preselectedOrgId) setOrgId(preselectedOrgId);
    }).catch(() => {});
    fetch("/api/rules").then((r) => r.json()).then((d) => setRules(d.rules)).catch(() => setRules([]));
  }, [preselectedOrgId]);

  const grouped = useMemo(() => {
    if (!rules) return [];
    const map = new Map<string, RuleDTO[]>();
    for (const r of rules) {
      const key = r.articleSubject;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rules]);

  const answeredCount = Object.values(answers).filter((a) => a).length;
  const progress = rules?.length ? Math.round((answeredCount / rules.length) * 100) : 0;

  const startScan = async () => {
    if (!orgId) { toast.error(t("step1")); return; }
    const res = await fetch("/api/scans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, name: scanName || undefined }),
    });
    if (!res.ok) { toast.error((await res.json()).error ?? "Error"); return; }
    const { scan } = await res.json();
    setScanId(scan.id);
    setStep(2);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const runEngine = async () => {
    if (!scanId || !rules) return;
    setRunning(true);
    const payload = {
      answers: rules.map((r) => ({
        ruleCode: r.code,
        answer: answers[r.code] ?? "na",
        evidenceNote: notes[r.code] || undefined,
      })),
    };
    const res = await fetch(`/api/scans/${scanId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setRunning(false);
    if (!res.ok) { toast.error((await res.json()).error ?? "Engine error"); return; }
    const data = await res.json();
    setEngineOut(data.engine);
    setDuration(data.time?.engineMinutes ?? null);
    setStep(3);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    toast.success(`${t("overallScore")}: ${data.engine.overallScore}%`);
  };

  const setAnswer = (code: string, a: Answer) => {
    setAnswers((prev) => ({ ...prev, [code]: a }));
  };

  return (
    <div ref={topRef} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("scanTitle")}</h2>
        <p className="text-muted-foreground">{t("scanSub")}</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((s, i) => (
          <React.Fragment key={s}>
            <span
              className={`flex h-7 items-center gap-1.5 rounded-full px-3 font-medium transition-colors ${
                step === s ? "bg-emerald-700 text-white"
                : step > s ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : s}
              <span className="hidden sm:inline">{t(`step${s}`)}</span>
            </span>
            {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: organization */}
      {step === 1 && (
        <Card className="max-w-xl">
          <CardContent className="p-6 space-y-5">
            <div className="grid gap-2">
              <Label>{t("org")}</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger aria-label={t("org")}><SelectValue placeholder={t("step1")} /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scan-name">{t("scanName")}</Label>
              <Input
                id="scan-name"
                value={scanName}
                onChange={(e) => setScanName(e.target.value)}
                placeholder="Q4 2026 full compliance audit — 47 rules"
              />
            </div>
            <Button onClick={startScan} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Play className="h-4 w-4" aria-hidden /> {t("startScan")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: evidence questionnaire */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Progress value={progress} className="flex-1 min-w-40 h-2" aria-label="progress" />
            <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
              {answeredCount}/{rules?.length ?? 47} {t("answered")}
            </span>
          </div>
          <ScrollArea className="max-h-[calc(100vh-380px)] pr-3">
            <div className="space-y-6">
              {!rules && <Skeleton className="h-64 rounded-xl" />}
              {grouped.map(([subject, rs]) => (
                <div key={subject}>
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 sticky top-0 bg-background/95 backdrop-blur py-1.5 z-10 border-b">
                    {subject}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {rs.map((r) => (
                      <Card key={r.id} className={answers[r.code] ? "border-emerald-200 dark:border-emerald-900" : ""}>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-[240px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.code}</code>
                                <span className="font-medium text-sm">{lang === "en" ? r.titleEn : r.titleAm}</span>
                                <SeverityBadge severity={r.severity} />
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {lang === "en" ? r.questionEn : r.questionAm}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["yes", "partial", "no", "na"] as Answer[]).map((a) => (
                              <button
                                key={a}
                                type="button"
                                onClick={() => setAnswer(r.code, a)}
                                aria-pressed={answers[r.code] === a}
                                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  answers[r.code] === a
                                    ? a === "yes" ? "bg-emerald-600 text-white border-emerald-600"
                                      : a === "partial" ? "bg-amber-500 text-white border-amber-500"
                                      : a === "no" ? "bg-red-600 text-white border-red-600"
                                      : "bg-muted-foreground text-white border-muted-foreground"
                                    : "bg-background hover:bg-muted"
                                }`}
                              >
                                {a === "yes" ? t("answerYes") : a === "partial" ? t("answerPartial") : a === "no" ? t("answerNo") : t("answerNa")}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            className="mt-2 text-sm"
                            rows={1}
                            placeholder={t("evidenceNote")}
                            value={notes[r.code] ?? ""}
                            onChange={(e) => setNotes((p) => ({ ...p, [r.code]: e.target.value }))}
            aria-label={`${t("evidenceNote")} ${r.code}`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" aria-hidden /> {t("step1")}</Button>
            <Button onClick={runEngine} disabled={running || answeredCount === 0} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {running ? <><AlertTriangle className="h-4 w-4 animate-pulse" aria-hidden /> {t("running")}</> : <><Play className="h-4 w-4" aria-hidden /> {t("runEngine")}</>}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: engine results */}
      {step === 3 && engineOut && (
        <div className="space-y-6">
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={engineOut.overallScore} size={140} label={t("overallScore")} />
              <div className="flex-1 w-full space-y-3">
                {Object.entries(engineOut.pillarScores).map(([pillar, score]) => (
                  <div key={pillar}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{pillar}</span>
                      <span className={`font-bold tabular-nums ${scoreColor(score)}`}>{score}%</span>
                    </div>
                    <Progress value={score} className="h-2" aria-label={pillar} />
                  </div>
                ))}
                {duration != null && (
                  <p className="text-sm text-muted-foreground pt-1">
                    ⏱ {t("timeComparison")}: {duration} min — {t("vsManual")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("remediationPlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {engineOut.remediationPlan.map((p) => (
                    <div key={p.code} className="flex items-start gap-3 rounded-lg border p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs font-bold" aria-hidden>
                        {p.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-semibold">{p.code}</code>
                          <span className="text-sm font-medium">{lang === "en" ? p.titleEn : p.titleAm}</span>
                          <SeverityBadge severity={p.severity} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {lang === "en" ? p.remediationEn : p.remediationAm}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {t("penalty")}: {p.penaltyRef} · {t("risk")}: {p.riskRank}
                        </p>
                      </div>
                    </div>
                  ))}
                  {engineOut.remediationPlan.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">✓ 47/47 — fully compliant</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => { setStep(1); setAnswers({}); setNotes({}); setEngineOut(null); setScanId(null); setScanName(""); }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> {t("navScans")}
            </Button>
            <Button onClick={() => scanId && onDone(scanId)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {t("navReport")} <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export for the findings page reuse
export type { ResultDTO };
export { Building2 };
