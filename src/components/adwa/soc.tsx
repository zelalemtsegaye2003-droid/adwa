"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, AlertTriangle, Radar, ShieldCheck, Timer, Zap, Radio, ArrowRight,
  BellRing, Flame, Gauge, RefreshCw, Send, Eye, Users2, FileJson, PlugZap, Database,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { SeverityBadge } from "./shared";

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface IncidentRowDTO {
  id: string; ref: string; title: string; titleAm: string;
  category: string; severity: string; status: string;
  source: string; detectionMethod: string;
  priorityScore: number | null; priorityLabel: string | null;
  detectedAt: string; notifiedAt: string | null;
  notificationLatencyMin: number | null; ageMinutes: number;
  organization?: { id: string; name: string; nameAm: string; sector: string };
}

export interface IncidentEventDTO {
  id: string; type: string; note: string | null; createdAt: string;
  actor?: { name: string } | null;
}

export interface IncidentDetailDTO extends IncidentRowDTO {
  description: string | null;
  triagedAt: string | null; containedAt: string | null; eradicatedAt: string | null;
  recoveredAt: string | null; closedAt: string | null;
  events: IncidentEventDTO[];
  indicators: { indicator: IndicatorRowDTO }[];
}

export interface IndicatorRowDTO {
  id: string; type: string; value: string;
  titleEn: string; titleAm: string;
  descriptionEn: string | null;
  category: string; severity: string; tlp: string;
  source: string; sourceRef: string | null;
  confidence: number; sensitivity: number; sharing: string;
  organizationId: string | null; origin: string; originAnonymised: boolean;
  firstSeenAt: string; lastSeenAt: string; sightings: number;
  isActive: boolean; shareCount: number; incidentCount: number;
}

export interface MetricsDTO {
  scope: string;
  organization: { id: string; name: string; sector: string } | null;
  incidents: { total: number; open: number; byStatus: Record<string, number>; openBySeverity: Record<string, number>; immediate: number };
  rq3: {
    targetMinutes: number;
    latency: { count: number; medianMin: number | null; p90Min: number | null; minMin: number | null; maxMin: number | null; withinTarget: number; targetMet: boolean | null };
    financialSector: boolean;
  };
  lifecycle: { mttaMin: number | null; mttcMin: number | null; mttrMin: number | null };
  threatIntel: { activeIndicators: number; bySource: Record<string, number>; shares: { hub: number; peer: number } };
  forecast: { category: string; riskIndex: number; activeIndicators: number; recentIncidents: number; drivers: string[] }[];
  recentSyncs: { id: string; direction: string; status: string; source: string; endpoint: string | null; receiptId: string | null; ingested: number; updated: number; reported: number; createdAt: string; detail: string | null }[];
  binding: { mode: "live" | "fixture"; endpoint: string | null; hasKey: boolean };
}

const INCIDENT_STATUSES = ["detected", "triaged", "contained", "eradicated", "recovered", "closed"];
const STATUS_KEY: Record<string, string> = {
  detected: "incDetected", triaged: "incTriaged", contained: "incContained",
  eradicated: "incEradicated", recovered: "incRecovered", closed: "incClosed",
};
const CATEGORY_KEY: Record<string, string> = {
  ransomware: "catRansomware", phishing: "catPhishing", bec: "catBec",
  malware: "catMalware", ddos: "catDdos", credential_stuffing: "catCredentialStuffing",
  apt: "catApt", scam: "catScam", insider: "catInsider", data_breach: "catDataBreach",
  unauthorized_access: "catUnauthorizedAccess", other: "catOther",
};

// ── Badges ───────────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const { t } = useI18n();
  return <Badge variant="outline" className="whitespace-nowrap bg-muted/50 hover:bg-transparent">{t(CATEGORY_KEY[category] ?? "catOther")}</Badge>;
}

function TlpBadge({ tlp }: { tlp: string }) {
  const cls: Record<string, string> = {
    "TLP:RED": "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    "TLP:AMBER+STRICT": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    "TLP:AMBER": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    "TLP:GREEN": "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    "TLP:CLEAR": "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  };
  return <Badge variant="outline" className={`whitespace-nowrap font-mono text-[10px] ${cls[tlp] ?? cls["TLP:AMBER"]} hover:bg-transparent`}>{tlp}</Badge>;
}

function SourceBadge({ source }: { source: string }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    ETHIO_CERT: { label: t("tiSourceNational"), cls: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800" },
    MISP_FEED: { label: t("tiSourceMisp"), cls: "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800" },
    ORG_UPLOAD: { label: t("tiSourceOrg"), cls: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" },
    ANALYST: { label: t("tiSourceAnalyst"), cls: "bg-muted text-muted-foreground border-border" },
  };
  const e = map[source] ?? map.ANALYST;
  return <Badge variant="outline" className={`whitespace-nowrap ${e.cls} hover:bg-transparent`}>{e.label}</Badge>;
}

function IncidentStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    detected: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    triaged: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    contained: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    eradicated: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
    recovered: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    closed: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  };
  return <Badge variant="outline" className={`whitespace-nowrap ${map[status] ?? map.detected} hover:bg-transparent`}>{t(STATUS_KEY[status] ?? "incDetected")}</Badge>;
}

function PriorityBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const cls =
    label === "IMMEDIATE"
      ? "bg-red-600 text-white border-red-700"
      : label === "HIGH"
        ? "bg-amber-500 text-white border-amber-600"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className={`${cls} hover:${cls} tabular-nums`}>{Math.round(score)}</Badge>
      {label === "IMMEDIATE" && <Flame className="h-3.5 w-3.5 text-red-600" aria-hidden />}
    </span>
  );
}

function LatencyChip({ minutes }: { minutes: number | null }) {
  const { t } = useI18n();
  if (minutes === null) return <span className="text-xs text-muted-foreground">—</span>;
  const ok = minutes <= 15;
  return (
    <Badge variant="outline" className={`tabular-nums whitespace-nowrap ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" : "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"} hover:bg-transparent`}>
      <Timer className="mr-1 h-3 w-3" aria-hidden />
      {t("incMinutes", minutes.toFixed(1))}
    </Badge>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export function SocView({
  canManage,
  canSync,
  isSuperAdmin,
}: {
  canManage: boolean;
  canSync: boolean;
  isSuperAdmin: boolean;
}) {
  const { t, lang } = useI18n();
  const [metrics, setMetrics] = useState<MetricsDTO | null>(null);

  const refreshMetrics = useCallback(() => {
    api<MetricsDTO>("/api/soc/metrics").then(setMetrics).catch(() => {});
  }, []);

  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-end gap-3">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
          {t("socPhaseBadge")}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("socOverview")}</TabsTrigger>
          <TabsTrigger value="incidents">{t("socIncidents")}</TabsTrigger>
          <TabsTrigger value="threats">{t("socThreats")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SocOverview metrics={metrics} />
        </TabsContent>
        <TabsContent value="incidents" className="mt-4">
          <IncidentsTab canManage={canManage} onChanged={refreshMetrics} isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        <TabsContent value="threats" className="mt-4">
          <ThreatsTab canManage={canManage} canSync={canSync} isSuperAdmin={isSuperAdmin} onChanged={refreshMetrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function SocOverview({ metrics }: { metrics: MetricsDTO | null }) {
  const { t } = useI18n();

  if (!metrics) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { incidents, rq3, lifecycle, threatIntel, forecast, recentSyncs, binding } = metrics;
  const criticalOpen = incidents.openBySeverity.critical ?? 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-red-600">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">{incidents.open}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("socOpenIncidents")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              <Flame className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">{criticalOpen}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("socCriticalOpen")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${rq3.latency.targetMet === false ? "border-l-red-600" : "border-l-emerald-600"}`}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${rq3.latency.targetMet === false ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
              <Timer className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">
                {rq3.latency.medianMin !== null ? `${rq3.latency.medianMin}′` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("socNotifiedLatency")} · {t("socRq3Target")}
                {rq3.latency.medianMin !== null && (
                  ` · ${rq3.latency.targetMet ? t("socRq3Met") : t("socRq3Missed")}`
                )}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-600">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Radar className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">{threatIntel.activeIndicators}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("socActiveIndicators")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* RQ3 latency detail + lifecycle times */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-700" aria-hidden />
                {t("socNotifiedLatency")} — RQ3
              </h3>
              {rq3.latency.count > 0 && (
                <Badge variant="outline" className="tabular-nums">{t("socSamples", String(rq3.latency.count))}</Badge>
              )}
            </div>
            {rq3.latency.count === 0 ? (
              <p className="text-sm text-muted-foreground">{t("socNoSamples")}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold tabular-nums">{rq3.latency.medianMin}′</span>
                  <span className="text-sm text-muted-foreground">
                    {t("socRq3Target")} · p90 {rq3.latency.p90Min}′ · {t("socWithinTarget", String(rq3.latency.withinTarget), String(rq3.latency.count))}
                  </span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>0′</span>
                    <span>{rq3.targetMinutes}′</span>
                    <span>{Math.max(30, Math.ceil((rq3.latency.maxMin ?? rq3.targetMinutes) / 10) * 10)}′</span>
                  </div>
                  <Progress value={Math.min(100, ((rq3.latency.medianMin ?? 0) / Math.max(rq3.targetMinutes, rq3.latency.medianMin ?? 1)) * 100)} />
                </div>
              </>
            )}
            <div className="grid grid-cols-3 gap-2 border-t pt-3">
              <div>
                <p className="text-lg font-bold tabular-nums">{lifecycle.mttaMin ?? "—"}′</p>
                <p className="text-[11px] text-muted-foreground">{t("socMtta")}</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{lifecycle.mttcMin ?? "—"}′</p>
                <p className="text-[11px] text-muted-foreground">{t("socMttc")}</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{lifecycle.mttrMin ?? "—"}′</p>
                <p className="text-[11px] text-muted-foreground">{t("socMttr")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incident pipeline */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-700" aria-hidden />
              {t("socPipeline")}
            </h3>
            <div className="grid grid-cols-6 gap-1.5">
              {INCIDENT_STATUSES.map((s) => (
                <div key={s} className="rounded-lg border bg-muted/30 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums leading-none">{incidents.byStatus[s] ?? 0}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground" title={t(STATUS_KEY[s])}>
                    {t(STATUS_KEY[s])}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                {t("incPriority")}: {incidents.immediate} × IMMEDIATE
              </Badge>
              <Badge variant="outline" className="bg-muted/50">
                <Users2 className="mr-1 h-3 w-3" aria-hidden />
                {threatIntel.shares.hub}× {t("tiShareHub").split("(")[0].trim()} · {threatIntel.shares.peer}× P2P
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Predictive forecast */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" aria-hidden />
              {t("socForecast", metrics.organization?.sector ?? "Banking")}
            </h3>
            <div className="space-y-2.5">
              {forecast.map((f) => (
                <div key={f.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CategoryBadge category={f.category} />
                      {f.activeIndicators > 0 && (
                        <span className="text-[11px] text-muted-foreground">{f.activeIndicators}·IOC</span>
                      )}
                    </span>
                    <span className="font-bold tabular-nums">{f.riskIndex}</span>
                  </div>
                  <Progress value={f.riskIndex} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ethio-CERT sync */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-teal-600" aria-hidden />
              {t("socSyncPanel")}
              <Badge
                variant="outline"
                title={binding.mode === "live" ? t("socSyncBindingLiveHint") : t("socSyncBindingFixtureHint")}
                className={`ml-auto whitespace-nowrap ${
                  binding.mode === "live"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                {binding.mode === "live" ? <PlugZap className="mr-1 h-3 w-3" aria-hidden /> : <Database className="mr-1 h-3 w-3" aria-hidden />}
                {binding.mode === "live" ? `${t("socSyncBindingLive")} · ${(() => { try { return new URL(binding.endpoint ?? "").host; } catch { return binding.endpoint ?? ""; } })()}` : t("socSyncBindingFixture")}
              </Badge>
            </h3>
            {recentSyncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="space-y-2">
                {recentSyncs.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <Badge variant="outline" className={`mt-0.5 whitespace-nowrap ${r.direction === "INGEST" ? "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800" : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"}`}>
                      {r.direction === "INGEST" ? <ArrowRight className="mr-1 h-3 w-3" aria-hidden /> : <Send className="mr-1 h-3 w-3" aria-hidden />}
                      {r.direction}
                    </Badge>
                    <Badge variant="outline" className={`mt-0.5 whitespace-nowrap ${
                      r.status === "failed"
                        ? "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                        : r.source === "LIVE"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {r.status === "failed" ? t("socSyncFailed") : r.source === "LIVE" ? t("socSyncSourceLive") : t("socSyncSourceFixture")}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate text-xs" title={r.detail ?? undefined}>{r.detail}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString("en-GB")}
                        {r.receiptId ? ` · ${t("socSyncReceipt", r.receiptId)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Incidents tab ────────────────────────────────────────────────────────────

function IncidentsTab({ canManage, isSuperAdmin, onChanged }: { canManage: boolean; isSuperAdmin: boolean; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<IncidentRowDTO[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [detail, setDetail] = useState<IncidentDetailDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    api<{ incidents: IncidentRowDTO[] }>("/api/incidents").then((d) => setRows(d.incidents)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    try {
      const d = await api<{ incident: IncidentDetailDTO }>(`/api/incidents/${id}`);
      setDetail(d.incident);
      setNote("");
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    }
  };

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await api<{ notificationLatencyMin?: number }>(`/api/incidents/${id}`, {
        method: "PATCH", body: JSON.stringify(body),
      });
      if (body.action === "notify" && res.notificationLatencyMin !== undefined) {
        toast.success(`${t("incNotified")} — ${t("incMinutes", res.notificationLatencyMin.toFixed(1))}`);
      } else if (body.status) {
        toast.success(`${t(STATUS_KEY[body.status as string] ?? "incDetected")} ✓`);
      } else if (body.action === "auto-contain") {
        toast.success(`${t("incAutoResponse")} ✓`);
      } else {
        toast.success("✓");
      }
      // The PATCH response carries the scalar fields only — refetch the full
      // detail (timeline events + matched indicators) for the dialog.
      const d = await api<{ incident: IncidentDetailDTO }>(`/api/incidents/${id}`);
      setDetail(d.incident);
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (severityFilter === "all" || r.severity === severityFilter)
    );
  }, [rows, statusFilter, severityFilter]);

  const nextOf = (status: string) => {
    const i = INCIDENT_STATUSES.indexOf(status);
    return i >= 0 && i < INCIDENT_STATUSES.length - 1 ? INCIDENT_STATUSES[i + 1] : null;
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "am-ET", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 max-w-md">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label={t("incAllStatuses")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("incAllStatuses")}</SelectItem>
              {INCIDENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(STATUS_KEY[s])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSeverities")}</SelectItem>
              <SelectItem value="critical">{t("critical")}</SelectItem>
              <SelectItem value="high">{t("high")}</SelectItem>
              <SelectItem value="medium">{t("medium")}</SelectItem>
              <SelectItem value="low">{t("low")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="ml-auto bg-emerald-700 hover:bg-emerald-800 text-white">
            <AlertTriangle className="mr-1.5 h-4 w-4" aria-hidden />
            {t("incNewTitle")}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered === null ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">—</p>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>{t("incTitleLabel")}</TableHead>
                    {isSuperAdmin && <TableHead className="hidden lg:table-cell">{t("org")}</TableHead>}
                    <TableHead>{t("incPriority")}</TableHead>
                    <TableHead>{t("incRq3Chip")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r.id)}>
                      <TableCell><code className="text-xs font-semibold">{r.ref}</code></TableCell>
                      <TableCell className="max-w-80">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={r.severity} />
                          <CategoryBadge category={r.category} />
                        </div>
                        <p className="mt-1 text-sm font-medium truncate">{lang === "en" ? r.title : (r.titleAm || r.title)}</p>
                        <p className="text-[11px] text-muted-foreground">{t("incDetectedAt")}: {fmt(r.detectedAt)}</p>
                      </TableCell>
                      {isSuperAdmin && <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.organization?.name}</TableCell>}
                      <TableCell><PriorityBadge score={r.priorityScore} label={r.priorityLabel} /></TableCell>
                      <TableCell><LatencyChip minutes={r.notificationLatencyMin} /></TableCell>
                      <TableCell><IncidentStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <code>{detail.ref}</code>
                  <SeverityBadge severity={detail.severity} />
                  <CategoryBadge category={detail.category} />
                  <IncidentStatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  {lang === "en" ? detail.title : (detail.titleAm || detail.title)} · {t("incDetectedAt")}: {fmt(detail.detectedAt)}
                </DialogDescription>
              </DialogHeader>

              {detail.description && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">{detail.description}</p>
              )}

              {/* Action row */}
              {canManage && detail.status !== "closed" && (
                <div className="flex flex-wrap gap-2">
                  {!detail.notifiedAt && (
                    <Button size="sm" onClick={() => act(detail.id, { action: "notify" })} disabled={busy} className="bg-sky-700 hover:bg-sky-800 text-white">
                      <BellRing className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("incNotify")}
                    </Button>
                  )}
                  {nextOf(detail.status) && (
                    <Button size="sm" onClick={() => act(detail.id, { status: nextOf(detail.status) })} disabled={busy} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                      <ArrowRight className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("incAdvance", t(STATUS_KEY[nextOf(detail.status)!]))}
                    </Button>
                  )}
                  {(detail.status === "detected" || detail.status === "triaged") && (detail.severity === "critical" || detail.severity === "high") && (
                    <Button size="sm" variant="outline" onClick={() => act(detail.id, { action: "auto-contain" })} disabled={busy}
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950">
                      <Zap className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("incAutoContain")}
                    </Button>
                  )}
                </div>
              )}

              {/* RQ3 chip */}
              {detail.notifiedAt && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <BellRing className="h-4 w-4 text-emerald-700" aria-hidden />
                  {t("incNotified")}: {fmt(detail.notifiedAt)} · {t("incLatency")} <strong className="tabular-nums">{detail.notificationLatencyMin !== null ? `${detail.notificationLatencyMin}′` : "—"}</strong>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("incTimeline")}</h4>
                <ScrollArea className="max-h-56 rounded-lg border">
                  <div className="p-3 space-y-2.5">
                    {detail.events.map((e) => (
                      <div key={e.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {e.type === "AUTO_RESPONSE" ? <Zap className="mr-1 inline h-3.5 w-3.5 text-red-600" aria-hidden /> : null}
                            {e.type.replaceAll("_", " ").toLowerCase()}
                            <span className="ml-2 text-[11px] font-normal text-muted-foreground">{fmt(e.createdAt)}{e.actor ? ` · ${e.actor.name}` : ""}</span>
                          </p>
                          {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Matched indicators */}
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("incMatchIndicator")}</h4>
                {detail.indicators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("incNoIndicators")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.indicators.map(({ indicator }) => (
                      <div key={indicator.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs">
                        <code className="font-semibold">{indicator.value}</code>
                        <CategoryBadge category={indicator.category} />
                        <TlpBadge tlp={indicator.tlp} />
                        <SourceBadge source={indicator.source} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Note composer */}
              {canManage && (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="incident-note" className="text-sm">{t("incAddNote")}</Label>
                  <div className="flex gap-2">
                    <Textarea id="incident-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    <Button size="sm" variant="outline" disabled={busy || note.trim().length < 3} onClick={() => { act(detail.id, { action: "note", note: note.trim() }); setNote(""); }}>
                      {t("save")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <CreateIncidentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { load(); onChanged(); }}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}

function CreateIncidentDialog({ open, onClose, onCreated, isSuperAdmin }: {
  open: boolean; onClose: () => void; onCreated: () => void; isSuperAdmin: boolean;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("phishing");
  const [severity, setSeverity] = useState("high");
  const [description, setDescription] = useState("");
  const [detectedAt, setDetectedAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ incident: IncidentRowDTO }>("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          title,
          category,
          severity,
          description: description || undefined,
          detectedAt: detectedAt ? new Date(detectedAt).toISOString() : undefined,
        }),
      });
      toast.success(`${res.incident.ref} — ${t("incPriority")}: ${Math.round(res.incident.priorityScore ?? 0)} (${res.incident.priorityLabel})`);
      onCreated();
      onClose();
      setTitle(""); setDescription(""); setDetectedAt("");
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const CATS = ["ransomware", "phishing", "bec", "malware", "data_breach", "ddos", "unauthorized_access", "other"];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("incNewTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="inc-title">{t("incTitleLabel")}</Label>
            <Input id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Phishing SMS targeting mobile-banking customers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("evCategory")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label={t("evCategory")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATS.map((c) => <SelectItem key={c} value={c}>{t(CATEGORY_KEY[c])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("risk")}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger aria-label={t("risk")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{t("critical")}</SelectItem>
                  <SelectItem value="high">{t("high")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="low">{t("low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inc-desc">{t("evDescription")}</Label>
            <Textarea id="inc-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inc-detected">{t("incDetectedAt")} (ISO)</Label>
            <Input id="inc-detected" value={detectedAt} onChange={(e) => setDetectedAt(e.target.value)} placeholder={new Date().toISOString()} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy || title.trim().length < 5} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Threat Intel tab ─────────────────────────────────────────────────────────

function ThreatsTab({ canManage, canSync, isSuperAdmin, onChanged }: {
  canManage: boolean; canSync: boolean; isSuperAdmin: boolean; onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<IndicatorRowDTO[] | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<IndicatorRowDTO | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [binding, setBinding] = useState<{ mode: "live" | "fixture"; endpoint: string | null } | null>(null);

  const load = useCallback(() => {
    api<{ indicators: IndicatorRowDTO[] }>("/api/threats").then((d) => setRows(d.indicators)).catch(() => setRows([]));
    api<{ binding: { mode: "live" | "fixture"; endpoint: string | null } }>("/api/threats/sync")
      .then((d) => setBinding(d.binding))
      .catch(() => setBinding(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const CATS = ["ransomware", "phishing", "bec", "malware", "ddos", "credential_stuffing", "apt", "scam", "insider", "data_breach", "other"];

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) =>
      (severityFilter === "all" || r.severity === severityFilter) &&
      (categoryFilter === "all" || r.category === categoryFilter) &&
      (sourceFilter === "all" || r.source === sourceFilter)
    );
  }, [rows, severityFilter, categoryFilter, sourceFilter]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await api(`/api/threats/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success("✓");
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    }
  };

  const doSync = async (direction: "ingest" | "report") => {
    setSyncing(true);
    try {
      const res = await api<{ ingested?: number; updated?: number; reported?: number; payloadHash?: string; delivery?: { mode: string; receiptId: string | null } }>("/api/threats/sync", {
        method: "POST", body: JSON.stringify({ direction }),
      });
      if (direction === "ingest") {
        toast.success(t("socSyncIngested", String(res.ingested ?? 0), String(res.updated ?? 0)));
      } else {
        toast.success(
          res.delivery?.receiptId
            ? `Ethio-CERT ← ${res.reported ?? 0} · ${t("socSyncReceipt", res.delivery.receiptId)}`
            : `Ethio-CERT ← ${res.reported ?? 0} · sha256 ${(res.payloadHash ?? "").slice(0, 12)}…`
        );
      }
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setSyncing(false);
    }
  };

  const fmtDateShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t("tiHub")}</h3>
        <p className="text-sm text-muted-foreground">{t("tiHubSub")}</p>
      </div>

      {/* Sync panel */}
      {canSync && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <RefreshCw className={`h-4 w-4 text-teal-600 ${syncing ? "animate-spin" : ""}`} aria-hidden />
            <span className="text-sm font-medium">{t("socSyncPanel")}</span>
            {binding && (
              <Badge
                variant="outline"
                title={binding.mode === "live" ? t("socSyncBindingLiveHint") : t("socSyncBindingFixtureHint")}
                className={`whitespace-nowrap ${
                  binding.mode === "live"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                {binding.mode === "live" ? <PlugZap className="mr-1 h-3 w-3" aria-hidden /> : <Database className="mr-1 h-3 w-3" aria-hidden />}
                {binding.mode === "live" ? `${t("socSyncBindingLive")} · ${(() => { try { return new URL(binding.endpoint ?? "").host; } catch { return binding.endpoint ?? ""; } })()}` : t("socSyncBindingFixture")}
              </Badge>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {isSuperAdmin && (
                <Button size="sm" variant="outline" onClick={() => doSync("ingest")} disabled={syncing} className="border-teal-300 text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950">
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {t("socSyncIngest")}
                </Button>
              )}
              <Button size="sm" onClick={() => doSync("report")} disabled={syncing} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t("socSyncReport")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 gap-2 sm:grid-cols-3 max-w-xl">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSeverities")}</SelectItem>
              <SelectItem value="critical">{t("critical")}</SelectItem>
              <SelectItem value="high">{t("high")}</SelectItem>
              <SelectItem value="medium">{t("medium")}</SelectItem>
              <SelectItem value="low">{t("low")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label={t("incAllCategories")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("incAllCategories")}</SelectItem>
              {CATS.map((c) => <SelectItem key={c} value={c}>{t(CATEGORY_KEY[c])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger aria-label={t("incSource")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("incAllCategories").split(" ")[0]}</SelectItem>
              <SelectItem value="ETHIO_CERT">{t("tiSourceNational")}</SelectItem>
              <SelectItem value="MISP_FEED">{t("tiSourceMisp")}</SelectItem>
              <SelectItem value="ORG_UPLOAD">{t("tiSourceOrg")}</SelectItem>
              <SelectItem value="ANALYST">{t("tiSourceAnalyst")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="ml-auto bg-emerald-700 hover:bg-emerald-800 text-white">
            <Radar className="mr-1.5 h-4 w-4" aria-hidden />
            {t("tiNew")}
          </Button>
        )}
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
                    <TableHead>{t("tiValue")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("incSource")}</TableHead>
                    <TableHead>{t("tiTlp")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("tiSightings")}</TableHead>
                    {canManage && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-72">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={r.severity} />
                          <CategoryBadge category={r.category} />
                          {r.sharing === "P2P" && (
                            <Badge variant="outline" className="whitespace-nowrap bg-violet-50 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800 hover:bg-transparent">
                              <Users2 className="mr-1 h-3 w-3" aria-hidden />
                              {t("tiPeerOnly")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium">{lang === "en" ? r.titleEn : (r.titleAm || r.titleEn)}</p>
                        <code className="text-xs text-muted-foreground break-all">{r.type}: {r.value}</code>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {r.originAnonymised ? t("tiAnonymised") : r.origin} · {fmtDateShort(r.lastSeenAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={r.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-transparent" : "bg-muted text-muted-foreground border-border hover:bg-transparent"}>
                          <Eye className="mr-1 h-3 w-3" aria-hidden />
                          {r.isActive ? t("tiActive") : t("tiRetired")}
                        </Badge>
                        <p className="mt-1 text-[11px] text-muted-foreground">{r.sightings} {t("tiSightings")} · {r.incidentCount}×</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><SourceBadge source={r.source} /></TableCell>
                      <TableCell><TlpBadge tlp={r.tlp} /></TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums text-sm">{r.sightings}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Select value="" onValueChange={(v) => {
                            if (v === "sighting") patch(r.id, { sighting: true });
                            else if (v === "retire") patch(r.id, { isActive: false });
                            else if (v === "reactivate") patch(r.id, { isActive: true });
                            else if (v === "share") setShareTarget(r);
                          }}>
                            <SelectTrigger className="h-7 w-7 border-0 p-0 justify-center" aria-label={`${t("status")} ${r.value}`}>
                              <span className="text-xs text-muted-foreground">⋯</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sighting">{t("tiRecordSighting")}</SelectItem>
                              {r.isActive
                                ? <SelectItem value="retire">{t("tiRetire")}</SelectItem>
                                : <SelectItem value="reactivate">{t("tiReactivate")}</SelectItem>}
                              <SelectItem value="share">{t("tiSharePeer")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <CreateIndicatorDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { load(); onChanged(); }} />
      <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} onShared={() => { load(); onChanged(); }} />
    </div>
  );
}

function CreateIndicatorDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("domain");
  const [value, setValue] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [category, setCategory] = useState("phishing");
  const [severity, setSeverity] = useState("high");
  const [tlp, setTlp] = useState("TLP:AMBER");
  const [confidence, setConfidence] = useState(70);
  const [busy, setBusy] = useState(false);

  const TYPES = ["ip", "domain", "url", "hash_sha256", "email", "filename"];
  const CATS = ["ransomware", "phishing", "bec", "malware", "ddos", "credential_stuffing", "apt", "scam", "insider", "data_breach", "other"];
  const CATEGORY_KEY: Record<string, string> = {
    ransomware: "catRansomware", phishing: "catPhishing", bec: "catBec",
    malware: "catMalware", ddos: "catDdos", credential_stuffing: "catCredentialStuffing",
    apt: "catApt", scam: "catScam", insider: "catInsider", data_breach: "catDataBreach", other: "catOther",
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ sharingDecision: { mode: string; reason: string } }>("/api/threats", {
        method: "POST",
        body: JSON.stringify({ type, value, titleEn, category, severity, tlp, confidence }),
      });
      toast.success(`${t("tiSharingDecision")}: ${res.sharingDecision.mode} — ${res.sharingDecision.reason}`);
      onCreated();
      onClose();
      setValue(""); setTitleEn("");
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tiNew")}</DialogTitle>
          <DialogDescription>{t("tiHubSub")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("tiType")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger aria-label={t("tiType")}><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ti-val">{t("tiValue")}</Label>
              <Input id="ti-val" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "ip" ? "203.0.113.10" : "example-threat.com"} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ti-title">{t("tiTitle")}</Label>
            <Input id="ti-title" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Phishing domain impersonating a member bank" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("evCategory")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label={t("evCategory")}><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{t(CATEGORY_KEY[c])}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("risk")}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger aria-label={t("risk")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{t("critical")}</SelectItem>
                  <SelectItem value="high">{t("high")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="low">{t("low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("tiTlp")}</Label>
              <Select value={tlp} onValueChange={setTlp}>
                <SelectTrigger aria-label={t("tiTlp")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["TLP:RED", "TLP:AMBER+STRICT", "TLP:AMBER", "TLP:GREEN", "TLP:CLEAR"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ti-conf">{t("tiConfidence")}</Label>
              <Input id="ti-conf" type="number" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy || value.trim().length < 3 || titleEn.trim().length < 5} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ target, onClose, onShared }: { target: IndicatorRowDTO | null; onClose: () => void; onShared: () => void }) {
  const { t } = useI18n();
  const [peers, setPeers] = useState<{ id: string; name: string; sector: string }[]>([]);
  const [peerId, setPeerId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setPeerId("");
      api<{ peers: { id: string; name: string; sector: string }[] }>("/api/threats/peers")
        .then((d) => setPeers(d.peers))
        .catch(() => setPeers([]));
    }
  }, [target]);

  const share = async (mode: "HUB" | "PEER") => {
    if (!target) return;
    if (mode === "PEER" && !peerId) {
      toast.error(t("tiShareWith"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ recommendation: { mode: string; reason: string }; overridden: boolean }>(`/api/threats/${target.id}/share`, {
        method: "POST",
        body: JSON.stringify({ mode, ...(mode === "PEER" ? { targetOrgId: peerId } : {}) }),
      });
      toast.success(`${t("tiShared")} — ${res.recommendation.mode}${res.overridden ? " (override)" : ""}`);
      onShared();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-700" aria-hidden />
            {t("tiShared")}
          </DialogTitle>
          <DialogDescription>
            <code className="text-xs">{target?.type}: {target?.value}</code>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button onClick={() => share("HUB")} disabled={busy} className="bg-emerald-700 hover:bg-emerald-800 text-white justify-start">
            <Radio className="mr-2 h-4 w-4" aria-hidden />
            {t("tiShareHub")}
          </Button>
          <div className="grid gap-1.5">
            <Label>{t("tiSharePeer")}</Label>
            <div className="flex gap-2">
              <Select value={peerId} onValueChange={setPeerId}>
                <SelectTrigger aria-label={t("tiShareWith")}><SelectValue placeholder={t("tiShareWith")} /></SelectTrigger>
                <SelectContent>
                  {peers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => share("PEER")} disabled={busy || !peerId}>
                <Send className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <FileJson className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("tiRationale")}: {target?.sharing === "P2P" ? t("tiPeerOnly") : t("tiMembersOnly")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
