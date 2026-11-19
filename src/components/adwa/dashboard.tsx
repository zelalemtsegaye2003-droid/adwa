"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ShieldCheck, Building2, ScrollText, Timer, TrendingDown, Landmark, PlayCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";
import { ScoreRing, SeverityBadge, FrameworkBadge, scoreColor, fmtDate } from "./shared";
import { EthioLandscape } from "./ethio-landscape";

interface FrameworkSummary {
  id: string; code: string; name: string; nameAm: string;
  issuer: string; instrument: string; instrumentNo: string;
  ruleCount: number; scansCompleted: number; avgScore: number | null;
}

interface Stats {
  organizations: number;
  sectors: string[];
  rules: number;
  articles: number;
  frameworks: FrameworkSummary[];
  scansCompleted: number;
  avgScore: number;
  avgDurationMinutes: number;
  bySeverity: { critical: number; high: number; medium: number };
  byStatus: { open: number; in_progress: number; remediated: number; waived: number };
  sla?: { tracked: number; onTrack: number; dueSoon: number; overdue: number; closedOnTime: number; closedLate: number; waived: number; notTracked: number };
  coverage: { article: string; total: number; flagged: number; rate: number }[];
  recentScans: { id: string; name: string; score: number | null; org: string; completedAt: string | null; findings: number; critical: number; frameworkCode?: string | null }[];
  inProgress?: { id: string; name: string; org: string; organizationId: string; startedAt: string; answered: number; total: number; frameworkCode?: string | null }[];
}

export function DashboardView({ onOpenReport, onResumeScan, canRunScans }: { onOpenReport: (scanId: string) => void; onResumeScan: (scanId: string) => void; canRunScans: boolean }) {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/stats").then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  const reduction = Math.max(0, Math.round((1 - stats.avgDurationMinutes / 60 / 40) * 1000) / 10);

  const pieData = [
    { name: t("critical"), value: stats.bySeverity.critical, color: "#DC2626" },
    { name: t("high"), value: stats.bySeverity.high, color: "#D97706" },
    { name: t("medium"), value: stats.bySeverity.medium, color: "#EAB308" },
  ].filter((d) => d.value > 0);

  const kpis = [
    { icon: ShieldCheck, label: t("avgScore"), value: `${stats.avgScore}%`, sub: `${stats.scansCompleted} ${t("navScans").toLowerCase()}` },
    { icon: Building2, label: t("orgsMonitored"), value: stats.organizations, sub: stats.sectors.join(" · ") },
    { icon: ScrollText, label: t("rulesEnforced"), value: stats.rules, sub: `${stats.frameworks.length} ${t("frameworks").toLowerCase()} · ${stats.articles} ${t("allArticles").toLowerCase()}` },
    { icon: Timer, label: t("auditDuration"), value: `${stats.avgDurationMinutes} min`, sub: t("vsManual") },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ethiopian cyber landscape — real Ethio-CERT / INSA / NBE sources */}
      <EthioLandscape />

      {/* SLA breach alert — overdue corrective actions (Procl. 1426/2026) */}
      {(stats.sla?.overdue ?? 0) > 0 && (
        <Card className="border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-red-900 dark:text-red-200">
                {stats.sla!.overdue} {t("slaOverdueCard")}
              </p>
              <p className="mt-0.5 text-sm text-red-800/80 dark:text-red-300/80">
                {t("slaOpenItems", String((stats.sla?.overdue ?? 0) + (stats.sla?.dueSoon ?? 0) + (stats.sla?.onTrack ?? 0)))}
                {(stats.sla?.dueSoon ?? 0) > 0 ? ` · ${stats.sla!.dueSoon} ${t("slaDueSoonCard")}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In-progress assessments — resume banner */}
      {canRunScans && (stats.inProgress?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <PlayCircle className="h-4 w-4" aria-hidden /> {t("inProgressScans")}
            </h3>
            <div className="mt-3 space-y-2">
              {stats.inProgress!.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.frameworkCode ? <FrameworkBadge code={s.frameworkCode} /> : null}{" "}
                      {s.org} · {t("startedOn")} {fmtDate(s.startedAt)} · {s.answered}/{s.total} {t("answered")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onResumeScan(s.id)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    <PlayCircle className="h-4 w-4" aria-hidden /> {t("resumeScan")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regulatory frameworks posture */}
      {stats.frameworks.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Landmark className="h-4 w-4" aria-hidden /> {t("frameworks")}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {stats.frameworks.map((f) => (
              <Card key={f.code}>
                <CardContent className="flex items-center gap-5 p-4 sm:p-6">
                  <ScoreRing score={f.avgScore ?? 0} size={104} label={t("avgScoreFw")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{lang === "en" ? f.name : f.nameAm}</p>
                      <FrameworkBadge code={f.code} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.instrumentNo}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-bold tabular-nums">{f.ruleCount}</span>{" "}
                      <span className="text-muted-foreground">{t("obligations")}</span>
                      {" · "}
                      <span className="font-bold tabular-nums">{f.scansCompleted}</span>{" "}
                      <span className="text-muted-foreground">{t("navScans").toLowerCase()}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("issuer")}: {f.issuer}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* RQ1 banner */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <TrendingDown className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{t("timeComparison")}: {reduction}% audit-time reduction vs the 40–80-hour manual baseline</p>
            <p className="text-sm text-muted-foreground">
              Automated audits average {stats.avgDurationMinutes} minutes across {stats.scansCompleted} completed scans — success threshold (&gt;70%) {reduction >= 70 ? "met ✓" : "on track"}.
            </p>
          </div>
          <Progress value={Math.min(100, reduction)} className="w-full sm:w-40 h-2" aria-label="RQ1 progress" />
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("findingsSeverity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-16 text-center">—</p>
            )}
            <div className="flex justify-center gap-4 text-xs">
              {pieData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("articleRisk")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={268}>
              <BarChart data={stats.coverage} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="article" tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {stats.coverage.map((c) => (
                    <Cell key={c.article} fill={c.rate >= 75 ? "#DC2626" : c.rate >= 40 ? "#D97706" : "#059669"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("pillarPerf")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PillarRadar />
          </CardContent>
        </Card>
      </div>

      {/* Recent scans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentScans")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("navScans")}</TableHead>
                <TableHead>{t("org")}</TableHead>
                <TableHead>{t("overallScore")}</TableHead>
                <TableHead>{t("findings")}</TableHead>
                <TableHead>{t("completedOn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentScans.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => onOpenReport(s.id)}>
                  <TableCell className="font-medium">
                    <span className="flex flex-wrap items-center gap-2">
                      {s.name}
                      <FrameworkBadge code={s.frameworkCode} />
                    </span>
                  </TableCell>
                  <TableCell>{s.org}</TableCell>
                  <TableCell className={`font-bold tabular-nums ${scoreColor(s.score ?? 0)}`}>{s.score?.toFixed(1)}%</TableCell>
                  <TableCell>{s.findings} ({s.critical} {t("critical").toLowerCase()})</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(s.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Average pillar scores across completed scans (from /api/scans)
function PillarRadar() {
  const [data, setData] = useState<{ pillar: string; score: number }[] | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    api<{ scans: { status: string; pillarScores: string | null }[] }>("/api/scans")
      .then(({ scans }) => {
        const done = scans.filter((s) => s.status === "complete" && s.pillarScores);
        if (!done.length) { setData([]); return; }
        const acc: Record<string, number[]> = {};
        for (const s of done) {
          const ps = JSON.parse(s.pillarScores!);
          for (const [k, v] of Object.entries<number>(ps)) (acc[k] ||= []).push(v);
        }
        const labels: Record<string, string> = {
          Legal: t("legal"), Technical: t("technical"), Organisational: t("organisational"), Awareness: t("awareness"),
          Governance: t("governance"), Automation: t("automation"), "Risk Management": t("riskMgmt"),
          "Cyber Security": t("cyberSec"), Continuity: t("continuity"),
        };
        setData(
          Object.entries(acc).map(([pillar, arr]) => ({
            pillar: labels[pillar] ?? pillar,
            score: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
          }))
        );
      })
      .catch(() => setData([]));
  }, [t]);

  if (data === null) return <Skeleton className="h-[268px] w-full" />;
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-16 text-center">—</p>;
  return (
    <ResponsiveContainer width="100%" height={268}>
      {/* smaller radius + smaller tick font: long pillar labels (e.g. "SBB/83 Art. 5.1")
          used to collide with each other around the chart edge. 10-char ticks keep
          any two neighbouring polar labels fully separated. */}
      <RadarChart data={data} outerRadius="58%">
        <PolarGrid />
        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 9 }} tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)} />
        <Radar dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.35} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}
