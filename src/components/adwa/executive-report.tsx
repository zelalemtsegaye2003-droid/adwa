"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Printer, FileText, Download, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { toast } from "sonner";
import { SeverityBadge, ScoreRing, FrameworkBadge, scoreColor, fmtDate, type ScanBriefDTO, type ScanDetailDTO, type ResultDTO } from "./shared";

export function ExecutiveReport({ scanId }: { scanId?: string | null }) {
  const { t, lang } = useI18n();
  const [scans, setScans] = useState<ScanBriefDTO[]>([]);
  // User's explicit dropdown choice; the effective selection derives from it
  const [userSelected, setUserSelected] = useState<string | null>(scanId ?? null);
  const [detail, setDetail] = useState<ScanDetailDTO | null>(null);

  useEffect(() => {
    api<{ scans: ScanBriefDTO[] }>("/api/scans").then((d) => {
      setScans((d.scans).filter((s) => s.status === "complete"));
    }).catch(() => {});
  }, []);

  // Derived: prop override → user choice → most recent completed scan
  const selected = scanId ?? userSelected ?? scans[0]?.id ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api<{ scan: ScanDetailDTO }>(`/api/scans/${selected}`)
      .then((d) => { if (!cancelled) setDetail(d.scan); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected]);

  const findings = useMemo(
    () => (detail?.results ?? []).filter((r) => r.answer === "no" || r.answer === "partial") as ResultDTO[],
    [detail]
  );

  const plan = useMemo(
    () => [...findings].sort((a, b) => (b.riskRank ?? 0) - (a.riskRank ?? 0)).slice(0, 10),
    [findings]
  );

  // Server-side PDF export (bilingual; respects the current UI language).
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    if (!selected || pdfBusy) return;
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/scans/${selected}/report?lang=${lang}`, {
        method: "GET",
        headers: { Accept: "application/pdf" },
      });
      if (!res.ok) {
        let message = `Export failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new ApiCallError(res.status, { code: "EXPORT_FAILED", message });
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =`Adwa_Report_${detail?.organization?.name?.replace(/[^A-Za-z0-9]+/g, "-") ?? "scan"}_${detail?.completedAt?.slice(0, 10) ?? ""}_${lang.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(t("repPdfReady"));
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Export failed");
    } finally {
      setPdfBusy(false);
    }
  };

  const pillarScores: Record<string, number> = useMemo(
    () => (detail?.pillarScores ? JSON.parse(detail.pillarScores) : {}),
    [detail]
  );

  const severityData = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0 };
    for (const f of findings) c[f.rule.severity as keyof typeof c]++;
    return [
      { name: t("critical"), value: c.critical, color: "#DC2626" },
      { name: t("high"), value: c.high, color: "#D97706" },
      { name: t("medium"), value: c.medium, color: "#EAB308" },
    ].filter((d) => d.value > 0);
  }, [findings, t]);

  const articleData = useMemo(() => {
    const m = new Map<string, { flagged: number; total: number }>();
    for (const r of detail?.results ?? []) {
      const e = m.get(r.rule.article) ?? { flagged: 0, total: 0 };
      e.total++;
      if (r.answer === "no" || r.answer === "partial") e.flagged++;
      m.set(r.rule.article, e);
    }
    return [...m.entries()].map(([article, v]) => ({
      article,
      rate: Math.round((v.flagged / v.total) * 100),
      label: `${v.flagged}/${v.total}`,
    }));
  }, [detail]);

  if (scans.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">{t("repTitle")}</h2>
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("noData")}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("repTitle")}</h2>
          <p className="text-muted-foreground">{t("repSub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selected ?? undefined} onValueChange={setUserSelected}>
            <SelectTrigger className="w-64" aria-label={t("navScans")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {scans.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.organization?.name} — {s.name}{s.framework ? ` [${s.framework.code}]` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> {t("print")}
          </Button>
          <Button onClick={downloadPdf} disabled={pdfBusy || !detail || detail.id !== selected} className="bg-emerald-700 text-white hover:bg-emerald-800">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {t("repDownloadPdf")}
          </Button>
        </div>
      </div>

      {!detail || detail.id !== selected ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6" id="report-body">
          {/* Report header */}
          <Card className="border-l-4 border-l-emerald-700 print:border-l-2">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" aria-hidden />
                    {t("repTitle")} — {detail.framework?.name ?? "Personal Data Protection"}
                    <FrameworkBadge code={detail.framework?.code} full />
                  </div>
                  <h3 className="mt-1 text-xl font-bold">{detail.organization.name}</h3>
                  <p className="text-sm text-muted-foreground">{detail.name}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("auditor")}: {detail.auditorName ?? "Adwa Compliance Engine"} · {t("completedOn")}: {fmtDate(detail.completedAt)}
                  </p>
                </div>
                <div className="text-center">
                  <ScoreRing score={detail.overallScore ?? 0} size={130} label={t("overallScore")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score + pillars + severity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("pillarPerf")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(pillarScores).map(([pillar, score]) => (
                  <div key={pillar}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{pillar}</span>
                      <span className={`font-bold tabular-nums ${scoreColor(score)}`}>{score}%</span>
                    </div>
                    <Progress value={score} className="h-2" aria-label={pillar} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("findingsSummary")}</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center gap-6">
                {severityData.length ? (
                  <ResponsiveContainer width="55%" height={180}>
                    <PieChart>
                      <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                        {severityData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">✓ 0</p>
                )}
                <div className="space-y-2 text-sm">
                  <p><span className="font-bold text-2xl block">{findings.length}</span>{t("findings")}</p>
                  <p><span className="font-bold text-red-600 dark:text-red-400 text-xl block">{detail.criticalFindings}</span>{t("critical")}</p>
                  <p className="text-xs text-muted-foreground">
                    {findings.filter((f) => f.status === "remediated").length} {t("stRemediated").toLowerCase()} · {" "}
                    {findings.filter((f) => f.status === "in_progress").length} {t("stProgress").toLowerCase()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("timeComparison")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {detail.durationMinutes?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  vs 40–80 hours manual audit — <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {Math.max(0, Math.round((1 - (detail.durationMinutes ?? 0) / 60 / 40) * 1000) / 10)}% reduction
                  </span> (RQ1 threshold &gt;70%)
                </p>
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Manual</p>
                    <p className="font-semibold">40–80 h</p>
                  </div>
                  <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950 p-2">
                    <p className="text-xs text-muted-foreground">Adwa Engine</p>
                    <p className="font-semibold">{detail.durationMinutes?.toFixed(0) ?? "—"} min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Article coverage */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("articleRisk")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={articleData} margin={{ left: 0, right: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="article"
                    tick={{ fontSize: 9.5 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={72}
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(_v, _n, p) => [`${p.payload.label} rules flagged`, p.payload.article]} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {articleData.map((a) => (
                      <Cell key={a.article} fill={a.rate >= 75 ? "#DC2626" : a.rate >= 40 ? "#D97706" : "#059669"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top remediation priorities */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("topRemediation")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{t("rule")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("penalty")}</TableHead>
                    <TableHead>{t("risk")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((f, i) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-semibold">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-semibold">{f.rule.code}</code>
                          <SeverityBadge severity={f.rule.severity} />
                        </div>
                        <p className="text-sm font-medium mt-0.5">{lang === "en" ? f.rule.titleEn : f.rule.titleAm}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? f.rule.remediationEn : f.rule.remediationAm}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{f.rule.penaltyRef}</TableCell>
                      <TableCell className="font-bold tabular-nums">{f.riskRank?.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
