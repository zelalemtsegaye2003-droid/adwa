"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { SeverityBadge, StatusBadge, type ScanBriefDTO, type ResultDTO } from "./shared";

export function FindingsView() {
  const { t, lang } = useI18n();
  const [scans, setScans] = useState<ScanBriefDTO[]>([]);
  const [scanFilter, setScanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  // Keyed data: rows are valid only while data.key === scanFilter (avoids sync setState in effect)
  const [data, setData] = useState<{ key: string; rows: ResultDTO[] } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scans").then((r) => r.json()).then((d) => setScans(d.scans)).catch(() => {});
  }, []);

  const completed = scans.filter((s) => s.status === "complete");

  useEffect(() => {
    const key = scanFilter;
    const ids = key === "all" ? completed.map((s) => s.id) : [key];
    let cancelled = false;
    Promise.all(
      ids.map((id) => fetch(`/api/scans/${id}`).then((r) => r.json()))
    )
      .then((datas) => {
        if (cancelled) return;
        const all: ResultDTO[] = [];
        for (const d of datas) {
          for (const res of d.scan?.results ?? []) {
            if (res.answer === "no" || res.answer === "partial") all.push(res);
          }
        }
        all.sort((a, b) => (b.riskRank ?? 0) - (a.riskRank ?? 0));
        setData({ key, rows: all });
      })
      .catch(() => { if (!cancelled) setData({ key, rows: [] }); });
    return () => { cancelled = true; };
  }, [scanFilter, scans]);

  const rows = data?.key === scanFilter ? data.rows : null;

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.rule.severity !== severityFilter) return false;
      return true;
    });
  }, [rows, statusFilter, severityFilter]);

  const scanName = (id: string) => scans.find((s) => s.id === id)?.name ?? id;

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const res = await fetch(`/api/findings/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    setUpdating(null);
    if (!res.ok) { toast.error((await res.json()).error ?? "Error"); return; }
    setData((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, status } : r)) } : prev
    );
    toast.success(`${t("status")}: ${status}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("findTitle")}</h2>
        <p className="text-muted-foreground">{t("findSub")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
        <Select value={scanFilter} onValueChange={setScanFilter}>
          <SelectTrigger aria-label={t("allScans")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allScans")}</SelectItem>
            {completed.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label={t("allStatuses")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="open">{t("stOpen")}</SelectItem>
            <SelectItem value="in_progress">{t("stProgress")}</SelectItem>
            <SelectItem value="remediated">{t("stRemediated")}</SelectItem>
            <SelectItem value="waived">{t("stWaived")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSeverities")}</SelectItem>
            <SelectItem value="critical">{t("critical")}</SelectItem>
            <SelectItem value="high">{t("high")}</SelectItem>
            <SelectItem value="medium">{t("medium")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered === null ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">—</p>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-360px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("rule")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("navScans")}</TableHead>
                    <TableHead>{t("risk")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-72">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-semibold">{r.rule.code}</code>
                          <SeverityBadge severity={r.rule.severity} />
                        </div>
                        <p className="text-sm mt-1 font-medium">{lang === "en" ? r.rule.titleEn : r.rule.titleAm}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.rule.article} · {r.rule.penaltyRef}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{scanName(r.scanId)}</TableCell>
                      <TableCell className="font-bold tabular-nums">{r.riskRank?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)} disabled={updating === r.id}>
                            <SelectTrigger className="h-7 w-7 border-0 p-0 justify-center" aria-label={`${t("status")} ${r.rule.code}`}>
                              <span className="text-xs text-muted-foreground">⋯</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">{t("stOpen")}</SelectItem>
                              <SelectItem value="in_progress">{t("stProgress")}</SelectItem>
                              <SelectItem value="remediated">{t("stRemediated")}</SelectItem>
                              <SelectItem value="waived">{t("stWaived")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
