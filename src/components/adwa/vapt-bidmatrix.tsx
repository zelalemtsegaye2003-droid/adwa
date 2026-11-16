"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, ClipboardCheck, CircleDot, CheckCircle2, Milestone } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";

// ── DTOs (mirror /api/vapt/bid-matrix) ───────────────────────────────────────

type BidStatus = "full" | "partial" | "roadmap";

interface BidRequirementDTO {
  id: string;
  section: string;
  text: string;
  mandatory: boolean;
  status: BidStatus;
  response: string;
  capability: string;
  evidence: string;
  note?: string;
}

interface BidSectionDTO {
  id: string;
  title: string;
  titleAm: string;
  total?: number;
  full?: number;
  partial?: number;
  roadmap?: number;
}

interface BidMatrixDTO {
  summary: {
    reference: string;
    dueDate: string;
    total: number;
    mandatory: number;
    full: number;
    partial: number;
    roadmap: number;
    fullPct: number;
    partialPct: number;
    roadmapPct: number;
    sections: BidSectionDTO[];
  };
  sections: BidSectionDTO[];
  requirements: BidRequirementDTO[];
}

// ── status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: BidStatus }) {
  const { t } = useI18n();
  const conf = {
    full: { label: t("bidStFull"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800", icon: CheckCircle2 },
    partial: { label: t("bidStPartial"), cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", icon: CircleDot },
    roadmap: { label: t("bidStRoadmap"), cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700", icon: Milestone },
  }[status];
  return (
    <Badge variant="outline" className={`${conf.cls} whitespace-nowrap hover:bg-transparent gap-1`}>
      <conf.icon className="h-3 w-3" aria-hidden /> {conf.label}
    </Badge>
  );
}

// ── main tab ──────────────────────────────────────────────────────────────────

export function BidMatrixTab() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<BidMatrixDTO | null>(null);
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<BidMatrixDTO>("/api/vapt/bid-matrix").then(setData).catch(() => {});
  }, []);

  const refresh = useCallback((sec: string, st: string) => {
    const params = new URLSearchParams();
    if (sec !== "all") params.set("section", sec);
    if (st !== "all") params.set("status", st);
    const qs = params.toString();
    api<BidMatrixDTO>(`/api/vapt/bid-matrix${qs ? `?${qs}` : ""}`).then(setData).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.requirements.filter((r) => {
      if (needle) {
        const hay = `${r.id} ${r.text} ${r.response} ${r.capability} ${r.evidence}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, q]);

  const downloadCsv = async () => {
    try {
      const res = await fetch("/api/vapt/bid-matrix?format=csv", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const text = await res.text();
      const blob = new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "adwa-cyber-nbe-lot4-bid-matrix.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("bidCsvError"));
    }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const s = data.summary;
  const sectionOf = (id: string) => data.sections.find((x) => x.id === id);

  return (
    <div className="space-y-6">
      {/* compliance split cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("bidTotalLines")}</p>
              <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("bidAllMandatory")}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("bidStFull")}</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{s.full} <span className="text-base font-semibold">({s.fullPct}%)</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{t("bidFullHint")}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("bidStPartial")}</p>
              <CircleDot className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{s.partial} <span className="text-base font-semibold">({s.partialPct}%)</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{t("bidPartialHint")}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("bidStRoadmap")}</p>
              <Milestone className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700 dark:text-slate-300">{s.roadmap} <span className="text-base font-semibold">({s.roadmapPct}%)</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{t("bidRoadmapHint")}</p>
          </CardContent>
        </Card>
      </div>

      {/* split bar */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t("bidSplitTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("bidSplitSub")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> CSV
            </Button>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t("bidSplitTitle")}>
            <div className="bg-emerald-600" style={{ width: `${s.fullPct}%` }} />
            <div className="bg-amber-500" style={{ width: `${s.partialPct}%` }} />
            <div className="bg-slate-400 dark:bg-slate-600" style={{ width: `${s.roadmapPct}%` }} />
          </div>
          <Progress value={0} className="hidden" aria-hidden />
        </CardContent>
      </Card>

      {/* filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={section} onValueChange={(v) => { setSection(v); refresh(v, status); }}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("bidAllSections")}</SelectItem>
            {data.sections.map((sec) => (
              <SelectItem key={sec.id} value={sec.id}>{sec.id} — {lang === "am" ? sec.titleAm : sec.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); refresh(section, v); }}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("bidAllStatuses")}</SelectItem>
            <SelectItem value="full">{t("bidStFull")}</SelectItem>
            <SelectItem value="partial">{t("bidStPartial")}</SelectItem>
            <SelectItem value="roadmap">{t("bidStRoadmap")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("bidSearchPh")}
          className="w-full sm:w-72"
        />
        <Badge variant="outline" className="ml-auto whitespace-nowrap bg-muted/50 hover:bg-transparent">
          {rows.length} / {s.total} {t("bidRows")}
        </Badge>
      </div>

      {/* matrix table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-700" aria-hidden />
            {t("bidTableTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("bidTableSub", s.reference, s.dueDate)}</p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[560px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-14 text-center">{t("bidColLine")}</TableHead>
                  <TableHead className="min-w-[280px]">{t("bidColReq")}</TableHead>
                  <TableHead className="w-10 text-center">M</TableHead>
                  <TableHead className="w-40">{t("bidColStatus")}</TableHead>
                  <TableHead className="min-w-[320px]">{t("bidColResponse")}</TableHead>
                  <TableHead className="min-w-[260px]">{t("bidColCapability")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{t("bidNoRows")}</TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell>
                      <p className="text-sm leading-snug">{r.text}</p>
                      {r.note && <p className="mt-1 text-xs text-muted-foreground italic">{r.note}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <CircleDot className="mr-1 inline h-3 w-3" aria-hidden />
                        {sectionOf(r.section)?.id} — {lang === "am" ? sectionOf(r.section)?.titleAm : sectionOf(r.section)?.title}
                      </p>
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold text-red-700 dark:text-red-400">{r.mandatory ? "M" : ""}</TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
                    <TableCell className="text-sm leading-snug text-muted-foreground">{r.response}</TableCell>
                    <TableCell>
                      <p className="text-sm leading-snug">{r.capability}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.evidence}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
