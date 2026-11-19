"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock3, ShieldCheck, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { slaInfo } from "@/lib/compliance/sla";
import { SeverityBadge, StatusBadge, FrameworkBadge, SlaBadge, type ScanBriefDTO, type ScanDetailDTO, type ResultDTO } from "./shared";

export function FindingsView() {
  const { t, lang } = useI18n();
  const [scans, setScans] = useState<ScanBriefDTO[]>([]);
  const [scanFilter, setScanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  // Keyed data: rows are valid only while data.key === scanFilter (avoids sync setState in effect)
  const [data, setData] = useState<{ key: string; rows: ResultDTO[] } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  // Waiver flow: a justification note is required before the status becomes "waived".
  const [waiveTarget, setWaiveTarget] = useState<ResultDTO | null>(null);
  const [waiveNote, setWaiveNote] = useState("");
  const [waiveBusy, setWaiveBusy] = useState(false);

  useEffect(() => {
    api<{ scans: typeof scans }>("/api/scans").then((d) => setScans(d.scans)).catch(() => {});
  }, []);

  const completed = scans.filter((s) => s.status === "complete");

  useEffect(() => {
    const key = scanFilter;
    const ids = key === "all" ? completed.map((s) => s.id) : [key];
    let cancelled = false;
    Promise.all(
      ids.map((id) => api<{ scan: ScanDetailDTO }>(`/api/scans/${id}`))
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

  // SLA state per finding (computed client-side from dueAt/remediatedAt).
  const slaOf = (r: ResultDTO) =>
    slaInfo({ status: r.status, dueAt: r.dueAt ?? null, remediatedAt: r.remediatedAt ?? null });

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.rule.severity !== severityFilter) return false;
      if (slaFilter !== "all" && slaOf(r).state !== slaFilter) return false;
      return true;
    });
  }, [rows, statusFilter, severityFilter, slaFilter]);

  // SLA summary chips over the (unfiltered-by-sla) current scan scope.
  const slaCounts = useMemo(() => {
    if (!rows) return null;
    const c = { overdue: 0, dueSoon: 0, onTrack: 0, closedLate: 0, closedOnTime: 0, waived: 0, notTracked: 0 };
    for (const r of rows) {
      const s = slaOf(r).state;
      if (s === "OVERDUE") c.overdue++;
      else if (s === "DUE_SOON") c.dueSoon++;
      else if (s === "ON_TRACK") c.onTrack++;
      else if (s === "CLOSED_LATE") c.closedLate++;
      else if (s === "CLOSED_ON_TIME") c.closedOnTime++;
      else if (s === "WAIVED") c.waived++;
      else c.notTracked++;
    }
    return c;
  }, [rows]);

  const scanName = (id: string) => scans.find((s) => s.id === id)?.name ?? id;

  const updateStatus = async (id: string, status: string, note?: string) => {
    setUpdating(id);
    try {
      const res = await api<{ result: ResultDTO }>(`/api/findings/${id}`, {
        method: "PATCH", body: JSON.stringify({ status, note }),
      });
      // merge the server-truth row (fresh remediatedAt / dueAt) back into the table
      setData((prev) =>
        prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, status: res.result?.status ?? status, dueAt: res.result?.dueAt ?? r.dueAt, remediatedAt: res.result?.remediatedAt ?? r.remediatedAt } : r)) } : prev
      );
      setUpdating(null);
      toast.success(`${t("status")}: ${status}`);
    } catch (err) {
      setUpdating(null);
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    }
  };

  const requestStatus = (r: ResultDTO, status: string) => {
    if (status === "waived") {
      setWaiveTarget(r);
      setWaiveNote("");
      return;
    }
    updateStatus(r.id, status);
  };

  const confirmWaive = async () => {
    if (!waiveTarget) return;
    if (waiveNote.trim().length < 5) {
      toast.error(t("noteRequired"));
      return;
    }
    setWaiveBusy(true);
    await updateStatus(waiveTarget.id, "waived", waiveNote.trim());
    setWaiveBusy(false);
    setWaiveTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Remediation SLA summary (Procl. 1426/2026 corrective-action timelines) */}
      {slaCounts && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-red-600">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-bold tabular-nums leading-none">{slaCounts.overdue}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("slaOverdueCard")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Clock3 className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-bold tabular-nums leading-none">{slaCounts.dueSoon}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("slaDueSoonCard")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-600">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-bold tabular-nums leading-none">{slaCounts.onTrack}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("slaOnTrack")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                <TimerOff className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-bold tabular-nums leading-none">{slaCounts.closedLate}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("slaClosedLateCard")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl">
        <Select value={scanFilter} onValueChange={setScanFilter}>
          <SelectTrigger aria-label={t("allScans")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allScans")}</SelectItem>
            {completed.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
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
        <Select value={slaFilter} onValueChange={setSlaFilter}>
          <SelectTrigger aria-label={t("slaAllStates")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("slaAllStates")}</SelectItem>
            <SelectItem value="OVERDUE">{t("slaOverdue")}</SelectItem>
            <SelectItem value="DUE_SOON">{t("slaDueSoon")}</SelectItem>
            <SelectItem value="ON_TRACK">{t("slaOnTrack")}</SelectItem>
            <SelectItem value="CLOSED_LATE">{t("slaClosedLate")}</SelectItem>
            <SelectItem value="CLOSED_ON_TIME">{t("slaClosedOnTime")}</SelectItem>
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
                    <TableHead>{t("slaTitle")}</TableHead>
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
                        {/* VAPT mirror rows carry the underlying vulnerability detail */}
                        {scans.find((s) => s.id === r.scanId)?.mode === "vapt" && (r.findingEn || r.findingAm) && (
                          <p className="mt-1 rounded-md bg-muted px-2 py-1 font-mono text-[11px] leading-snug text-muted-foreground">
                            {lang === "en" ? r.findingEn : r.findingAm}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <FrameworkBadge code={scans.find((s) => s.id === r.scanId)?.framework?.code} />
                          <span className="text-sm text-muted-foreground">{scanName(r.scanId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold tabular-nums">{r.riskRank?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>
                        <SlaBadge
                          state={slaOf(r).state}
                          daysRemaining={slaOf(r).daysRemaining}
                          dueAt={r.dueAt ?? null}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          <Select value={r.status} onValueChange={(v) => requestStatus(r, v)} disabled={updating === r.id}>
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

      {/* Waiver justification dialog */}
      <Dialog open={waiveTarget !== null} onOpenChange={(open) => { if (!open) setWaiveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("waiveTitle")}</DialogTitle>
            <DialogDescription>{t("waiveDesc")}</DialogDescription>
          </DialogHeader>
          {waiveTarget && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              <code className="font-semibold">{waiveTarget.rule.code}</code>{" "}
              {lang === "en" ? waiveTarget.rule.titleEn : waiveTarget.rule.titleAm}
            </p>
          )}
          <div className="grid gap-2">
            <label htmlFor="waive-note" className="text-sm font-medium">{t("waiveLabel")}</label>
            <Textarea
              id="waive-note"
              rows={3}
              value={waiveNote}
              onChange={(e) => setWaiveNote(e.target.value)}
              placeholder={t("waivePh")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiveTarget(null)} disabled={waiveBusy}>Cancel</Button>
            <Button onClick={confirmWaive} disabled={waiveBusy} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {t("stWaived")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
