"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, Languages, LogOut, GraduationCap, BookOpen, ClipboardList,
  CheckCircle2, Lock, ArrowLeft, Award, Clock, Sparkles,
} from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { LearnToolsGrid, LearnToolRunner } from "@/components/adwa/learn-tools";
import { AUDIENCE_LABELS, type Audience, type ToolId } from "@/lib/awareness/awareness-tools";

// ── DTOs (mirror the /api/learn contracts) ──────────────────────────────────

interface LearnModuleBrief {
  id: string; code: string; sortOrder: number; topic: string;
  titleEn: string; titleAm: string; summaryEn: string; summaryAm: string;
  durationMin: number; audience: string; questions: number;
}
interface PublicQuestion {
  id: string; moduleCode: string; sortOrder: number;
  promptEn: string; promptAm: string; optionsEn: string[]; optionsAm: string[];
}
interface QuizDetail {
  question: PublicQuestion;
  picked: number; correct: boolean; answerIdx: number;
  explainEn: string | null; explainAm: string | null;
}
interface ModuleDetail {
  module: {
    id: string; code: string; titleEn: string; titleAm: string;
    contentEn: string; contentAm: string; durationMin: number;
    questions: PublicQuestion[];
  };
}
interface LearnerStatus {
  learner: {
    code: string; grade: number; consent: string;
    className: string; schoolName: string; schoolNameAm: string;
  };
  assessments: {
    pre: { score: number; correct: number; total: number } | null;
    post: { score: number; correct: number; total: number } | null;
  };
  progress: { moduleId: string; status: string; quizScore: number | null }[];
}

type Step = "join" | "code" | "gate" | "hub" | "lesson" | "test" | "testResult" | "tools" | "tool";
type TestKind = "PRE" | "POST";

const STORE_KEY = "adwa-learn-session";

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as T;
  return { ok: r.ok, data };
}

// ── App ──────────────────────────────────────────────────────────────────────

function LearnApp() {
  const { t, lang, setLang, pick } = useI18n();
  const [step, setStep] = useState<Step>("join");
  const [joinCode, setJoinCode] = useState("");
  const [learnerCode, setLearnerCode] = useState("");
  const [classInfo, setClassInfo] = useState<LearnerStatus["learner"] | null>(null);
  const [modules, setModules] = useState<LearnModuleBrief[]>([]);
  const [status, setStatus] = useState<LearnerStatus | null>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [testKind, setTestKind] = useState<TestKind>("PRE");
  const [testResult, setTestResult] = useState<{
    assessment: { kind: string; score: number; correct: number; total: number; gain: number | null };
    detail: QuizDetail[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<"ALL" | Audience>("ALL");

  // Amharic-first: default the portal to Amharic when no preference is stored.
  useEffect(() => {
    try {
      if (!localStorage.getItem("adwa-lang")) setLang("am");
    } catch {}
  }, []);

  const identify = useCallback(async (jc: string, lc: string, restoring = false) => {
    setBusy(true);
    try {
      const { ok, data } = await post<{ learner?: LearnerStatus["learner"]; error?: { message: string } & Record<string, unknown> }>("/api/learn/learner", { joinCode: jc, learnerCode: lc });
      if (!ok || !data.learner) {
        if (restoring) {
          sessionStorage.removeItem(STORE_KEY);
          return;
        }
        setError((data as { error?: { message?: string } })?.error?.message ?? "Code not recognised.");
        return;
      }
      const st = data as unknown as LearnerStatus;
      setStatus(st);
      setClassInfo(st.learner);
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({ joinCode: jc, learnerCode: lc }));
      } catch {}
      setStep(st.learner.consent === "GRANTED" ? "hub" : "gate");
      setError("");
    } catch {
      if (!restoring) setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Restore an in-flight session after a refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { joinCode: string; learnerCode: string };
      if (s.joinCode && s.learnerCode) {
        setJoinCode(s.joinCode);
        setLearnerCode(s.learnerCode);
        void identify(s.joinCode, s.learnerCode, true);
      }
    } catch {}
  }, []);

  const doJoin = async () => {
    setBusy(true);
    setError("");
    try {
      const { ok, data } = await post<{ class?: LearnerStatus["learner"]; modules?: LearnModuleBrief[]; error?: { message: string } }>("/api/learn/join", { joinCode });
      if (!ok || !data.class) {
        setError(data?.error?.message ?? "Could not join.");
        return;
      }
      setClassInfo(data.class);
      setModules(data.modules ?? []);
      setStep("code");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const exit = () => {
    sessionStorage.removeItem(STORE_KEY);
    setStep("join");
    setJoinCode("");
    setLearnerCode("");
    setStatus(null);
    setClassInfo(null);
    setTestResult(null);
  };

  const refreshStatus = async () => {
    const { ok, data } = await post<LearnerStatus>("/api/learn/learner", { joinCode, learnerCode });
    if (ok && data.learner) setStatus(data);
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/40">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold leading-tight">{t("learnTitle")}</p>
              <p className="text-[11px] text-muted-foreground">{t("learnSub")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "am" : "en")} aria-label="language toggle">
              <Languages className="mr-1 h-4 w-4" /> {lang === "en" ? "አማርኛ" : "English"}
            </Button>
            {status && (
              <Button variant="ghost" size="sm" onClick={exit} aria-label="exit">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {step === "join" && (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="space-y-1 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-emerald-700" />
              <h1 className="text-lg font-bold">{t("learnJoinTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("learnJoinHint")}</p>
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinCode && void doJoin()}
              placeholder="ADWA-XXXX-XXXX"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-wider outline-none focus:ring-2 focus:ring-emerald-600"
              aria-label="class code"
            />
            {error && <p className="text-center text-sm text-rose-600">{error}</p>}
            <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy || !joinCode} onClick={() => void doJoin()}>
              {t("learnJoinBtn")}
            </Button>
          </div>
        )}

        {step === "join" && (
          <div className="mx-auto mt-4 max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"><Sparkles className="h-4 w-4" /></span>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">{t("learnToolsDoor")}</p>
                <p className="text-xs text-muted-foreground">{t("learnToolsDoorHint")}</p>
                <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300" onClick={() => setStep("tools")}>
                  {t("learnToolsOpen")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "code" && (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="space-y-1 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-emerald-700" />
              <h1 className="text-lg font-bold">{t("learnCodeTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("learnCodeHint")}</p>
            </div>
            <input
              value={learnerCode}
              onChange={(e) => setLearnerCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && learnerCode && void identify(joinCode, learnerCode)}
              placeholder="AW-XXXXXX"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-wider outline-none focus:ring-2 focus:ring-emerald-600"
              aria-label="participant code"
            />
            {error && <p className="text-center text-sm text-rose-600">{error}</p>}
            <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy || !learnerCode} onClick={() => void identify(joinCode, learnerCode)}>
              {t("learnJoinBtn")}
            </Button>
            <button className="w-full text-xs text-muted-foreground underline" onClick={() => setStep("join")}>
              <ArrowLeft className="mr-1 inline h-3 w-3" />{classInfo ? `${classInfo.className}` : ""}
            </button>
          </div>
        )}

        {step === "gate" && status && (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${status.learner.consent === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold">
              {status.learner.consent === "PENDING" ? t("learnConsentPending") : t("learnConsentDenied")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {status.learner.consent === "PENDING" ? t("learnConsentPendingText") : t("learnConsentDeniedText")}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{status.learner.code}</p>
            <Button variant="outline" className="w-full" onClick={() => void identify(joinCode, learnerCode)}>
              {lang === "en" ? "Check again" : "እንደገና ይመልከቱ"}
            </Button>
          </div>
        )}

        {step === "hub" && status && classInfo && (
          <HubStep
            modules={modules}
            status={status}
            lang={lang}
            t={t}
            pick={pick}
            audienceFilter={audienceFilter}
            setAudienceFilter={setAudienceFilter}
            onOpenTools={() => setStep("tools")}
            onOpenLesson={(id) => { setOpenModuleId(id); setStep("lesson"); }}
            onTakeTest={(kind) => { setTestKind(kind); setStep("test"); }}
          />
        )}

        {step === "lesson" && openModuleId && status && (
          <LessonStep
            moduleId={openModuleId}
            joinCode={joinCode}
            learnerCode={learnerCode}
            lang={lang}
            t={t}
            pick={pick}
            onDone={async () => { await refreshStatus(); setStep("hub"); }}
            onBack={async () => { await refreshStatus(); setStep("hub"); }}
          />
        )}

        {step === "test" && status && (
          <TestStep
            kind={testKind}
            joinCode={joinCode}
            learnerCode={learnerCode}
            lang={lang}
            t={t}
            pick={pick}
            onDone={async (result) => {
              setTestResult(result);
              await refreshStatus();
              setStep("testResult");
            }}
            onBack={() => setStep("hub")}
          />
        )}

        {step === "testResult" && testResult && status && (
          <TestResultStep
            result={testResult}
            preScore={status.assessments.pre?.score ?? null}
            lang={lang}
            t={t}
            pick={pick}
            onBack={async () => { setTestResult(null); setStep("hub"); }}
          />
        )}

        {step === "tools" && (
          <LearnToolsGrid
            lang={lang}
            pick={pick}
            onOpen={(id) => { setActiveTool(id); setStep("tool"); }}
            onBack={status ? undefined : () => setStep("join")}
            backLabel={t("learnExit")}
            hubLabel={t("learnBackToHub")}
            onHub={() => setStep("hub")}
          />
        )}

        {step === "tool" && activeTool && (
          <LearnToolRunner
            toolId={activeTool}
            lang={lang}
            pick={pick}
            onBack={() => setStep("tools")}
            backLabel={t("learnBackToTools")}
          />
        )}
      </main>

      <footer className="border-t py-4 text-center text-[11px] text-muted-foreground">
        {t("learnTitle")} · {lang === "en" ? "An Adwa Cyber public-interest programme (Phase 3, Track B)" : "የአድዋ ሳይበር የሕዝብ ጥቅም ተልዕኮ (ዙር 3፣ መስመር B)"}
      </footer>
    </div>
  );
}

// ── Hub (lesson list + tests) ────────────────────────────────────────────────

function HubStep({
  modules, status, lang, t, pick, audienceFilter, setAudienceFilter, onOpenTools, onOpenLesson, onTakeTest,
}: {
  modules: LearnModuleBrief[];
  status: LearnerStatus;
  lang: string;
  t: (k: string, ...a: string[]) => string;
  pick: (en: string, am: string) => string;
  audienceFilter: "ALL" | Audience;
  setAudienceFilter: (f: "ALL" | Audience) => void;
  onOpenTools: () => void;
  onOpenLesson: (id: string) => void;
  onTakeTest: (kind: TestKind) => void;
}) {
  const progressOf = (id: string) => status.progress.find((p) => p.moduleId === id);
  // The pilot class curriculum is the CyberSafe Kids programme (8 units) —
  // the same curriculum the RQ2 instrument measures. Supplementary
  // TEENS/PRO/AWARE tracks are explorable below via the filter chips, but the
  // progress bar tracks the class curriculum, not the whole catalogue.
  const pilotModules = modules.filter((m) => m.audience === "KIDS");
  const completedPilot = pilotModules.filter((m) => progressOf(m.id)?.status === "completed").length;
  const visible = audienceFilter === "ALL" ? modules : modules.filter((m) => m.audience === audienceFilter);
  const tracks: ("ALL" | Audience)[] = ["ALL", "KIDS", "TEENS", "PRO", "AWARE"];
  const trackShort: Record<string, [string, string]> = {
    ALL: ["All lessons", "ሁሉም ትምህርቶች"],
    KIDS: ["Kids 5–8", "ልጆች 5–8"],
    TEENS: ["Teens 9–12", "ወጣቶች 9–12"],
    PRO: ["University", "ዩኒቨርሲቲ"],
    AWARE: ["Staff", "ሠራተኞች"],
  };
  return (
    <div className="space-y-5">
      {/* Learner header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <p className="font-semibold">{status.learner.className}</p>
          <p className="text-xs text-muted-foreground">
            {pick(status.learner.schoolName, status.learner.schoolNameAm)} · <span className="font-mono">{status.learner.code}</span>
          </p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("learnLessonProgress", String(completedPilot), String(pilotModules.length))}</span>
            <span>{Math.round((completedPilot / Math.max(1, pilotModules.length)) * 100)}%</span>
          </div>
          <Progress value={(completedPilot / Math.max(1, pilotModules.length)) * 100} className="mt-1 h-2" />
        </div>
      </div>

      {/* Tests */}
      <div className="grid gap-3 md:grid-cols-2">
        <TestCard
          title={t("learnPreTest")}
          done={status.assessments.pre}
          locked={false}
          onStart={() => onTakeTest("PRE")}
          t={t}
          lang={lang}
        />
        <TestCard
          title={t("learnPostTest")}
          done={status.assessments.post}
          locked={!status.assessments.pre}
          lockedLabel={t("learnPreTest")}
          onStart={() => onTakeTest("POST")}
          t={t}
          lang={lang}
        />
      </div>

      {/* Lessons */}
      <h2 className="flex items-center gap-2 text-base font-bold"><BookOpen className="h-4 w-4 text-emerald-700" />{lang === "en" ? "Lessons" : "ትምህርቶች"}</h2>
      <div className="flex flex-wrap gap-1.5">
        {tracks.map((tr) => (
          <button
            key={tr}
            onClick={() => setAudienceFilter(tr)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${audienceFilter === tr ? "border-emerald-600 bg-emerald-600 text-white" : "bg-card text-muted-foreground hover:border-emerald-400"}`}
            title={tr === "ALL" ? "" : pick(AUDIENCE_LABELS[tr as Audience].en, AUDIENCE_LABELS[tr as Audience].am)}
          >
            {pick(trackShort[tr][0], trackShort[tr][1])}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((m) => {
          const pr = progressOf(m.id);
          const done = pr?.status === "completed";
          return (
            <button
              key={m.id}
              onClick={() => onOpenLesson(m.id)}
              className={`group space-y-1.5 rounded-2xl border p-4 text-left shadow-sm transition-colors hover:border-emerald-400 ${done ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30" : "bg-card"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{m.code}</span>
                {done ? (
                  <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3 w-3" />{pr?.quizScore !== null && pr?.quizScore !== undefined ? `${Math.round(pr.quizScore)}%` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]"><Clock className="mr-1 h-3 w-3" />{m.durationMin}′ · {m.audience === "KIDS" ? "Kids" : m.audience === "TEENS" ? "Teens" : m.audience === "PRO" ? "CyberPro" : "CyberAware"}</Badge>
                )}
              </div>
              <p className="font-semibold leading-snug">{pick(m.titleEn, m.titleAm)}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{pick(m.summaryEn, m.summaryAm)}</p>
            </button>
          );
        })}
      </div>

      {/* AI tools door */}
      <button
        onClick={onOpenTools}
        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left shadow-sm transition-colors hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"><Sparkles className="h-5 w-5" /></span>
        <div>
          <p className="font-semibold">{t("learnToolsDoor")}</p>
          <p className="text-xs text-muted-foreground">{t("learnToolsDoorHint")}</p>
        </div>
      </button>
    </div>
  );
}

function TestCard({
  title, done, locked, lockedLabel, onStart, t, lang,
}: {
  title: string;
  done: { score: number; correct: number; total: number } | null;
  locked: boolean;
  lockedLabel?: string;
  onStart: () => void;
  t: (k: string, ...a: string[]) => string;
  lang: string;
}) {
  return (
    <div className={`space-y-2 rounded-2xl border p-4 shadow-sm ${done ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-emerald-700" />{title}</p>
        {done ? (
          <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{t("learnTestDone", String(done.score))}</Badge>
        ) : locked ? (
          <Badge variant="secondary"><Lock className="mr-1 h-3 w-3" />{t("learnLocked")}</Badge>
        ) : null}
      </div>
      {done ? (
        <p className="text-xs text-muted-foreground">{t("learnCorrectOf", String(done.correct), String(done.total))}</p>
      ) : locked ? (
        <p className="text-xs text-muted-foreground">{lang === "en" ? `Complete the ${lockedLabel} first.` : `መጀመሪያ ${lockedLabel}ን ይጨርሱ።`}</p>
      ) : (
        <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={onStart}>{t("learnStart")}</Button>
      )}
    </div>
  );
}

// ── Lesson (content + quiz) ──────────────────────────────────────────────────

function LessonStep({
  moduleId, joinCode, learnerCode, lang, t, pick, onDone, onBack,
}: {
  moduleId: string;
  joinCode: string;
  learnerCode: string;
  lang: string;
  t: (k: string, ...a: string[]) => string;
  pick: (en: string, am: string) => string;
  onDone: () => Promise<void>;
  onBack: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<ModuleDetail["module"] | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; detail: QuizDetail[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/learn/modules/${moduleId}`);
        const body = await r.json();
        if (r.ok) setDetail(body.module);
        else setError(body?.error?.message ?? "Lesson not found.");
      } catch {
        setError("Network error.");
      }
    })();
  }, [moduleId]);

  const submitQuiz = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const { ok, data } = await post<{ quiz?: { score: number; correct: number; total: number; detail: QuizDetail[] }; error?: { message: string } }>("/api/learn/progress", {
        joinCode, learnerCode, moduleId,
        quizAnswers: detail.questions.map((q) => ({ qId: q.id, picked: picked[q.id] ?? 0 })),
      });
      if (!ok || !data.quiz) {
        setError((data as { error?: { message?: string } })?.error?.message ?? "Submit failed.");
        return;
      }
      setResult(data.quiz);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !detail) return <p className="text-center text-sm text-rose-600">{error}</p>;
  if (!detail) return <div className="space-y-3"><div className="h-8 w-64 animate-pulse rounded bg-muted" />{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-muted" />)}</div>;

  const content = lang === "en" ? detail.contentEn : detail.contentAm;
  const blocks = content.split(/\n\n+/);
  const allAnswered = detail.questions.every((q) => picked[q.id] !== undefined);

  return (
    <div className="space-y-5">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => void onBack()}>
        <ArrowLeft className="h-4 w-4" />{t("learnBackToHub")}
      </button>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="outline" className="font-mono">{detail.code}</Badge>
          <h1 className="text-lg font-bold">{pick(detail.titleEn, detail.titleAm)}</h1>
        </div>
        <div className="space-y-3 leading-relaxed">
          {blocks.map((b, i) =>
            b.startsWith("## ") ? (
              <p key={i} className="pt-1 font-semibold">{b.slice(3)}</p>
            ) : (
              <p key={i} className="text-muted-foreground" lang={lang === "am" ? "am" : "en"}>{b}</p>
            )
          )}
        </div>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
            <Award className="mx-auto h-8 w-8 text-emerald-700" />
            <p className="mt-1 text-xl font-bold">{t("learnScore", String(result.score))}</p>
            <p className="text-sm text-muted-foreground">{t("learnCorrectOf", String(result.correct), String(result.total))}</p>
          </div>
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => void onDone()}>{t("learnBackToHub")}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold"><ClipboardList className="h-4 w-4 text-emerald-700" />{t("learnTakeQuiz")}</h2>
          {detail.questions.map((q, qi) => {
            const options = lang === "en" ? q.optionsEn : q.optionsAm;
            return (
              <div key={q.id} className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
                <p className="font-medium"><span className="mr-1 text-muted-foreground">{qi + 1}.</span>{pick(q.promptEn, q.promptAm)}</p>
                <div className="grid gap-1.5">
                  {options.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => setPicked((prev) => ({ ...prev, [q.id]: i }))}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${picked[q.id] === i ? "border-emerald-600 bg-emerald-50 font-medium dark:bg-emerald-950" : "hover:border-emerald-300"}`}
                    >
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>{o}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {error && <p className="text-center text-sm text-rose-600">{error}</p>}
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy || !allAnswered} onClick={() => void submitQuiz()}>
            {t("learnSubmit")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Pre/post test ────────────────────────────────────────────────────────────

function TestStep({
  kind, joinCode, learnerCode, lang, t, pick, onDone, onBack,
}: {
  kind: TestKind;
  joinCode: string;
  learnerCode: string;
  lang: string;
  t: (k: string, ...a: string[]) => string;
  pick: (en: string, am: string) => string;
  onDone: (result: { assessment: { kind: string; score: number; correct: number; total: number; gain: number | null }; detail: QuizDetail[] }) => Promise<void>;
  onBack: () => void;
}) {
  const [items, setItems] = useState<PublicQuestion[] | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/learn/instrument");
        const body = await r.json();
        if (r.ok) setItems(body.items);
        else setError(body?.error?.message ?? "Could not load the test.");
      } catch {
        setError("Network error.");
      }
    })();
  }, []);

  const submit = async () => {
    if (!items) return;
    setBusy(true);
    try {
      const { ok, data } = await post<{ assessment?: { kind: string; score: number; correct: number; total: number; gain: number | null }; detail?: QuizDetail[]; error?: { message: string } }>("/api/learn/assessment", {
        joinCode, learnerCode, kind,
        answers: items.map((q) => ({ qId: q.id, picked: picked[q.id] ?? 0 })),
      });
      if (!ok || !data.assessment) {
        setError((data as { error?: { message?: string } })?.error?.message ?? "Submit failed.");
        return;
      }
      await onDone({ assessment: data.assessment, detail: data.detail ?? [] });
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !items) return <p className="text-center text-sm text-rose-600">{error}</p>;
  if (!items) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded bg-muted" />)}</div>;

  const allAnswered = items.every((q) => picked[q.id] !== undefined);

  return (
    <div className="space-y-4">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />{t("learnBackToHub")}
      </button>
      <h1 className="text-lg font-bold">{kind === "PRE" ? t("learnPreTest") : t("learnPostTest")}</h1>
      <p className="text-sm text-muted-foreground">
        {lang === "en" ? `${items.length} questions — answer all, then submit.` : `${items.length} ጥያቄዎች — ሁሉንም መልሰው ይላኩ።`}
      </p>
      {items.map((q, qi) => {
        const options = lang === "en" ? q.optionsEn : q.optionsAm;
        return (
          <div key={q.id} className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
            <p className="font-medium"><span className="mr-1 text-muted-foreground">{qi + 1}.</span>{pick(q.promptEn, q.promptAm)}</p>
            <div className="grid gap-1.5">
              {options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => setPicked((prev) => ({ ...prev, [q.id]: i }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${picked[q.id] === i ? "border-emerald-600 bg-emerald-50 font-medium dark:bg-emerald-950" : "hover:border-emerald-300"}`}
                >
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>{o}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
      <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy || !allAnswered} onClick={() => void submit()}>
        {t("learnSubmit")}
      </Button>
    </div>
  );
}

function TestResultStep({
  result, preScore, lang, t, pick, onBack,
}: {
  result: { assessment: { kind: string; score: number; correct: number; total: number; gain: number | null }; detail: QuizDetail[] };
  preScore: number | null;
  lang: string;
  t: (k: string, ...a: string[]) => string;
  pick: (en: string, am: string) => string;
  onBack: () => Promise<void>;
}) {
  const a = result.assessment;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <Award className="mx-auto h-10 w-10 text-emerald-700" />
        <p className="mt-2 text-3xl font-bold tabular-nums">{a.score}%</p>
        <p className="text-sm text-muted-foreground">{t("learnCorrectOf", String(a.correct), String(a.total))}</p>
        {a.kind === "POST" && a.gain !== null && preScore !== null && (
          <p className="mt-2 inline-block rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
            {t("learnYourGain", String(a.gain))} ({preScore}% → {a.score}%)
          </p>
        )}
      </div>

      {result.detail.map((d, i) => {
        const options = lang === "en" ? d.question.optionsEn : d.question.optionsAm;
        return (
          <div key={d.question.id} className={`space-y-2 rounded-2xl border p-4 shadow-sm ${d.correct ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900" : "border-amber-300 bg-amber-50/40 dark:border-amber-900"}`}>
            <p className="font-medium">
              <span className="mr-1">{d.correct ? <CheckCircle2 className="inline h-4 w-4 text-emerald-600" /> : <XCircleIcon />}</span>
              {i + 1}. {pick(d.question.promptEn, d.question.promptAm)}
            </p>
            {!d.correct && (
              <p className="text-xs">
                <span className="font-semibold">{t("learnAnswerWas")}:</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">{String.fromCharCode(65 + d.answerIdx)}. {options[d.answerIdx]}</span>
              </p>
            )}
            {(lang === "en" ? d.explainEn : d.explainAm) && (
              <p className="text-xs text-muted-foreground">{pick(d.explainEn ?? "", d.explainAm ?? "")}</p>
            )}
          </div>
        );
      })}

      <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => void onBack()}>{t("learnBackToHub")}</Button>
    </div>
  );
}

function XCircleIcon() {
  return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">✕</span>;
}

export default function LearnPage() {
  return (
    <I18nProvider>
      <LearnApp />
    </I18nProvider>
  );
}
