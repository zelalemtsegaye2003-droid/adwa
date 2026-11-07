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
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { SeverityBadge, StatusBadge, FrameworkBadge, type ScanBriefDTO, type ScanDetailDTO, type ResultDTO } from "./shared";

export function FindingsView() {
  const { t, lang } = useI18n();
  const [scans, setScans] = useState<ScanBriefDTO[]>([]);
  const [scanFilter, setScanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
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

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.rule.severity !== severityFilter) return false;
      return true;
    });
  }, [rows, statusFilter, severityFilter]);

  const scanName = (id: string) => scans.find((s) => s.id === id)?.name ?? id;

  const updateStatus = async (id: string, status: string, note?: string) => {
    setUpdating(id);
    try {
      await api(`/api/findings/${id}`, {
        method: "PATCH", body: JSON.stringify({ status, note }),
      });
    } catch (err) {
      setUpdating(null);
      toast.error(err instanceof ApiCallError ? err.message : "Error");
      return;
    }
    setUpdating(null);
    setData((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, status } : r)) } : prev
    );
    toast.success(`${t("status")}: ${status}`);
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("findTitle")}</h2>
        <p className="text-muted-foreground">{t("findSub")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
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
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <FrameworkBadge code={scans.find((s) => s.id === r.scanId)?.framework?.code} />
                          <span className="text-sm text-muted-foreground">{scanName(r.scanId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold tabular-nums">{r.riskRank?.toFixed(1) ?? "—"}</TableCell>
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
