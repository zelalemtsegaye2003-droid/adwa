"use client";

/**
 * Adwa Cyber — AI Enhancement Lab for the learner portal (proposal Phase 3,
 * Table 23). Six interactive tools, each wired to a pure engine in
 * @/lib/awareness-tools.
 *
 * Privacy-by-design: every engine runs in the browser. Nothing a learner
 * types into a tool is transmitted; the only network call is an anonymous
 * usage ping (tool id + interface language — see /api/learn/tools/ping).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, KeyRound, Radar, ShieldAlert, Footprints, Flag, Siren,
  ShieldCheck, CheckCircle2, XCircle, Eye, EyeOff, Printer, Sparkles,
} from "lucide-react";
import {
  AWARENESS_TOOLS, type ToolId, type PasswordReport, scorePassword,
  PHISH_SPECIMENS, PHISH_FEATURES, phishiness, classifySpecimen,
  SEXTORTION_SCENARIO,
  FOOTPRINT_QUESTIONS, FOOTPRINT_CATEGORIES, scoreFootprint, type FootprintResult,
  FLAG_POSTS,
  INCIDENT_TYPES, buildReportChecklist,
} from "@/lib/awareness/awareness-tools";

type Pick = (en: string, am: string) => string;

/** Anonymous usage ping — tool id + interface language only. */
export function pingTool(tool: string, lang: string) {
  try {
    void fetch("/api/learn/tools/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, lang }),
    }).catch(() => {});
  } catch {}
}

const TOOL_ICONS: Record<ToolId, React.ComponentType<{ className?: string }>> = {
  password: KeyRound,
  phishing: Radar,
  sextortion: ShieldAlert,
  footprint: Footprints,
  flagging: Flag,
  "report-guide": Siren,
};

// ── Grid ─────────────────────────────────────────────────────────────────────

export function LearnToolsGrid({
  lang, pick, onOpen, onBack, backLabel, hubLabel, onHub,
}: {
  lang: string;
  pick: Pick;
  onOpen: (id: ToolId) => void;
  onBack?: () => void;
  backLabel?: string;
  hubLabel?: string;
  onHub?: () => void;
}) {
  return (
    <div className="space-y-5">
      {(onBack || onHub) && (
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={onBack ?? onHub}>
          <ArrowLeft className="h-4 w-4" />{onBack ? backLabel : hubLabel}
        </button>
      )}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-emerald-700" />
          {lang === "en" ? "AI Practice Tools" : "የAI ልምምድ መሳሪያዎች"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "en"
            ? "Six practice tools that run entirely on your device — nothing you type is ever sent to us."
            : "ስድስት የልምምድ መሳሪያዎች ሙሉ በሙሉ በመሣሪያዎ ላይ ይሠራሉ — የጻፉት ምንም ነገር ወደ እኛ አይላክም።"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AWARENESS_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          return (
            <button
              key={tool.id}
              onClick={() => onOpen(tool.id)}
              className="group space-y-2 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-emerald-400"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white"><Icon className="h-4 w-4" /></span>
                {tool.moduleCode && <Badge variant="outline" className="font-mono text-[10px]">{tool.moduleCode}</Badge>}
              </div>
              <p className="font-semibold leading-snug">{pick(tool.nameEn, tool.nameAm)}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{pick(tool.descEn, tool.descAm)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tool shell ───────────────────────────────────────────────────────────────

export function LearnToolRunner({
  toolId, lang, pick, onBack, backLabel,
}: {
  toolId: ToolId;
  lang: string;
  pick: Pick;
  onBack: () => void;
  backLabel: string;
}) {
  useEffect(() => {
    pingTool(toolId, lang);
  }, [toolId, lang]);

  const tool = AWARENESS_TOOLS.find((t) => t.id === toolId)!;
  const Icon = TOOL_ICONS[toolId];

  return (
    <div className="space-y-4">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />{backLabel}
      </button>
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white"><Icon className="h-5 w-5" /></span>
        <div>
          <h1 className="font-bold leading-tight">{pick(tool.nameEn, tool.nameAm)}</h1>
          <p className="text-xs text-muted-foreground">{pick(tool.descEn, tool.descAm)}</p>
        </div>
        <Badge variant="secondary" className="ml-auto hidden shrink-0 sm:inline-flex">
          <ShieldCheck className="mr-1 h-3 w-3" />{lang === "en" ? "On-device" : "በመሣሪያዎ"}
        </Badge>
      </div>

      {toolId === "password" && <PasswordTool lang={lang} pick={pick} />}
      {toolId === "phishing" && <PhishingTool lang={lang} pick={pick} />}
      {toolId === "sextortion" && <SextortionTool lang={lang} pick={pick} />}
      {toolId === "footprint" && <FootprintTool lang={lang} pick={pick} />}
      {toolId === "flagging" && <FlaggingTool lang={lang} pick={pick} />}
      {toolId === "report-guide" && <ReportGuideTool lang={lang} pick={pick} />}
    </div>
  );
}

// ── Tool 1 · Password strength checker ──────────────────────────────────────

function PasswordTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const report: PasswordReport = useMemo(() => scorePassword(pw), [pw]);
  const bandTone: Record<string, string> = {
    very_weak: "text-rose-600", weak: "text-rose-600", fair: "text-amber-600",
    strong: "text-emerald-700", very_strong: "text-emerald-700",
  };
  const sevTone: Record<string, string> = { critical: "bg-rose-100 text-rose-800", warn: "bg-amber-100 text-amber-800", info: "bg-sky-100 text-sky-800", good: "bg-emerald-100 text-emerald-800" };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
        <label className="text-sm font-medium" htmlFor="pw-input">
          {lang === "en" ? "Type a password to test (nothing is stored or sent)" : "ለመፈተሽ የይለፍ ቃል ጻፉ (አይቀመጥም፣ አይላክም)"}
        </label>
        <div className="flex gap-2">
          <input
            id="pw-input"
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="off"
            placeholder="Blue-Donkey-7-Coffee!"
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <Button variant="outline" size="icon" onClick={() => setShow((s) => !s)} aria-label="toggle visibility">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {pw && (
        <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-lg font-bold ${bandTone[report.band]}`}>{pick(report.bandEn, report.bandAm)}</p>
            <p className="text-sm tabular-nums text-muted-foreground">{report.score}/100 · {report.entropyBits} bits</p>
          </div>
          <Progress value={report.score} className="h-2" />
          <p className="text-sm">
            <span className="font-medium">{lang === "en" ? "Offline crack estimate: " : "ያለ መስመር የመሰባበሪያ ግምት፦ "}</span>
            <span className="text-muted-foreground">{pick(report.crackTimeEn, report.crackTimeAm)}</span>
          </p>

          {report.findings.length > 0 && (
            <div className="space-y-1.5">
              {report.findings.map((f) => (
                <p key={f.code} className={`rounded-lg px-3 py-1.5 text-xs ${sevTone[f.severity]}`}>{pick(f.textEn, f.textAm)}</p>
              ))}
            </div>
          )}

          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "en" ? "Personalised recommendations" : "ግላዊ ምክሮች"}
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {report.tipsEn.slice(0, 3).map((tip, i) => (
                <li key={i}>{pick(tip, report.tipsAm[i])}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool 2 · Phishing radar ─────────────────────────────────────────────────

function PhishingTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<"PHISHING" | "LEGIT" | null>(null);
  const [correctN, setCorrectN] = useState(0);
  const [finished, setFinished] = useState(false);

  const s = PHISH_SPECIMENS[idx];
  const score = verdict ? phishiness(s) : 0;
  const aiVerdict = verdict ? classifySpecimen(s) : null;

  const choose = (choice: "PHISHING" | "LEGIT") => {
    setVerdict(choice);
    if (choice === s.verdict) setCorrectN((n) => n + 1);
  };
  const next = () => {
    if (idx + 1 >= PHISH_SPECIMENS.length) setFinished(true);
    else {
      setIdx(idx + 1);
      setVerdict(null);
    }
  };

  if (finished) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <Radar className="mx-auto h-10 w-10 text-emerald-700" />
        <p className="text-2xl font-bold tabular-nums">{correctN}/{PHISH_SPECIMENS.length}</p>
        <p className="text-sm text-muted-foreground">
          {lang === "en"
            ? "Accuracy vs the classifier. The habit that transfers to real life: verify through a channel you already trust before clicking, paying or sharing codes."
            : "ከክላሲፋየሩ ጋር ያለው ትክክለኛነት። ወደ እውነተኛ ሕይወት የሚዛወረው ልማድ፦ ከመጫን፣ ከመክፈል ወይም ኮድ ከመላክ በፊት በታመነው ቻናል ያረጋግጡ።"}
        </p>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { setIdx(0); setVerdict(null); setCorrectN(0); setFinished(false); }}>
          {lang === "en" ? "Try again" : "እንደገና ሞክር"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <Badge variant="outline">{s.channel}</Badge>
          <span>{idx + 1} / {PHISH_SPECIMENS.length}</span>
        </div>
        <p className="text-xs text-muted-foreground">{lang === "en" ? "From" : "ከ"} <span className="font-mono">{s.sender}</span></p>
        <p className="mt-1 font-semibold">{s.subject}</p>
        <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/60 p-3 text-sm" lang="am">{s.body}</p>
        {s.linkDisplay && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">{lang === "en" ? "Link" : "አገናኝ"}: </span>
            <span className="break-all font-mono text-sky-700 underline dark:text-sky-400">{s.linkDisplay}</span>
          </p>
        )}
      </div>

      {!verdict ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300" onClick={() => choose("PHISHING")}>
            <XCircle className="mr-1.5 h-4 w-4" />{lang === "en" ? "Report as phishing" : "እንደ ፊሺንግ ሪፖርት"}
          </Button>
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300" onClick={() => choose("LEGIT")}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />{lang === "en" ? "Looks safe" : "ደህና ይመስላል"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className={`rounded-lg p-3 text-sm ${verdict === s.verdict ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>
            <p className="font-semibold">
              {verdict === s.verdict
                ? lang === "en" ? "✓ Correct" : "✓ ትክክል"
                : lang === "en" ? "✕ Not this time" : "✕ ይህ ጊዜ አይደለም"}
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
              {lang === "en" ? "AI classifier verdict" : "የAI ክላሲፋየር ውሳኔ"} — {aiVerdict === "PHISHING"
                ? (lang === "en" ? "PHISHING" : "ፊሺንግ")
                : (lang === "en" ? "LEGITIMATE" : "ትክክለኛ")} ({score}/100)
            </p>
            <Progress value={score} className="h-1.5" />
            <ul className="mt-1 space-y-1 text-xs">
              {PHISH_FEATURES.map((f) => (
                <li key={f.code} className={`flex items-start gap-1.5 ${s.hits.includes(f.code) ? "text-sky-900 dark:text-sky-200" : "text-muted-foreground/60"}`}>
                  <span>{s.hits.includes(f.code) ? "●" : "○"}</span>
                  <span className="font-mono text-[10px]">+{f.weight}</span>
                  {pick(f.en, f.am)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">{pick(s.whyEn, s.whyAm)}</p>
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={next}>
            {idx + 1 >= PHISH_SPECIMENS.length
              ? (lang === "en" ? "See my result" : "ውጤቴን አሳዩ")
              : (lang === "en" ? "Next message" : "ቀጣይ መልዕክት")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Tool 3 · Sextortion response trainer ────────────────────────────────────

function SextortionTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [started, setStarted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<number | null>(null);

  const step = SEXTORTION_SCENARIO.steps[stepIdx];
  const done = stepIdx >= SEXTORTION_SCENARIO.steps.length;
  const choice = feedback !== null ? step.choices[chosen[stepIdx]] : null;

  if (!started) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-muted-foreground">{pick(SEXTORTION_SCENARIO.introEn, SEXTORTION_SCENARIO.introAm)}</p>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setStarted(true)}>
          {lang === "en" ? "Begin the story" : "ታሪኩን ጀምር"}
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
          <ShieldCheck className="h-8 w-8 text-emerald-700" />
          <p className="mt-1 font-bold">{lang === "en" ? "The five-step response protocol" : "የአምስት እርምጃ ምላሽ ሥርዓት"}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
            {(lang === "en" ? SEXTORTION_SCENARIO.protocolEn : SEXTORTION_SCENARIO.protocolAm).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
        <Button
          variant="outline" className="w-full"
          onClick={() => { setStarted(false); setStepIdx(0); setChosen({}); setFeedback(null); }}
        >
          {lang === "en" ? "Restart the trainer" : "ልምምዱን እንደገና ጀምር"}
        </Button>
      </div>
    );
  }

  const outcomeTone: Record<string, string> = {
    safe: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    risky: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    unsafe: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  };
  const outcomeLabel: Record<string, [string, string]> = {
    safe: ["Safe choice", "ደህና ምርጫ"],
    risky: ["Risky", "አደጋን የሚያስከትል"],
    unsafe: ["Unsafe", "አደጋ"],
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-xs text-muted-foreground">{stepIdx + 1} / {SEXTORTION_SCENARIO.steps.length}</p>
        <p className="mt-1 text-sm leading-relaxed">{pick(step.narrativeEn, step.narrativeAm)}</p>
      </div>

      {feedback === null ? (
        <div className="space-y-2">
          {step.choices.map((c, ci) => (
            <button
              key={ci}
              onClick={() => { setChosen((p) => ({ ...p, [stepIdx]: ci })); setFeedback(ci); }}
              className="w-full rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-sm transition-colors hover:border-emerald-400"
            >
              {pick(c.textEn, c.textAm)}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className={`rounded-xl p-3 text-sm ${outcomeTone[choice!.outcome]}`}>
            <span className="font-semibold">{pick(outcomeLabel[choice!.outcome][0], outcomeLabel[choice!.outcome][1])}. </span>
            {pick(choice!.feedbackEn, choice!.feedbackAm)}
          </p>
          <Button
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            onClick={() => { setFeedback(null); setStepIdx(stepIdx + 1); }}
          >
            {stepIdx + 1 >= SEXTORTION_SCENARIO.steps.length
              ? (lang === "en" ? "See the protocol" : "ሥርዓቱን አሳዩ")
              : (lang === "en" ? "Continue" : "ቀጥል")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Tool 4 · Digital footprint visualiser ───────────────────────────────────

function FootprintTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<FootprintResult | null>(null);

  const allAnswered = FOOTPRINT_QUESTIONS.every((q) => answers[q.id] !== undefined);
  const riskTone: Record<string, string> = {
    low: "text-emerald-700", moderate: "text-amber-600", elevated: "text-orange-600", high: "text-rose-600",
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 text-center shadow-sm">
          <Footprints className="mx-auto h-8 w-8 text-emerald-700" />
          <p className={`mt-1 text-2xl font-bold ${riskTone[result.band]}`}>{pick(result.bandEn, result.bandAm)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">{lang === "en" ? "Exposure risk" : "የተጋላጭነት ስጋት"}: {result.risk}/100</p>
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lang === "en" ? "Where your risk sits" : "ስጋትዎ የሚገኘው"}</p>
          {result.categories.map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{pick(FOOTPRINT_CATEGORIES[c.category].en, FOOTPRINT_CATEGORIES[c.category].am)}</span>
                <span className="tabular-nums text-muted-foreground">{c.score}</span>
              </div>
              <Progress value={c.score} className="h-2" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lang === "en" ? "Your personal reduction plan" : "የእርስዎ ግላዊ የመቀነሻ ዕቅድ"}</p>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {result.tipsEn.map((tip, i) => <li key={i}>{pick(tip, result.tipsAm[i])}</li>)}
          </ul>
        </div>
        <Button variant="outline" className="w-full" onClick={() => { setAnswers({}); setResult(null); }}>
          {lang === "en" ? "Retake" : "እንደገና ውሰድ"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {lang === "en"
          ? "Ten questions, answered only on this device. Be honest — the score is for you alone."
          : "አሥር ጥያቄዎች፣ በዚህ መሣሪያ ብቻ የሚመለሱ። እውነትን ይንገሩ — ውጤቱ ለእርስዎ ብቻ ነው።"}
      </p>
      {FOOTPRINT_QUESTIONS.map((q, qi) => (
        <div key={q.id} className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="font-medium"><span className="mr-1 text-muted-foreground">{qi + 1}.</span>{pick(q.qEn, q.qAm)}</p>
          <div className="grid gap-1.5">
            {q.options.map((o, oi) => (
              <button
                key={oi}
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${answers[q.id] === oi ? "border-emerald-600 bg-emerald-50 font-medium dark:bg-emerald-950" : "hover:border-emerald-300"}`}
              >
                {pick(o.textEn, o.textAm)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={!allAnswered} onClick={() => setResult(scoreFootprint(answers))}>
        {lang === "en" ? "Visualise my exposure" : "ተጋላጭነቴን አሳዩ"}
      </Button>
    </div>
  );
}

// ── Tool 5 · Content flagging exercise ──────────────────────────────────────

function FlaggingTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState<"KEEP" | "REPORT" | null>(null);
  const [correctN, setCorrectN] = useState(0);
  const [finished, setFinished] = useState(false);

  const post = FLAG_POSTS[idx];
  const choose = (c: "KEEP" | "REPORT") => {
    setVerdict(c);
    if (c === post.correct) setCorrectN((n) => n + 1);
  };

  if (finished) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <Flag className="mx-auto h-10 w-10 text-emerald-700" />
        <p className="text-2xl font-bold tabular-nums">{correctN}/{FLAG_POSTS.length}</p>
        <p className="text-sm text-muted-foreground">
          {lang === "en"
            ? "The boundary you practised: criticism and satire are protected; fraud, harassment, hate speech, doxxing and panic-driving misinformation are reportable."
            : "የመለማመዱትን ወሰን፦ ትችትና ቀልድ የተጠበቁ ናቸው፤ ማታለል፣ ማሳደድ፣ ጥላት ንግግር፣ ዶክሲንግና ፍርሃት የሚፈጥር ውሸት ግን ሪፖርት የሚደረጉ ናቸው።"}
        </p>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { setIdx(0); setVerdict(null); setCorrectN(0); setFinished(false); }}>
          {lang === "en" ? "Try again" : "እንደገና ሞክር"}
        </Button>
      </div>
    );
  }

  const correctTone = verdict === post.correct;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{post.author}</span>
          <span>{idx + 1} / {FLAG_POSTS.length}</span>
        </div>
        <p className="text-sm leading-relaxed" lang="am">{post.text}</p>
      </div>

      {!verdict ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300" onClick={() => choose("KEEP")}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />{lang === "en" ? "Keep — allowed speech" : "ተው — የተፈቀደ ንግግር"}
          </Button>
          <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300" onClick={() => choose("REPORT")}>
            <Flag className="mr-1.5 h-4 w-4" />{lang === "en" ? "Report" : "ሪፖርት"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <p className={`rounded-lg p-3 text-sm ${correctTone ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>
            {correctTone
              ? (lang === "en" ? "✓ Correct — " : "✓ ትክክል — ")
              : (lang === "en" ? "✕ Not quite — " : "✕ እንደዚህ አይደለም — ")}
            <span className="font-medium">{post.correct === "KEEP"
              ? (lang === "en" ? "this post should stay up." : "ይህ ልጥፍ መቆየት አለበት።")
              : (lang === "en" ? "this post should be reported." : "ይህ ልጥፍ ሪፖርት መደረግ አለበት።")}</span>
          </p>
          <Badge variant="secondary">{pick(post.basisEn, post.basisAm)}</Badge>
          <p className="text-sm text-muted-foreground">{pick(post.whyEn, post.whyAm)}</p>
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => {
            if (idx + 1 >= FLAG_POSTS.length) setFinished(true);
            else { setIdx(idx + 1); setVerdict(null); }
          }}>
            {idx + 1 >= FLAG_POSTS.length
              ? (lang === "en" ? "See my result" : "ውጤቴን አሳዩ")
              : (lang === "en" ? "Next post" : "ቀጣይ ልጥፍ")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Tool 6 · Cybercrime reporting guide ─────────────────────────────────────

function ReportGuideTool({ lang, pick }: { lang: string; pick: Pick }) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const checklist = typeId ? buildReportChecklist(typeId) : null;
  const type = INCIDENT_TYPES.find((t) => t.id === typeId);
  const urgencyTone: Record<string, string> = {
    critical: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40",
    high: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
    medium: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40",
  };

  if (!checklist || !type) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {lang === "en" ? "What happened to you? Pick the closest." : "ምን አጋጠማችሁ? የተቀረበውን ይምረጡ።"}
        </p>
        {INCIDENT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeId(t.id)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-sm transition-colors hover:border-emerald-400"
          >
            <span className="font-medium">{pick(t.labelEn, t.labelAm)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${urgencyTone[type.urgency]}`}>
        <p className="text-sm font-semibold">{pick(type.labelEn, type.labelAm)}</p>
        <p className="mt-1 text-xs">{pick(type.urgencyEn, type.urgencyAm)}</p>
      </div>

      {checklist.steps.map((s) => (
        <div key={s.titleEn} className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="font-semibold">{pick(s.titleEn, s.titleAm)}</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {(lang === "en" ? s.itemsEn : s.itemsAm).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      ))}

      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
        <p className="font-semibold">{lang === "en" ? "Official channels" : "ይፋዊ ቻናሎች"}</p>
        <ul className="space-y-1.5 text-sm">
          {(lang === "en" ? checklist.channelsEn : checklist.channelsAm).map((c, i) => (
            <li key={i} className="flex items-start gap-2"><Siren className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />{c}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setTypeId(null)}>
          {lang === "en" ? "Other incident" : "ሌላ አደጋ"}
        </Button>
        <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />{lang === "en" ? "Print checklist" : "ዝርዝሩን አትም"}
        </Button>
      </div>
    </div>
  );
}
