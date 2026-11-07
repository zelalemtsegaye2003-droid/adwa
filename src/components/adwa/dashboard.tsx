"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ShieldCheck, Building2, ScrollText, Timer, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";
import { ScoreRing, SeverityBadge, scoreColor, fmtDate } from "./shared";

interface Stats {
  organizations: number;
  sectors: string[];
  rules: number;
  articles: number;
  scansCompleted: number;
  avgScore: number;
  avgDurationMinutes: number;
  bySeverity: { critical: number; high: number; medium: number };
  byStatus: { open: number; in_progress: number; remediated: number; waived: number };
  coverage: { article: string; total: number; flagged: number; rate: number }[];
  recentScans: { id: string; name: string; score: number | null; org: string; completedAt: string | null; findings: number; critical: number }[];
}

export function DashboardView({ onOpenReport }: { onOpenReport: (scanId: string) => void }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api("/api/stats").then(setStats).catch(() => {});
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
    { icon: ScrollText, label: t("rulesEnforced"), value: stats.rules, sub: `${stats.articles} articles · Proclamation 1321/2024` },
    { icon: Timer, label: t("auditDuration"), value: `${stats.avgDurationMinutes} min`, sub: t("vsManual") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashTitle")}</h2>
        <p className="text-muted-foreground">{t("dashSub")}</p>
      </div>

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

      {/* RQ1 banner */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <TrendingDown className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="font-semibold">RQ1 — {t("timeComparison")}: {reduction}% audit-time reduction vs the 40–80-hour manual baseline</p>
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
                  <TableCell className="font-medium">{s.name}</TableCell>
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
    api("/api/scans")
      
      .then(({ scans }: { scans: { status: string; pillarScores: string | null }[] }) => {
        const done = scans.filter((s) => s.status === "complete" && s.pillarScores);
        if (!done.length) { setData([]); return; }
        const acc: Record<string, number[]> = {};
        for (const s of done) {
          const ps = JSON.parse(s.pillarScores!);
          for (const [k, v] of Object.entries<number>(ps)) (acc[k] ||= []).push(v);
        }
        const labels: Record<string, string> = {
          Legal: t("legal"), Technical: t("technical"), Organisational: t("organisational"), Awareness: t("awareness"),
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
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid />
        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 12 }} />
        <Radar dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.35} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}
