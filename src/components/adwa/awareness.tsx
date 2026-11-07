"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, School as SchoolIcon, Users, BookOpen, ClipboardCheck, ShieldCheck,
  Plus, Copy, ExternalLink, Download, RefreshCw, FileCheck2, Sigma, Lock, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { pickByLang } from "./shared";

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface GroupStatDTO {
  n: number; meanPre: number; meanPost: number; meanGain: number;
  sdGain: number; minGain: number; maxGain: number;
}
interface PairedTDTO {
  n: number; meanGain: number; sdGain: number; t: number; df: number; p: number; significant: boolean;
}
interface AnovaDTO {
  k: number; n: number; dfBetween: number; dfWithin: number;
  ssBetween: number; ssWithin: number; msBetween: number; msWithin: number;
  f: number; p: number; etaSquared: number; significant: boolean; groupMeans: Record<string, number>;
}

interface OverviewDTO {
  generatedAt: string;
  programme: {
    schools: number; classes: number; treatmentClasses: number; controlClasses: number;
    learners: number; consent: { granted: number; pending: number; denied: number };
    consentRate: number; modules: number; instrumentItems: number;
  };
  engagement: {
    lessonCompletions: number; treatmentLearners: number; completionsPerTreatmentLearner: number;
    preSittings: number; postSittings: number;
    modules: {
      id: string; code: string; sortOrder: number; topic: string; titleEn: string; titleAm: string;
      durationMin: number; questions: number; started: number; completed: number; avgQuizScore: number | null;
    }[];
  };
  rq2: {
    design: string;
    treatment: { stat: GroupStatDTO; pairedT: PairedTDTO | null };
    control: { stat: GroupStatDTO; pairedT: PairedTDTO | null };
    anova: AnovaDTO | null;
  };
  schools: {
    schoolId: string; schoolName: string; schoolNameAm: string; subCity: string;
    classes: {
      classId: string; className: string; grade: number; groupType: string; joinCode: string;
      learners: number; instrument: GroupStatDTO;
    }[];
  }[];
}

interface QuestionDTO {
  id: string; sortOrder: number;
  promptEn: string; promptAm: string;
  optionsEn: string[]; optionsAm: string[];
  answerIdx: number; explainEn: string | null; explainAm: string | null;
  isActive: boolean;
}
interface ModuleDTO {
  id: string; code: string; sortOrder: number; topic: string;
  titleEn: string; titleAm: string; summaryEn: string; summaryAm: string;
  contentEn: string; contentAm: string; durationMin: number; gradeBand: string;
  version: string; isActive: boolean;
  questions: QuestionDTO[];
}

interface ClassDTO {
  id: string; name: string; grade: number; groupType: string; joinCode: string;
  teacherName: string | null; isActive: boolean;
  learners: number; consent: { GRANTED: number; PENDING: number; DENIED: number };
}
interface SchoolDTO {
  id: string; name: string; nameAm: string; subCity: string;
  contactPerson: string | null; contactPhone: string | null; isActive: boolean;
  classes: ClassDTO[];
}
interface ConsentRowDTO {
  id: string; code: string; grade: number; consent: string;
  consentAt: string | null; consentRef: string | null;
  className: string; groupType: string; schoolName: string;
}

// ── Small presentational helpers ─────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  passwords: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  phishing: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  social_media: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  cyberbullying: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  personal_data: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  safe_browsing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  device_security: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  reporting: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

function TopicBadge({ topic }: { topic: string }) {
  return <Badge className={`${TOPIC_COLORS[topic] ?? "bg-muted text-muted-foreground"} border-0`}>{topic.replace(/_/g, " ")}</Badge>;
}

function GroupBadge({ group }: { group: string }) {
  return group === "TREATMENT" ? (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0">Treatment</Badge>
  ) : (
    <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0">Control</Badge>
  );
}

function ConsentBadge({ consent }: { consent: string }) {
  const map: Record<string, string> = {
    GRANTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    DENIED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  };
  const label: Record<string, string> = { GRANTED: "Granted", PENDING: "Pending", DENIED: "Denied" };
  return <Badge className={`${map[consent]} border-0`}>{label[consent]}</Badge>;
}

function fmtP(p: number): string {
  if (!isFinite(p)) return "—";
  if (p < 0.0001) return "<0.0001";
  return p.toFixed(4);
}

/** Horizontal score bar (pre / post / gain) in the RQ2 comparison. */
function StatBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">{Math.round(value * 10) / 10}</span>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export function AwarenessView() {
  const { t, lang, pick } = useI18n();
  const [overview, setOverview] = useState<OverviewDTO | null>(null);
  const [modules, setModules] = useState<ModuleDTO[] | null>(null);
  const [schools, setSchools] = useState<SchoolDTO[] | null>(null);
  const [consentRows, setConsentRows] = useState<ConsentRowDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, mods, sch, cons] = await Promise.all([
        api<OverviewDTO>("/api/awareness/overview"),
        api<{ modules: ModuleDTO[] }>("/api/awareness/modules"),
        api<{ schools: SchoolDTO[] }>("/api/awareness/schools"),
        api<{ learners: ConsentRowDTO[] }>("/api/awareness/consent"),
      ]);
      setOverview(ov);
      setModules(mods.modules);
      setSchools(sch.schools);
      setConsentRows(cons.learners);
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed to load awareness data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || !overview || !modules || !schools || consentRows === null) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const rq2 = overview.rq2;
  const p = overview.programme;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white"><GraduationCap className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("awTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("awSub")}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-1 h-4 w-4" /> {lang === "en" ? "Refresh" : "ተመለስ"}
          </Button>
          <Button size="sm" onClick={() => window.open("/learn", "_blank")}>
            <ExternalLink className="mr-1 h-4 w-4" /> {t("awOpenPortal")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">{t("awTabOverview")}</TabsTrigger>
          <TabsTrigger value="curriculum">{t("awTabCurriculum")}</TabsTrigger>
          <TabsTrigger value="schools">{t("awTabSchools")}</TabsTrigger>
          <TabsTrigger value="consent">{t("awTabConsent")}</TabsTrigger>
          <TabsTrigger value="evaluation">{t("awTabEvaluation")}</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard icon={<SchoolIcon className="h-4 w-4" />} label={t("awSchools")} value={String(p.schools)} sub={`${p.classes} ${t("awClasses").toLowerCase()}`} />
            <KpiCard icon={<Users className="h-4 w-4" />} label={t("awLearners")} value={String(p.learners)} sub={`${p.treatmentClasses}T / ${p.controlClasses}C`} />
            <KpiCard icon={<FileCheck2 className="h-4 w-4" />} label={t("awConsentRate")} value={`${p.consentRate}%`} sub={`${p.consent.granted} ${t("awConsentGranted").toLowerCase()}`} />
            <KpiCard icon={<BookOpen className="h-4 w-4" />} label={t("awModulesKpi")} value={String(p.modules)} sub={`${p.instrumentItems}-item instrument`} />
            <KpiCard icon={<ClipboardCheck className="h-4 w-4" />} label={t("awLessonCompletions")} value={String(overview.engagement.lessonCompletions)} sub={`${overview.engagement.completionsPerTreatmentLearner} ${t("awPerTreatmentLearner")}`} />
            <KpiCard icon={<Sigma className="h-4 w-4" />} label={t("awMeanGain")} value={`${rq2.treatment.stat.meanGain > rq2.control.stat.meanGain ? "+" : ""}${(rq2.treatment.stat.meanGain - rq2.control.stat.meanGain).toFixed(1)}`} sub="T − C" />
          </div>

          {/* RQ2 comparison + ANOVA verdict */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("awRq2Results")}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <p className="text-xs text-muted-foreground">{t("awRq2DesignText")}</p>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><GroupBadge group="TREATMENT" /><span className="text-xs text-muted-foreground">{t("awPaired", String(rq2.treatment.stat.n))}</span></div>
                    <StatBar label={t("awMeanPre")} value={rq2.treatment.stat.meanPre} max={100} tone="bg-slate-400" />
                    <StatBar label={t("awMeanPost")} value={rq2.treatment.stat.meanPost} max={100} tone="bg-emerald-600" />
                    <StatBar label={t("awMeanGain")} value={rq2.treatment.stat.meanGain} max={100} tone="bg-emerald-500" />
                    {rq2.treatment.pairedT && (
                      <p className="pt-1 text-[11px] text-muted-foreground">
                        {t("awPairedT")}: t({rq2.treatment.pairedT.df}) = {rq2.treatment.pairedT.t}, p = {fmtP(rq2.treatment.pairedT.p)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><GroupBadge group="CONTROL" /><span className="text-xs text-muted-foreground">{t("awPaired", String(rq2.control.stat.n))}</span></div>
                    <StatBar label={t("awMeanPre")} value={rq2.control.stat.meanPre} max={100} tone="bg-slate-400" />
                    <StatBar label={t("awMeanPost")} value={rq2.control.stat.meanPost} max={100} tone="bg-slate-600" />
                    <StatBar label={t("awMeanGain")} value={rq2.control.stat.meanGain} max={100} tone="bg-slate-500" />
                    {rq2.control.pairedT && (
                      <p className="pt-1 text-[11px] text-muted-foreground">
                        {t("awPairedT")}: t({rq2.control.pairedT.df}) = {rq2.control.pairedT.t}, p = {fmtP(rq2.control.pairedT.p)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={rq2.anova?.significant ? "border-emerald-300 dark:border-emerald-800" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("awAnovaTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {rq2.anova ? (
                  <>
                    <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium ${rq2.anova.significant ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"}`}>
                      {rq2.anova.significant ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {rq2.anova.significant ? t("awSignificant") : t("awNotSignificant")}
                    </div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><dt className="text-muted-foreground">F({rq2.anova.dfBetween},{rq2.anova.dfWithin})</dt><dd className="font-semibold tabular-nums">{rq2.anova.f}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">{t("awPValue")}</dt><dd className="font-semibold tabular-nums">{fmtP(rq2.anova.p)}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">{t("awEta")}</dt><dd className="font-semibold tabular-nums">{rq2.anova.etaSquared}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("awNotSignificant")}</p>
                )}
                <p className="rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground"><Lock className="mr-1 inline h-3 w-3" />{t("awPrivacyNote")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Engagement */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("awEngagement")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead><TableHead>{lang === "en" ? "Unit" : "ክፍል"}</TableHead>
                    <TableHead>{t("awTopic")}</TableHead><TableHead>{t("awQuestions").replace(/\{0\} ?/, "")}</TableHead>
                    <TableHead>{t("awCompleted", "")}</TableHead><TableHead>{t("awAvgQuiz", "").replace(/\s*\d*%?$/, "")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.engagement.modules.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="max-w-64 truncate font-medium">{pick(m.titleEn, m.titleAm)}</TableCell>
                      <TableCell><TopicBadge topic={m.topic} /></TableCell>
                      <TableCell className="tabular-nums">{m.questions}</TableCell>
                      <TableCell className="tabular-nums">{m.completed}</TableCell>
                      <TableCell className="tabular-nums">{m.avgQuizScore !== null ? `${m.avgQuizScore}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-school */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("awPerSchool")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("awSchools")}</TableHead><TableHead>{t("awSubCity")}</TableHead>
                    <TableHead>{t("awClasses")}</TableHead><TableHead>{t("awGrade")}</TableHead>
                    <TableHead>{t("awN")}</TableHead><TableHead>{t("awMeanPre")}</TableHead>
                    <TableHead>{t("awMeanPost")}</TableHead><TableHead>{t("awMeanGain")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.schools.flatMap((s) =>
                    s.classes.map((c, i) => (
                      <TableRow key={c.classId}>
                        {i === 0 ? (
                          <TableCell rowSpan={s.classes.length} className="font-medium">{pick(s.schoolName, s.schoolNameAm)}</TableCell>
                        ) : null}
                        {i === 0 ? <TableCell rowSpan={s.classes.length}>{s.subCity}</TableCell> : null}
                        <TableCell><div className="flex items-center gap-2"><GroupBadge group={c.groupType} /><span className="text-xs text-muted-foreground font-mono">{c.joinCode}</span></div></TableCell>
                        <TableCell className="tabular-nums">{c.grade}</TableCell>
                        <TableCell className="tabular-nums">{c.instrument.n}</TableCell>
                        <TableCell className="tabular-nums">{c.instrument.meanPre}</TableCell>
                        <TableCell className="tabular-nums">{c.instrument.meanPost}</TableCell>
                        <TableCell className={`tabular-nums font-semibold ${c.instrument.meanGain > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{c.instrument.meanGain}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Curriculum ───────────────────────────────────────────────── */}
        <TabsContent value="curriculum">
          <CurriculumTab modules={modules} onChanged={refresh} />
        </TabsContent>

        {/* ── Schools ──────────────────────────────────────────────────── */}
        <TabsContent value="schools">
          <SchoolsTab schools={schools} onChanged={refresh} />
        </TabsContent>

        {/* ── Consent register ─────────────────────────────────────────── */}
        <TabsContent value="consent">
          <ConsentTab rows={consentRows} schools={schools} onChanged={refresh} />
        </TabsContent>

        {/* ── Evaluation ───────────────────────────────────────────────── */}
        <TabsContent value="evaluation">
          <EvaluationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[11px] font-medium">{label}</span></div>
        <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Curriculum tab ───────────────────────────────────────────────────────────

const EMPTY_MODULE = {
  topic: "passwords", titleEn: "", titleAm: "", summaryEn: "", summaryAm: "",
  contentEn: "", contentAm: "", durationMin: 15, gradeBand: "7-10",
};

function CurriculumTab({ modules, onChanged }: { modules: ModuleDTO[]; onChanged: () => void }) {
  const { t, lang, pick } = useI18n();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleDTO | null>(null);
  const [form, setForm] = useState({ ...EMPTY_MODULE });
  const [qOpen, setQOpen] = useState(false);
  const [qModule, setQModule] = useState<ModuleDTO | null>(null);
  const [qForm, setQForm] = useState({ promptEn: "", promptAm: "", optionsEn: ["", "", "", ""], optionsAm: ["", "", "", ""], answerIdx: 0, explainEn: "", explainAm: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_MODULE }); setEditorOpen(true); };
  const openEdit = (m: ModuleDTO) => {
    setEditing(m);
    setForm({
      topic: m.topic, titleEn: m.titleEn, titleAm: m.titleAm, summaryEn: m.summaryEn, summaryAm: m.summaryAm,
      contentEn: m.contentEn, contentAm: m.contentAm, durationMin: m.durationMin, gradeBand: m.gradeBand,
    });
    setEditorOpen(true);
  };

  const saveModule = async () => {
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/awareness/modules/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success(`${editing.code} updated`);
      } else {
        await api("/api/awareness/modules", { method: "POST", body: JSON.stringify({ ...form, questions: [] }) });
        toast.success("Curriculum unit created");
      }
      setEditorOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (m: ModuleDTO) => {
    try {
      await api(`/api/awareness/modules/${m.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !m.isActive }) });
      toast.success(m.isActive ? `${m.code} archived` : `${m.code} restored`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Update failed");
    }
  };

  const addQuestion = async () => {
    if (!qModule) return;
    setBusy(true);
    try {
      await api(`/api/awareness/modules/${qModule.id}/questions`, {
        method: "POST",
        body: JSON.stringify({
          promptEn: qForm.promptEn, promptAm: qForm.promptAm,
          optionsEn: qForm.optionsEn, optionsAm: qForm.optionsAm, answerIdx: qForm.answerIdx,
          explainEn: qForm.explainEn || undefined, explainAm: qForm.explainAm || undefined,
        }),
      });
      toast.success("Question added");
      setQOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t("awAddModule")}</Button>
      </div>
      {modules.map((m) => (
        <Card key={m.id} className={!m.isActive ? "opacity-60" : ""}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{m.code}</span>
                  <TopicBadge topic={m.topic} />
                  <Badge variant="outline">{m.version ? `v${m.version}` : "v1"}</Badge>
                  {!m.isActive && <Badge variant="secondary">{t("awArchived")}</Badge>}
                  <span className="text-xs text-muted-foreground">{t("awDuration", String(m.durationMin))}</span>
                  <span className="text-xs text-muted-foreground">{t("awQuestions", String(m.questions.length))}</span>
                </div>
                <p className="mt-1.5 font-semibold">{pick(m.titleEn, m.titleAm)}</p>
                <p className="text-sm text-muted-foreground">{pick(m.summaryEn, m.summaryAm)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  {lang === "en" ? "Preview" : "ቅድመ እይታ"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(m)}>{t("awEditModule")}</Button>
                <Button variant="outline" size="sm" onClick={() => { setQModule(m); setQForm({ promptEn: "", promptAm: "", optionsEn: ["", "", "", ""], optionsAm: ["", "", "", ""], answerIdx: 0, explainEn: "", explainAm: "" }); setQOpen(true); }}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t("awAddQuestion")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void toggleArchive(m)}>{m.isActive ? t("awArchive") : t("awRestore")}</Button>
              </div>
            </div>

            {expanded === m.id && (
              <div className="mt-4 grid gap-4 rounded-lg bg-muted/40 p-4 md:grid-cols-2">
                <LessonContent content={m.contentEn} />
                <LessonContent content={m.contentAm} amharic />
                {m.questions.length > 0 && (
                  <div className="md:col-span-2 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{t("awQuestions", String(m.questions.length))}</p>
                    {m.questions.map((q) => (
                      <div key={q.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{pick(q.promptEn, q.promptAm)}</p>
                          <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{pick(q.optionsEn[q.answerIdx], q.optionsAm[q.answerIdx])}</Badge>
                        </div>
                        <ul className="mt-1.5 grid gap-1 md:grid-cols-2">
                          {(lang === "en" ? q.optionsEn : q.optionsAm).map((o, i) => (
                            <li key={i} className={`rounded px-2 py-1 text-xs ${i === q.answerIdx ? "bg-emerald-100 font-medium dark:bg-emerald-950" : "bg-muted"}`}>{String.fromCharCode(65 + i)}. {o}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Module editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `${t("awEditModule")} — ${editing.code}` : t("awAddModule")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("awTopic")}</Label>
              <Select value={form.topic} onValueChange={(v) => setForm({ ...form, topic: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["passwords", "phishing", "social_media", "cyberbullying", "personal_data", "safe_browsing", "device_security", "reporting"].map((tp) => (
                    <SelectItem key={tp} value={tp}>{tp.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === "en" ? "Duration (min)" : "ቆይታ (ደቂቃ)"}</Label>
                <Input type="number" min={5} max={90} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) || 15 })} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "en" ? "Grade band" : "ክፍል ክልል"}</Label>
                <Input value={form.gradeBand} onChange={(e) => setForm({ ...form, gradeBand: e.target.value })} />
              </div>
            </div>
            <ModuleField label="Title (EN)" value={form.titleEn} onChange={(v) => setForm({ ...form, titleEn: v })} />
            <ModuleField label="ርዕስ (አማርኛ)" value={form.titleAm} onChange={(v) => setForm({ ...form, titleAm: v })} />
            <ModuleField label="Summary (EN)" value={form.summaryEn} onChange={(v) => setForm({ ...form, summaryEn: v })} />
            <ModuleField label="ማጠቃለያ (አማርኛ)" value={form.summaryAm} onChange={(v) => setForm({ ...form, summaryAm: v })} />
            <div className="space-y-1.5 md:col-span-2">
              <Label>Lesson content (EN) — “## ” starts a section</Label>
              <Textarea rows={7} value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>የትምህርት ይዘት (አማርኛ) — “## ” ክፍል ይጀምራል</Label>
              <Textarea rows={7} value={form.contentAm} onChange={(e) => setForm({ ...form, contentAm: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{lang === "en" ? "Cancel" : "ሰርዝ"}</Button>
            <Button disabled={busy} onClick={() => void saveModule()}>{lang === "en" ? "Save" : "አስቀምጥ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question editor */}
      <Dialog open={qOpen} onOpenChange={setQOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("awAddQuestion")} — {qModule?.code}</DialogTitle>
            <DialogDescription>{lang === "en" ? "Four options, bilingual. The answer key never leaves the server." : "አራት ምርጫዎች፣ ባለሁለት ቋንቋ። መልሱ ከሰርቨሩ አይወጣም።"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <ModuleField label="Prompt (EN)" value={qForm.promptEn} onChange={(v) => setQForm({ ...qForm, promptEn: v })} />
            <ModuleField label="ጥያቄ (አማርኛ)" value={qForm.promptAm} onChange={(v) => setQForm({ ...qForm, promptAm: v })} />
            <div className="grid gap-2 md:grid-cols-2">
              {qForm.optionsEn.map((_, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border p-2">
                  <Label className="text-xs">{String.fromCharCode(65 + i)}{i === qForm.answerIdx ? " ✓" : ""}</Label>
                  <Input placeholder="Option (EN)" value={qForm.optionsEn[i]} onChange={(e) => { const o = [...qForm.optionsEn]; o[i] = e.target.value; setQForm({ ...qForm, optionsEn: o }); }} />
                  <Input placeholder="ምርጫ (አማርኛ)" value={qForm.optionsAm[i]} onChange={(e) => { const o = [...qForm.optionsAm]; o[i] = e.target.value; setQForm({ ...qForm, optionsAm: o }); }} />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>{t("awCorrectOption")}</Label>
              <Select value={String(qForm.answerIdx)} onValueChange={(v) => setQForm({ ...qForm, answerIdx: Number(v) })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(i)}>{String.fromCharCode(65 + i)} — {qForm.optionsEn[i] || "…"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ModuleField label="Explanation (EN)" value={qForm.explainEn} onChange={(v) => setQForm({ ...qForm, explainEn: v })} />
            <ModuleField label="ማብራሪያ (አማርኛ)" value={qForm.explainAm} onChange={(v) => setQForm({ ...qForm, explainAm: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQOpen(false)}>{lang === "en" ? "Cancel" : "ሰርዝ"}</Button>
            <Button disabled={busy} onClick={() => void addQuestion()}>{lang === "en" ? "Add" : "ጨምር"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Renders the “## section” + paragraph mini-markdown of a lesson. */
function LessonContent({ content, amharic = false }: { content: string; amharic?: boolean }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.startsWith("## ") ? (
          <p key={i} className="font-semibold text-foreground">{b.slice(3)}</p>
        ) : (
          <p key={i} className="text-muted-foreground" lang={amharic ? "am" : "en"}>{b}</p>
        )
      )}
    </div>
  );
}

// ── Schools tab ──────────────────────────────────────────────────────────────

function SchoolsTab({ schools, onChanged }: { schools: SchoolDTO[]; onChanged: () => void }) {
  const { t, lang, pick } = useI18n();
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [classOpen, setClassOpen] = useState<SchoolDTO | null>(null);
  const [codesOpen, setCodesOpen] = useState<ClassDTO | null>(null);
  const [issuedCodes, setIssuedCodes] = useState<string[]>([]);
  const [schoolForm, setSchoolForm] = useState({ name: "", nameAm: "", subCity: "", contactPerson: "", contactPhone: "" });
  const [classForm, setClassForm] = useState({ name: "", grade: 9, groupType: "TREATMENT", teacherName: "" });
  const [codeCount, setCodeCount] = useState(30);
  const [busy, setBusy] = useState(false);

  const addSchool = async () => {
    setBusy(true);
    try {
      await api("/api/awareness/schools", { method: "POST", body: JSON.stringify(schoolForm) });
      toast.success(`${schoolForm.name} onboarded`);
      setSchoolOpen(false);
      setSchoolForm({ name: "", nameAm: "", subCity: "", contactPerson: "", contactPhone: "" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const addClass = async () => {
    if (!classOpen) return;
    setBusy(true);
    try {
      const r = await api<{ class: { joinCode: string; name: string } }>("/api/awareness/classes", {
        method: "POST",
        body: JSON.stringify({ schoolId: classOpen.id, ...classForm }),
      });
      toast.success(`${r.class.name} — join code ${r.class.joinCode}`);
      setClassOpen(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const issueCodes = async () => {
    if (!codesOpen) return;
    setBusy(true);
    try {
      const r = await api<{ issued: number; codes: string[] }>(`/api/awareness/classes/${codesOpen.id}/learners`, {
        method: "POST",
        body: JSON.stringify({ count: codeCount }),
      });
      setIssuedCodes(r.codes);
      toast.success(t("awCodesIssued", String(r.issued)));
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => {
    void navigator.clipboard.writeText(issuedCodes.join("\n"));
    toast.success(lang === "en" ? "Codes copied" : "ኮዶቹ ተቀድተዋል");
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSchoolOpen(true)}><Plus className="mr-1 h-4 w-4" /> {t("awAddSchool")}</Button>
      </div>
      {schools.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <SchoolIcon className="h-4 w-4 text-emerald-700" />
                  <p className="font-semibold">{pick(s.name, s.nameAm)}</p>
                  <Badge variant="outline">{s.subCity}</Badge>
                </div>
                {(s.contactPerson || s.contactPhone) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{[s.contactPerson, s.contactPhone].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => { setClassOpen(s); setClassForm({ name: "", grade: 9, groupType: "TREATMENT", teacherName: "" }); }}>
                <Plus className="mr-1 h-3.5 w-3.5" /> {t("awAddClass")}
              </Button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {s.classes.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GroupBadge group={c.groupType} />
                      <p className="text-sm font-medium">{c.name}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setCodesOpen(c); setIssuedCodes([]); setCodeCount(30); }}>
                      <Users className="mr-1 h-3.5 w-3.5" /> {t("awIssueCodes")}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{t("awJoinCode")}: <span className="font-semibold text-foreground">{c.joinCode}</span></span>
                    <span>{t("awLearners")}: <span className="font-semibold text-foreground">{c.learners}</span></span>
                    <span>{t("awConsentGranted").slice(0, 1) + t("awConsentGranted").slice(1).toLowerCase()}: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.consent.GRANTED}</span> · {c.consent.PENDING} {t("awConsentPending").toLowerCase()} · {c.consent.DENIED} {t("awConsentDenied").toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add school */}
      <Dialog open={schoolOpen} onOpenChange={setSchoolOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("awAddSchool")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <TextField label="Name (EN)" value={schoolForm.name} onChange={(v) => setSchoolForm({ ...schoolForm, name: v })} />
            <TextField label="ስም (አማርኛ)" value={schoolForm.nameAm} onChange={(v) => setSchoolForm({ ...schoolForm, nameAm: v })} />
            <TextField label={t("awSubCity")} value={schoolForm.subCity} onChange={(v) => setSchoolForm({ ...schoolForm, subCity: v })} />
            <TextField label={lang === "en" ? "Contact person" : "መገናኛ ሰው"} value={schoolForm.contactPerson} onChange={(v) => setSchoolForm({ ...schoolForm, contactPerson: v })} />
            <TextField label={lang === "en" ? "Contact phone" : "ስልክ"} value={schoolForm.contactPhone} onChange={(v) => setSchoolForm({ ...schoolForm, contactPhone: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchoolOpen(false)}>{lang === "en" ? "Cancel" : "ሰርዝ"}</Button>
            <Button disabled={busy} onClick={() => void addSchool()}>{lang === "en" ? "Create" : "ፍጠር"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add class */}
      <Dialog open={!!classOpen} onOpenChange={(o) => !o && setClassOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("awAddClass")} — {classOpen && pick(classOpen.name, classOpen.nameAm)}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <TextField label={lang === "en" ? "Class name" : "የክፍል ስም"} value={classForm.name} onChange={(v) => setClassForm({ ...classForm, name: v })} placeholder="Grade 9 — Section A" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("awGrade")}</Label>
                <Input type="number" min={1} max={12} value={classForm.grade} onChange={(e) => setClassForm({ ...classForm, grade: Number(e.target.value) || 9 })} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "en" ? "Group (RQ2)" : "ቡድን (RQ2)"}</Label>
                <Select value={classForm.groupType} onValueChange={(v) => setClassForm({ ...classForm, groupType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TREATMENT">{t("awTreatment")}</SelectItem>
                    <SelectItem value="CONTROL">{t("awControl")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TextField label={lang === "en" ? "Teacher" : "መምህር"} value={classForm.teacherName} onChange={(v) => setClassForm({ ...classForm, teacherName: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassOpen(null)}>{lang === "en" ? "Cancel" : "ሰርዝ"}</Button>
            <Button disabled={busy} onClick={() => void addClass()}>{lang === "en" ? "Create" : "ፍጠር"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue codes */}
      <Dialog open={!!codesOpen} onOpenChange={(o) => !o && setCodesOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("awIssueCodes")} — {codesOpen?.name}</DialogTitle>
            <DialogDescription>{t("awPrivacyNote")}</DialogDescription>
          </DialogHeader>
          {issuedCodes.length === 0 ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{lang === "en" ? "How many participant codes?" : "ስንት የተሳታፊ ኮዶች?"}</Label>
                <Input type="number" min={1} max={60} value={codeCount} onChange={(e) => setCodeCount(Number(e.target.value) || 30)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="max-h-56 overflow-y-auto rounded-lg bg-muted/50 p-3">
                <div className="grid grid-cols-3 gap-1 font-mono text-xs">
                  {issuedCodes.map((c) => <span key={c}>{c}</span>)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={copyCodes}><Copy className="mr-1 h-3.5 w-3.5" /> {lang === "en" ? "Copy all" : "ሁሉንም ቅዳ"}</Button>
            </div>
          )}
          <DialogFooter>
            {issuedCodes.length === 0 && <Button disabled={busy} onClick={() => void issueCodes()}>{lang === "en" ? "Issue" : "ስጥ"}</Button>}
            <Button variant="outline" onClick={() => setCodesOpen(null)}>{lang === "en" ? "Close" : "ዝጋ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ── Consent tab ──────────────────────────────────────────────────────────────

function ConsentTab({ rows, schools, onChanged }: { rows: ConsentRowDTO[]; schools: SchoolDTO[]; onChanged: () => void }) {
  const { t, lang, pick } = useI18n();
  const [schoolFilter, setSchoolFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialog, setDialog] = useState<ConsentRowDTO | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => rows.filter((r) => (schoolFilter === "ALL" || r.schoolName === schoolFilter) && (statusFilter === "ALL" || r.consent === statusFilter)),
    [rows, schoolFilter, statusFilter]
  );

  const record = async (decision: "GRANTED" | "DENIED") => {
    if (!dialog) return;
    setBusy(true);
    try {
      await api("/api/awareness/consent", {
        method: "POST",
        body: JSON.stringify({ learnerId: dialog.id, decision, consentRef: ref || undefined }),
      });
      toast.success(`${dialog.code}: ${decision === "GRANTED" ? t("awConsentGranted") : t("awConsentDenied")}`);
      setDialog(null);
      setRef("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Record failed");
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(
    () => ({
      GRANTED: rows.filter((r) => r.consent === "GRANTED").length,
      PENDING: rows.filter((r) => r.consent === "PENDING").length,
      DENIED: rows.filter((r) => r.consent === "DENIED").length,
    }),
    [rows]
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <p className="flex-1 text-xs text-muted-foreground">{t("awPrivacyNote")}</p>
          <div className="flex items-center gap-2 text-xs">
            <ConsentBadge consent="GRANTED" /> {counts.GRANTED}
            <ConsentBadge consent="PENDING" /> {counts.PENDING}
            <ConsentBadge consent="DENIED" /> {counts.DENIED}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{lang === "en" ? "All schools" : "ሁሉም ትምህርት ቤቶች"}</SelectItem>
            {schools.map((s) => <SelectItem key={s.id} value={s.name}>{pick(s.name, s.nameAm)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{lang === "en" ? "All states" : "ሁሉም ሁኔታዎች"}</SelectItem>
            <SelectItem value="PENDING">{t("awConsentPending")}</SelectItem>
            <SelectItem value="GRANTED">{t("awConsentGranted")}</SelectItem>
            <SelectItem value="DENIED">{t("awConsentDenied")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "en" ? "Participant code" : "የተሳታፊ ኮድ"}</TableHead>
                <TableHead>{t("awSchools")}</TableHead>
                <TableHead>{t("awClasses")}</TableHead>
                <TableHead>{t("awConsentRate").split(" ")[0]}</TableHead>
                <TableHead>{t("awConsentRef")}</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell>
                  <TableCell className="max-w-52 truncate">{r.schoolName}</TableCell>
                  <TableCell className="text-xs">{r.className} <GroupBadge group={r.groupType} /></TableCell>
                  <TableCell><ConsentBadge consent={r.consent} /></TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{r.consentRef ?? "—"}</TableCell>
                  <TableCell>
                    {r.consent !== "GRANTED" && (
                      <Button variant="outline" size="sm" onClick={() => { setDialog(r); setRef(r.consentRef ?? ""); }}>
                        {t("awRecordConsent")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("awRecordConsent")} — {dialog?.code}</DialogTitle>
            <DialogDescription>{dialog?.schoolName} · {dialog?.className}</DialogDescription>
          </DialogHeader>
          <TextField label={t("awConsentRef")} value={ref} onChange={setRef} placeholder="FORM-…" />
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void record("DENIED")}>{t("awDeny")}</Button>
            <Button disabled={busy} onClick={() => void record("GRANTED")} className="bg-emerald-700 hover:bg-emerald-800">{t("awGrant")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Evaluation tab ───────────────────────────────────────────────────────────

function EvaluationTab() {
  const { t, lang } = useI18n();
  const [evalData, setEvalData] = useState<{
    instrument: { items: number };
    n: { consented: number; withBoth: number; treatmentPaired: number; controlPaired: number };
    treatment: { histogram: { label: string; count: number }[] };
    control: { histogram: { label: string; count: number }[] };
    anova: AnovaDTO | null;
    perSchool: { school: string; n: number; cells: Record<string, GroupStatDTO | null> }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await api<typeof evalData>("/api/awareness/evaluation");
        if (alive) setEvalData(r);
      } catch (e) {
        toast.error(e instanceof ApiCallError ? e.message : "Failed to load evaluation");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading || !evalData) return <Skeleton className="h-64" />;

  const maxHist = Math.max(1, ...evalData.treatment.histogram.map((h) => h.count), ...evalData.control.histogram.map((h) => h.count));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">{t("awInstrument")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("awInstrumentText", String(evalData.instrument.items))}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("awPaired", String(evalData.n.withBoth))} · T {evalData.n.treatmentPaired} / C {evalData.n.controlPaired}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/awareness/evaluation?format=csv", "_blank")}>
            <Download className="mr-1 h-4 w-4" /> {t("awExportCsv")}
          </Button>
        </CardContent>
      </Card>

      {/* Gain histograms */}
      <div className="grid gap-4 md:grid-cols-2">
        {(["treatment", "control"] as const).map((g) => (
          <Card key={g}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GroupBadge group={g.toUpperCase()} /> {t("awGainHistogram", g === "treatment" ? t("awTreatment") : t("awControl"))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-1">
                {evalData[g].histogram.map((h) => (
                  <div key={h.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${g === "treatment" ? "bg-emerald-600/80" : "bg-slate-500/80"}`}
                      style={{ height: `${(h.count / maxHist) * 100}%`, minHeight: h.count > 0 ? "4px" : "0" }}
                      title={`${h.label}: ${h.count}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{h.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ANOVA table */}
      {evalData.anova && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("awAnovaTitle")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === "en" ? "Source" : "ምንጭ"}</TableHead><TableHead>SS</TableHead><TableHead>df</TableHead><TableHead>MS</TableHead><TableHead>F</TableHead><TableHead>{t("awPValue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{lang === "en" ? "Between groups" : "በቡድኖች መካከል"}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.ssBetween}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.dfBetween}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.msBetween}</TableCell>
                  <TableCell className="tabular-nums font-semibold">{evalData.anova.f}</TableCell>
                  <TableCell className="tabular-nums font-semibold">{fmtP(evalData.anova.p)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{lang === "en" ? "Within groups (error)" : "በቡድን ውስጥ (ስህተት)"}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.ssWithin}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.dfWithin}</TableCell>
                  <TableCell className="tabular-nums">{evalData.anova.msWithin}</TableCell>
                  <TableCell colSpan={2}>{evalData.anova.significant ? t("awSignificant") : t("awNotSignificant")} · η² = {evalData.anova.etaSquared}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Per-school stats */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("awPerSchool")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("awSchools")}</TableHead><TableHead>{t("awN")}</TableHead>
                <TableHead>{t("awTreatment")} — {t("awMeanGain")}</TableHead><TableHead>{t("awSd")}</TableHead>
                <TableHead>{t("awControl")} — {t("awMeanGain")}</TableHead><TableHead>{t("awSd")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evalData.perSchool.map((s) => (
                <TableRow key={s.school}>
                  <TableCell className="max-w-52 truncate font-medium">{s.school}</TableCell>
                  <TableCell className="tabular-nums">{s.n}</TableCell>
                  <TableCell className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{s.cells.TREATMENT?.meanGain ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{s.cells.TREATMENT?.sdGain ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{s.cells.CONTROL?.meanGain ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{s.cells.CONTROL?.sdGain ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
