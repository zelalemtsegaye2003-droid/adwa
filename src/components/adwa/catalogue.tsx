"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Scale, Gavel, Landmark, FolderLock, FileCheck2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";
import { useAuth } from "@/components/auth/auth-gate";
import { SeverityBadge, PillarBadge, RuleTitle, FrameworkBadge, type RuleDTO, type FrameworkDTO } from "./shared";

// Rules Engine: evidence coverage DTOs (mirrors /api/rules/coverage)
interface CoverageEvidenceDto {
  evidenceId: string; title: string; version: number; ageDays: number; fresh: boolean;
}
interface CoverageDto {
  ruleCode: string;
  status: "SATISFIED" | "STALE" | "GAP";
  evidence: CoverageEvidenceDto[];
}
interface CoverageResponse {
  summary: { total: number; satisfied: number; stale: number; gap: number; coveragePercent: number };
  coverage: CoverageDto[];
}

export function CatalogueView() {
  const { t, lang } = useI18n();
  const { me } = useAuth();
  const [frameworks, setFrameworks] = useState<FrameworkDTO[] | null>(null);
  const [fwCode, setFwCode] = useState<string>("PD-1321");
  // Keyed data: rules are valid only while data.key === fwCode (avoids sync setState in effect)
  const [data, setData] = useState<{ key: string; rules: RuleDTO[] } | null>(null);
  const [q, setQ] = useState("");
  const [article, setArticle] = useState("all");
  const [pillar, setPillar] = useState("all");
  const [severity, setSeverity] = useState("all");

  // Rules Engine: evidence coverage scope (org users → own tenant; super admin picks)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [covOrgId, setCovOrgId] = useState<string>("");
  const [coverage, setCoverage] = useState<{ key: string; map: Map<string, CoverageDto>; summary: CoverageResponse["summary"] | null } | null>(null);

  useEffect(() => {
    api<{ organizations: { id: string; name: string }[] }>("/api/organizations")
      .then((d) => {
        setOrgs(d.organizations.map((o) => ({ id: o.id, name: o.name })));
        setCovOrgId((cur) => cur || me.user.orgId || d.organizations[0]?.id || "");
      })
      .catch(() => {});
  }, [me.user.orgId]);

  useEffect(() => {
    if (!covOrgId || !fwCode) return;
    let cancelled = false;
    api<CoverageResponse>(`/api/rules/coverage?org=${covOrgId}&framework=${encodeURIComponent(fwCode)}`)
      .then((d) => {
        if (!cancelled) setCoverage({ key: `${covOrgId}:${fwCode}`, map: new Map(d.coverage.map((c) => [c.ruleCode, c])), summary: d.summary });
      })
      .catch(() => { if (!cancelled) setCoverage({ key: `${covOrgId}:${fwCode}`, map: new Map(), summary: null }); });
    return () => { cancelled = true; };
  }, [covOrgId, fwCode]);

  useEffect(() => {
    api<{ frameworks: FrameworkDTO[] }>("/api/frameworks")
      .then((d) => {
        setFrameworks(d.frameworks);
        if (d.frameworks.length > 0 && !d.frameworks.some((f) => f.code === "PD-1321")) {
          setFwCode(d.frameworks[0].code);
        }
      })
      .catch(() => setFrameworks([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ rules: RuleDTO[] }>(`/api/rules?framework=${encodeURIComponent(fwCode)}`)
      .then((d) => { if (!cancelled) setData({ key: fwCode, rules: d.rules }); })
      .catch(() => { if (!cancelled) setData({ key: fwCode, rules: [] }); });
    return () => { cancelled = true; };
  }, [fwCode]);

  const rules = data?.key === fwCode ? data.rules : null;
  const cov = coverage?.key === `${covOrgId}:${fwCode}` ? coverage : null;
  const covMap = cov?.map ?? null;

  // Switching framework resets dependent filters (event handler, not an effect)
  const switchFramework = (code: string) => {
    setFwCode(code);
    setArticle("all");
    setPillar("all");
  };

  const active = frameworks?.find((f) => f.code === fwCode) ?? null;

  const articles = useMemo(() => [...new Set((rules ?? []).map((r) => r.article))], [rules]);
  const pillars = active?.pillars.map((p) => p.name) ?? [];

  const filtered = useMemo(() => {
    if (!rules) return [];
    const needle = q.trim().toLowerCase();
    return rules.filter((r) => {
      if (article !== "all" && r.article !== article) return false;
      if (pillar !== "all" && r.pillar !== pillar) return false;
      if (severity !== "all" && r.severity !== severity) return false;
      if (needle) {
        const hay = `${r.code} ${r.titleEn} ${r.titleAm} ${r.statementEn} ${r.article}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rules, q, article, pillar, severity]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("catTitle")}</h2>
        <p className="text-muted-foreground">{t("catSub")}</p>
      </div>

      {/* Framework switcher */}
      {frameworks && frameworks.length > 0 && (
        <div className="space-y-3">
          <Tabs value={fwCode} onValueChange={switchFramework}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
              {frameworks.map((f) => (
                <TabsTrigger
                  key={f.code}
                  value={f.code}
                  className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white px-3 py-1.5"
                >
                  {lang === "en" ? f.name : f.nameAm}
                  <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-[11px] tabular-nums dark:bg-white/20">
                    {f.ruleCount}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {active && (
            <Card className="border-l-4 border-l-emerald-700">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Landmark className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{lang === "en" ? active.name : active.nameAm}</p>
                    <FrameworkBadge code={active.code} />
                    <span className="text-xs text-muted-foreground">{active.instrumentNo}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {lang === "en" ? active.descriptionEn : active.descriptionAm}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("issuer")}: {active.issuer} · {active.instrument} · {active.ruleCount} {t("obligations")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Rules Engine: coverage summary + org scope */}
      {cov?.summary && (
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <FolderLock className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{t("evCoverage")}</p>
                <p className="text-xs text-muted-foreground">
                  {cov.summary.satisfied}/{cov.summary.total} {t("evSatisfiedShort")} · {cov.summary.coveragePercent}%
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
              <span className="text-amber-600 dark:text-amber-400">⏱ {cov.summary.stale} {t("evStaleShort")}</span>
              <span className="text-red-600 dark:text-red-400">✗ {cov.summary.gap} {t("evGapShort")}</span>
            </div>
            {orgs.length > 1 && (
              <Select value={covOrgId} onValueChange={setCovOrgId}>
                <SelectTrigger className="w-full sm:w-56" aria-label={t("org")}>
                  <SelectValue placeholder={t("org")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <Select value={article} onValueChange={setArticle}>
          <SelectTrigger className="w-full" aria-label={t("allArticles")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allArticles")}</SelectItem>
            {articles.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pillar} onValueChange={setPillar}>
          <SelectTrigger className="w-full" aria-label={t("allPillars")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPillars")}</SelectItem>
            {pillars.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-full" aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSeverities")}</SelectItem>
            <SelectItem value="critical">{t("critical")}</SelectItem>
            <SelectItem value="high">{t("high")}</SelectItem>
            <SelectItem value="medium">{t("medium")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} / {rules?.length ?? "…"} {t("obligations")}
      </p>

      {/* Rule list */}
      <ScrollArea className="max-h-[calc(100vh-380px)] pr-4">
        <div className="space-y-3">
          {!rules && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          {rules && filtered.map((r) => {
            const c = covMap?.get(r.code) ?? null;
            return (
            <Card key={r.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.code}</code>
                      <span className="font-semibold"><RuleTitle rule={r} /></span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {lang === "en" ? r.statementEn : r.statementAm}
                    </p>
                    {c && c.evidence.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.evidence.slice(0, 2).map((e) => (
                          <span
                            key={e.evidenceId}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                              e.fresh
                                ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                            title={`${e.title} · v${e.version} · ${e.ageDays}d`}
                          >
                            <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{e.title}</span>
                          </span>
                        ))}
                        {c.evidence.length > 2 && (
                          <span className="inline-flex items-center px-1 text-xs text-muted-foreground">+{c.evidence.length - 2}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                      <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span><span className="font-medium">{t("checkLogic")}:</span> {r.checkLogic}</span>
                    </div>
                    <div className="mt-1.5 flex items-start gap-2 text-xs text-muted-foreground">
                      <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                      <span><span className="font-medium">{t("penalty")}:</span> {r.penaltyRef}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <SeverityBadge severity={r.severity} />
                    <PillarBadge pillar={r.pillar} />
                    {c?.status === "SATISFIED" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" title={t("evSatisfiedFull")}>
                        ✓ {t("evEvidenceOnFile")} ({c.evidence.length})
                      </span>
                    )}
                    {c?.status === "STALE" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300" title={t("evStaleFull")}>
                        ⏱ {t("evStaleEvidence")}
                      </span>
                    )}
                    {c?.status === "GAP" && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400" title={t("evNoEvidence")}>
                        — {t("evNoEvidence")}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{t("priority")}: {r.priority} · {t("weight")}: {r.weight}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
