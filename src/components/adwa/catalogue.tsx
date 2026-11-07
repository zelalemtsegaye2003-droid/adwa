"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Scale, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SeverityBadge, PillarBadge, RuleTitle, type RuleDTO } from "./shared";

export function CatalogueView() {
  const { t, lang } = useI18n();
  const [rules, setRules] = useState<RuleDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [article, setArticle] = useState("all");
  const [pillar, setPillar] = useState("all");
  const [severity, setSeverity] = useState("all");

  useEffect(() => {
    fetch("/api/rules").then((r) => r.json()).then((d) => setRules(d.rules)).catch(() => setRules([]));
  }, []);

  const articles = useMemo(() => [...new Set((rules ?? []).map((r) => r.article))], [rules]);

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
          <SelectTrigger aria-label={t("allArticles")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allArticles")}</SelectItem>
            {articles.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pillar} onValueChange={setPillar}>
          <SelectTrigger aria-label={t("allPillars")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPillars")}</SelectItem>
            {["Legal", "Technical", "Organisational", "Awareness"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSeverities")}</SelectItem>
            <SelectItem value="critical">{t("critical")}</SelectItem>
            <SelectItem value="high">{t("high")}</SelectItem>
            <SelectItem value="medium">{t("medium")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} / {rules?.length ?? 47} rules
      </p>

      {/* Rule list */}
      <ScrollArea className="max-h-[calc(100vh-320px)] pr-3">
        <div className="space-y-3">
          {!rules && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          {rules && filtered.map((r) => (
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
                    <span className="text-xs text-muted-foreground">{t("priority")}: {r.priority} · {t("weight")}: {r.weight}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
