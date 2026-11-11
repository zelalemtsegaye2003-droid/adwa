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
import { Building2, ChevronLeft, ChevronRight, Play, CheckCircle2, AlertTriangle, FileCheck2, FolderLock, Trash2, CloudUpload, CloudCheck, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";
import { SeverityBadge, PillarBadge, ScoreRing, scoreColor, AnswerBadge, FrameworkBadge, type RuleDTO, type OrgDTO, type ResultDTO, type FrameworkDTO } from "./shared";

type Answer = "yes" | "partial" | "no" | "na";

// Rules Engine: per-rule evidence coverage (fetched once the scan org is known)
interface CoverageEvidenceDto {
  evidenceId: string;
  title: string;
  fileName: string;
  category: string;
  version: number;
  linkType: string;
  ageDays: number;
  fresh: boolean;
}
interface RuleCoverageDto {
  ruleCode: string;
  status: "SATISFIED" | "STALE" | "GAP";
  evidence: CoverageEvidenceDto[];
  suggestedAnswer: "yes" | null;
}
interface CoverageResponse {
  summary: { total: number; satisfied: number; stale: number; gap: number; coveragePercent: number };
  coverage: RuleCoverageDto[];
}

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

interface ScanDetailForResume {
  id: string;
  status: string;
  name: string;
  organizationId: string;
  frameworkId: string | null;
  results: { answer: string; answeredAt: string | null; evidenceNote: string | null; rule: { code: string } }[];
}

export function ScanWizard({
  preselectedOrgId, resumeScanId, onDone,
}: {
  preselectedOrgId?: string | null;
  resumeScanId?: string | null;
  onDone: (scanId: string) => void;
}) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(1);
  const [orgs, setOrgs] = useState<OrgDTO[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkDTO[]>([]);
  const [fwCode, setFwCode] = useState("PD-1321");
  // Keyed data: rules are valid only while data.key === fwCode (avoids sync setState in effect)
  const [rulesData, setRulesData] = useState<{ key: string; rules: RuleDTO[] } | null>(null);
  const [orgId, setOrgId] = useState(preselectedOrgId ?? "");
  const [scanName, setScanName] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [engineOut, setEngineOut] = useState<EngineOut | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<Map<string, RuleCoverageDto> | null>(null);
  const [coverageSummary, setCoverageSummary] = useState<CoverageResponse["summary"] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [discarding, setDiscarding] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  // Autosave plumbing: dirty rule codes + refs mirroring the latest answers/notes.
  const dirtyRef = useRef<Set<string>>(new Set());
  const answersRef = useRef(answers);
  const notesRef = useRef(notes);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanIdRef = useRef<string | null>(null);
  // Mirror the latest state into refs (read by the debounced autosave timer).
  // Effects — never render-time assignment — keep this lint-clean under
  // react-hooks/refs, and the 1.5s debounce makes the post-render update
  // timing irrelevant.
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { scanIdRef.current = scanId; }, [scanId]);

  useEffect(() => {
    api<{ organizations: OrgDTO[] }>("/api/organizations").then((d) => {
      setOrgs(d.organizations);
      if (preselectedOrgId) setOrgId(preselectedOrgId);
    }).catch(() => {});
    api<{ frameworks: FrameworkDTO[] }>("/api/frameworks").then((d) => {
      setFrameworks(d.frameworks);
      if (d.frameworks.length > 0 && !d.frameworks.some((f) => f.code === "PD-1321")) {
        setFwCode(d.frameworks[0].code);
      }
    }).catch(() => {});
  }, [preselectedOrgId]);

  useEffect(() => {
    let cancelled = false;
    api<{ rules: RuleDTO[] }>(`/api/rules?framework=${encodeURIComponent(fwCode)}`)
      .then((d) => { if (!cancelled) setRulesData({ key: fwCode, rules: d.rules }); })
      .catch(() => { if (!cancelled) setRulesData({ key: fwCode, rules: [] }); });
    return () => { cancelled = true; };
  }, [fwCode]);

  // ── Resume: load a saved in-progress assessment ─────────────────────────
  useEffect(() => {
    if (!resumeScanId) return;
    let cancelled = false;
    api<{ scan: ScanDetailForResume }>(`/api/scans/${resumeScanId}`)
      .then(({ scan }) => {
        if (cancelled || !scan) return;
        if (scan.status === "complete") {
          // Nothing to resume — straight to the report.
          onDone(scan.id);
          return;
        }
        setScanId(scan.id);
        setScanName(scan.name);
        setOrgId(scan.organizationId);
        // Restore EXPLICIT answers only — keyed on answeredAt so an
        // intentional N/A survives a resume (the pre-set "na" placeholder
        // for untouched rules does not).
        const restoredAnswers: Record<string, Answer> = {};
        const restoredNotes: Record<string, string> = {};
        for (const r of scan.results) {
          if (r.answeredAt && r.answer) restoredAnswers[r.rule.code] = r.answer as Answer;
          if (r.evidenceNote) restoredNotes[r.rule.code] = r.evidenceNote;
        }
        setAnswers(restoredAnswers);
        setNotes(restoredNotes);
        setStep(2);
        toast.success(t("resumedDraft"));
        // Coverage panel for the resumed org (framework inferred from scan rows).
        api<CoverageResponse>(`/api/rules/coverage?org=${scan.organizationId}`)
          .then((d) => {
            if (cancelled) return;
            setCoverage(new Map(d.coverage.map((c) => [c.ruleCode, c])));
            setCoverageSummary(d.summary);
          })
          .catch(() => {});
        topRef.current?.scrollIntoView({ behavior: "smooth" });
      })
      .catch(() => { if (!cancelled) toast.error(t("noData")); });
    return () => { cancelled = true; };
  }, [resumeScanId]);

  // ── Autosave: flush dirty answers 1.5s after the last edit ────────────────
  const flushDraft = async () => {
    const id = scanIdRef.current;
    // Only rules with an EXPLICIT answer are sent — an unanswered rule must
    // never be persisted as "na" (that would fake completeness).
    const dirty = [...dirtyRef.current].filter((code) => answersRef.current[code]);
    if (!id || dirty.length === 0) return;
    dirtyRef.current = new Set();
    setSaveState("saving");
    try {
      await api(`/api/scans/${id}/answers`, {
        method: "POST",
        body: JSON.stringify({
          answers: dirty.map((code) => ({
            ruleCode: code,
            answer: answersRef.current[code]!,
            evidenceNote: notesRef.current[code] || undefined,
          })),
        }),
      });
      setSaveState("saved");
    } catch {
      // Draft save is best-effort; the submit payload is the source of truth.
      setSaveState("idle");
    }
  };

  const markDirty = (code: string) => {
    if (!scanIdRef.current) return;
    dirtyRef.current.add(code);
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushDraft, 1500);
  };

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const rules = rulesData?.key === fwCode ? rulesData.rules : null;

  const activeFw = frameworks.find((f) => f.code === fwCode) ?? null;

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

  // ── Submit gating (D1 + D2): complete & justified, or no submit ───────────
  const unansweredRules = rules ? rules.filter((r) => !answers[r.code]) : [];
  const unjustifiedNa = rules
    ? rules.filter((r) => answers[r.code] === "na" && (notes[r.code] ?? "").trim().length < 5)
    : [];
  const canSubmit = !!rules && !!scanId && unansweredRules.length === 0 && unjustifiedNa.length === 0;

  /** Scroll the first problem obligation into view. */
  const jumpToFirstProblem = () => {
    const code = unansweredRules[0]?.code ?? unjustifiedNa[0]?.code;
    if (!code) return;
    document
      .querySelector(`[data-rule-code="${code}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const startScan = async () => {
    if (!orgId) { toast.error(t("step1")); return; }
    let scan: { id: string };
    try {
      const data = await api<{ scan: { id: string } }>("/api/scans", {
        method: "POST", body: JSON.stringify({ organizationId: orgId, frameworkCode: fwCode, name: scanName || undefined }),
      });
      scan = data.scan;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      return;
    }
    setScanId(scan.id);
    dirtyRef.current = new Set();
    setStep(2);
    // Fetch evidence coverage for the scanned org + framework (Rules Engine).
    api<CoverageResponse>(`/api/rules/coverage?org=${orgId}&framework=${encodeURIComponent(fwCode)}`)
      .then((d) => {
        setCoverage(new Map(d.coverage.map((c) => [c.ruleCode, c])));
        setCoverageSummary(d.summary);
      })
      .catch(() => setCoverage(new Map()));
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const runEngine = async () => {
    if (!scanId || !rules) return;
    // Defense in depth (the server enforces the same contract):
    // every obligation answered + every N/A justified.
    if (unansweredRules.length > 0 || unjustifiedNa.length > 0) {
      toast.error(
        unansweredRules.length > 0
          ? `${t("answerAllToSubmit")} — ${unansweredRules.length} ${t("remaining")}`
          : t("naNoteRequired")
      );
      jumpToFirstProblem();
      return;
    }
    setRunning(true);
    // Cancel any pending draft save — the submit payload is authoritative.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dirtyRef.current = new Set();
    // Explicit answers ONLY — never default an unanswered rule to "na".
    const payload = {
      answers: rules.map((r) => ({
        ruleCode: r.code,
        answer: answers[r.code]!,
        evidenceNote: notes[r.code]?.trim() || undefined,
      })),
    };
    try {
      const data = await api<{ engine: EngineOut; time?: { engineMinutes?: number } }>(`/api/scans/${scanId}/submit`, {
        method: "POST", body: JSON.stringify(payload),
      });
      setRunning(false);
      setEngineOut(data.engine);
      setDuration(data.time?.engineMinutes ?? null);
      setStep(3);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      toast.success(`${t("overallScore")}: ${data.engine.overallScore}%`);
    } catch (err) {
      setRunning(false);
      toast.error(err instanceof Error ? err.message : "Engine error");
    }
  };

  const setAnswer = (code: string, a: Answer) => {
    setAnswers((prev) => ({ ...prev, [code]: a }));
    markDirty(code);
  };

  // Rules Engine: attach an evidence reference to the note for one rule.
  const attachEvidence = (code: string, e: CoverageEvidenceDto) => {
    setNotes((prev) => {
      const ref = `Evidence: ${e.title} (v${e.version}, ${e.fileName}${e.fresh ? `, ${e.ageDays}d old` : `, STALE ${e.ageDays}d`})`;
      const current = prev[code] ?? "";
      if (current.includes(e.title)) return prev; // already referenced
      return { ...prev, [code]: current ? `${current} | ${ref}` : ref };
    });
    markDirty(code);
    toast.success(`${e.title} → ${code}`);
  };

  const setNote = (code: string, value: string) => {
    setNotes((prev) => ({ ...prev, [code]: value }));
    markDirty(code);
  };

  // Discard an in-progress draft assessment (DELETE /api/scans/[id]).
  const discardDraft = async () => {
    if (!scanId || discarding) return;
    if (!window.confirm(t("discardConfirm"))) return;
    setDiscarding(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dirtyRef.current = new Set();
    try {
      await api(`/api/scans/${scanId}`, { method: "DELETE" });
    } catch (err) {
      setDiscarding(false);
      toast.error(err instanceof Error ? err.message : "Error");
      return;
    }
    setDiscarding(false);
    setScanId(null);
    setAnswers({});
    setNotes({});
    setEngineOut(null);
    setCoverage(null);
    setCoverageSummary(null);
    setSaveState("idle");
    setStep(1);
    toast.success(t("discardScan") + " ✓");
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

      {/* Step 1: organization + framework */}
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
              <Label>{t("selectFramework")}</Label>
              <div className="grid gap-2" role="radiogroup" aria-label={t("selectFramework")}>
                {frameworks.map((f) => (
                  <button
                    key={f.code}
                    type="button"
                    role="radio"
                    aria-checked={fwCode === f.code}
                    onClick={() => setFwCode(f.code)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      fwCode === f.code
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        fwCode === f.code ? "border-emerald-600" : "border-muted-foreground/40"
                      }`}
                    >
                      {fwCode === f.code && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{lang === "en" ? f.name : f.nameAm}</span>
                        <FrameworkBadge code={f.code} />
                        <span className="text-xs text-muted-foreground">{f.instrumentNo}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {f.ruleCount} {t("obligations")} · {f.pillars.length} {t("allPillars").toLowerCase()}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scan-name">{t("scanName")}</Label>
              <Input
                id="scan-name"
                value={scanName}
                onChange={(e) => setScanName(e.target.value)}
                placeholder={`${activeFw?.name ?? "Compliance"} audit — ${activeFw?.ruleCount ?? rules?.length ?? ""} obligations`}
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
              {answeredCount}/{rules?.length ?? "…"} {t("answered")}
              {rules && unansweredRules.length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={jumpToFirstProblem}
                    className="font-medium text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-800 dark:text-amber-400"
                  >
                    {unansweredRules.length} {t("remaining")}
                  </button>
                </>
              )}
            </span>
            {scanId && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  saveState === "saving" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : saveState === "saved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {saveState === "saving"
                  ? <><CloudUpload className="h-3.5 w-3.5 animate-pulse" aria-hidden /> {t("autoSaving")}</>
                  : saveState === "saved"
                  ? <><CloudCheck className="h-3.5 w-3.5" aria-hidden /> {t("autoSaved")}</>
                  : <><CloudUpload className="h-3.5 w-3.5" aria-hidden /> {t("autoSaveOff")}</>}
              </span>
            )}
          </div>
          {coverageSummary && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <FolderLock className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
              <span className="font-medium">{t("evCoverage")}:</span>
              <span className="tabular-nums">{coverageSummary.satisfied}/{coverageSummary.total} {t("evSatisfiedShort")}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-600 dark:text-amber-400 tabular-nums">{coverageSummary.stale} {t("evStaleShort")}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-red-600 dark:text-red-400 tabular-nums">{coverageSummary.gap} {t("evGapShort")}</span>
            </div>
          )}
          <ScrollArea className="max-h-[calc(100vh-380px)] pr-3">
            <div className="space-y-6">
              {!rules && <Skeleton className="h-64 rounded-xl" />}
              {grouped.map(([subject, rs]) => (
                <div key={subject}>
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 sticky top-0 bg-background/95 backdrop-blur py-1.5 z-10 border-b">
                    {subject}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {rs.map((r) => {
                      const cov = coverage?.get(r.code) ?? null;
                      const naNeedsNote = answers[r.code] === "na" && (notes[r.code] ?? "").trim().length < 5;
                      return (
                      <Card
                        key={r.id}
                        data-rule-code={r.code}
                        className={answers[r.code] ? "border-emerald-200 dark:border-emerald-900" : ""}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-[240px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.code}</code>
                                <span className="font-medium text-sm">{lang === "en" ? r.titleEn : r.titleAm}</span>
                                <SeverityBadge severity={r.severity} />
                                {cov?.status === "SATISFIED" && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" title={t("evSatisfiedFull")}>
                                    ✓ {t("evEvidenceOnFile")}
                                  </span>
                                )}
                                {cov?.status === "STALE" && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300" title={t("evStaleFull")}>
                                    ⏱ {t("evStaleEvidence")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {lang === "en" ? r.questionEn : r.questionAm}
                              </p>
                              {cov && cov.evidence.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {cov.evidence.slice(0, 3).map((e) => (
                                    <button
                                      key={e.evidenceId}
                                      type="button"
                                      onClick={() => attachEvidence(r.code, e)}
                                      title={t("evAttachHint")}
                                      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/60 ${
                                        e.fresh
                                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                          : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                      }`}
                                    >
                                      <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden />
                                      <span className="truncate">{e.title}</span>
                                      <span className="shrink-0 opacity-70">v{e.version} · {e.fresh ? t("evFresh") : t("evStaleShort")} {e.ageDays}d</span>
                                    </button>
                                  ))}
                                  {cov.evidence.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground">+{cov.evidence.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {cov?.suggestedAnswer && !answers[r.code] && (
                              <button
                                type="button"
                                onClick={() => setAnswer(r.code, "yes")}
                                className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                title={t("evSuggestYesFull")}
                              >
                                ✓ {t("evSuggestYes")}
                              </button>
                            )}
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
                            className={`mt-2 text-sm${naNeedsNote ? " border-amber-400 focus-visible:ring-amber-400" : ""}`}
                            rows={1}
                            placeholder={answers[r.code] === "na" ? t("evidenceNoteNa") : t("evidenceNote")}
                            value={notes[r.code] ?? ""}
                            onChange={(e) => setNote(r.code, e.target.value)}
            aria-label={`${t("evidenceNote")} ${r.code}`}
                          />
                          {naNeedsNote && (
                            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400" role="alert">
                              ⚠ {t("naNoteRequired")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" aria-hidden /> {t("step1")}</Button>
              {scanId && (
                <Button
                  variant="outline"
                  onClick={discardDraft}
                  disabled={discarding || running}
                  className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:border-red-900 dark:hover:bg-red-950/50"
                >
                  {discarding ? <RotateCcw className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                  {t("discardScan")}
                </Button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button onClick={runEngine} disabled={running || !canSubmit} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {running ? <><AlertTriangle className="h-4 w-4 animate-pulse" aria-hidden /> {t("running")}</> : <><Play className="h-4 w-4" aria-hidden /> {t("runEngine")}</>}
              </Button>
              {rules && !canSubmit && (
                <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {unansweredRules.length > 0
                    ? `${t("answerAllToSubmit")} — ${unansweredRules.length} ${t("remaining")}`
                    : unjustifiedNa.length > 0
                      ? `${t("naNoteRequired")} (${unjustifiedNa.length})`
                      : ""}
                </span>
              )}
            </div>
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
                    <p className="text-sm text-muted-foreground py-8 text-center">✓ {rules?.length ?? 0}/{rules?.length ?? 0} — fully compliant</p>
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
