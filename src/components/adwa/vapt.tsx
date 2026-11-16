"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Crosshair, Server, Globe, AlertTriangle, Flame, ShieldCheck, Radar, Bug, Plus, Pencil, Trash2,
  Zap, Eye, FileJson, Timer, ShieldAlert, CheckCircle2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { slaInfo } from "@/lib/sla";
import { SeverityBadge, SlaBadge, fmtDate } from "./shared";
import { AdPathsTab } from "./vapt-adpaths";
import { BidMatrixTab } from "./vapt-bidmatrix";

// ── DTOs (mirror /api/vapt/* responses) ──────────────────────────────────────

interface OverviewDTO {
  scope: string;
  organizationId: string | null;
  slaPolicy: { critical: number; high: number; medium: number; low: number; dueSoonWindowDays: number };
  assets: { total: number; unmanaged: number; external: number; byKind: Record<string, number> };
  vulnerabilities: {
    total: number; critical: number; high: number; medium: number; low: number; kev: number;
    open: number; inProgress: number; remediated: number; accepted: number;
    overdue: number; dueSoon: number; avgPriority: number | null; topPriority: number; exposureScore: number;
  };
  kevOpenCount: number;
  topRisk: TopRiskRow[];
  recentScans: { id: string; name: string; scanType: string; status: string; engineMode: string; dastReal: boolean; newCount: number; knownCount: number; targetCount: number; startedAt: string; completedAt: string | null; organization: string | null }[];
}

interface TopRiskRow {
  id: string; cveId: string | null; title: string; severity: string;
  cvssScore: number; epss: number; kev: boolean;
  priorityScore: number; priorityClass: string; status: string; dueAt: string | null;
  asset: { id: string; name: string; kind: string };
}

interface AssetRowDTO {
  id: string; name: string; kind: string; identifier: string; environment: string; surface: string;
  criticality: string; osOrPlatform: string | null; tags: string[]; managed: boolean; notes: string | null;
  lastSeenAt: string; organization: { id: string; name: string; nameAm: string } | null;
  vulnCount: number; openCount: number; criticalOpen: number; kevOpen: number; topPriority: number;
}

interface VulnRowDTO {
  id: string; assetId: string; scanId: string | null; cveId: string | null; title: string;
  description: string; remediation: string; category: string; severity: string;
  cvssScore: number; cvssVector: string | null; epss: number; kev: boolean;
  priorityScore: number; priorityClass: string;
  evidence: Record<string, unknown> | null;
  status: string; dueAt: string | null; remediatedAt: string | null; detectedAt: string;
  promotedFindingId: string | null;
  asset: { id: string; name: string; kind: string; identifier: string; criticality: string; surface: string; environment: string };
  organization: { id: string; name: string } | null;
  slaState: string; daysRemaining: number | null;
}

interface ScanRowDTO {
  id: string; name: string; scanType: string; status: string; engineMode: string; dastReal: boolean;
  targetCount: number; newCount: number; knownCount: number;
  summary: Record<string, number> | null; detail: string | null;
  startedAt: string; completedAt: string | null; durationMs: number | null;
  organization: { id: string; name: string } | null;
}

interface OrgBrief { id: string; name: string }

// ── label maps (i18n keys per enum value) ────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  SERVER: "vaptKServer", NETWORK: "vaptKNetwork", FIREWALL: "vaptKFirewall", DATABASE: "vaptKDatabase",
  AD_IDENTITY: "vaptKAd", WEBAPP: "vaptKWebapp", API: "vaptKApi", CLOUD: "vaptKCloud",
  ENDPOINT: "vaptKEndpoint", CONTAINER: "vaptKContainer", K8S: "vaptKK8s",
};
const KIND_ICON: Record<string, React.ElementType> = {
  SERVER: Server, NETWORK: Radar, FIREWALL: ShieldCheck, DATABASE: Server, AD_IDENTITY: ShieldCheck,
  WEBAPP: Globe, API: Zap, CLOUD: Globe, ENDPOINT: Server, CONTAINER: Bug, K8S: Bug,
};
const CATEGORY_LABEL: Record<string, string> = {
  OS: "vaptCatOs", NETWORK: "vaptCatNetwork", FIREWALL: "vaptCatFirewall", DATABASE: "vaptCatDatabase",
  SSL_TLS: "vaptCatSsl", AD_IDENTITY: "vaptCatAd", WEB: "vaptCatWeb", API: "vaptCatApi",
  CLOUD: "vaptCatCloud", CONTAINER: "vaptCatContainer", K8S: "vaptCatK8s", CONFIG: "vaptCatConfig",
};
const ENV_LABEL: Record<string, string> = {
  PROD: "vaptEnvProd", UAT: "vaptEnvUat", DEV: "vaptEnvDev", DMZ: "vaptEnvDmz", EXTERNAL: "vaptEnvExternal",
};

const KINDS = Object.keys(KIND_LABEL);
const ENVIRONMENTS = Object.keys(ENV_LABEL);
const CRITICALITIES = ["critical", "high", "medium", "low"];

// ── Badges ───────────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: string }) {
  const { t } = useI18n();
  const Icon = KIND_ICON[kind] ?? Server;
  return (
    <Badge variant="outline" className="whitespace-nowrap bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 hover:bg-transparent">
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {t(KIND_LABEL[kind] ?? kind)}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const { t } = useI18n();
  return <Badge variant="outline" className="whitespace-nowrap bg-muted/50 hover:bg-transparent">{t(CATEGORY_LABEL[category] ?? category)}</Badge>;
}

function PriorityBadge({ score, cls }: { score: number; cls: string }) {
  const c =
    cls === "P1" ? "bg-red-600 text-white border-red-700"
    : cls === "P2" ? "bg-amber-500 text-white border-amber-600"
    : cls === "P3" ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
    : "bg-muted text-muted-foreground border-border";
  return <Badge className={`${c} tabular-nums hover:${c}`}>{cls} · {Math.round(score)}</Badge>;
}

function KevBadge({ kev }: { kev: boolean }) {
  const { t } = useI18n();
  if (!kev) return null;
  return (
    <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600 gap-1">
      <Flame className="h-3 w-3" aria-hidden /> {t("vaptKevOpen")}
    </Badge>
  );
}

function VulnStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === "accepted") {
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border hover:bg-transparent">{t("vaptStAccepted")}</Badge>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: t("stOpen"), cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
    in_progress: { label: t("stProgress"), cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
    remediated: { label: t("stRemediated"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  };
  const e = map[status] ?? map.open;
  return <Badge variant="outline" className={`${e.cls} whitespace-nowrap hover:bg-transparent`}>{e.label}</Badge>;
}

// ── Main view ────────────────────────────────────────────────────────────────

export function VaptView({ canManage, isSuperAdmin }: { canManage: boolean; isSuperAdmin: boolean }) {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OverviewDTO | null>(null);
  const [assets, setAssets] = useState<AssetRowDTO[] | null>(null);
  const [vulns, setVulns] = useState<VulnRowDTO[] | null>(null);
  const [scans, setScans] = useState<ScanRowDTO[] | null>(null);
  const [orgs, setOrgs] = useState<OrgBrief[]>([]);

  const refreshAll = useCallback(() => {
    api<OverviewDTO>("/api/vapt/overview").then(setOverview).catch(() => {});
    api<{ assets: AssetRowDTO[] }>("/api/vapt/assets").then((d) => setAssets(d.assets)).catch(() => {});
    api<{ vulnerabilities: VulnRowDTO[] }>("/api/vapt/vulnerabilities").then((d) => setVulns(d.vulnerabilities)).catch(() => {});
    api<{ scans: ScanRowDTO[] }>("/api/vapt/scans").then((d) => setScans(d.scans)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshAll();
    if (isSuperAdmin) {
      api<{ organizations: OrgBrief[] }>("/api/organizations").then((d) => setOrgs(d.organizations)).catch(() => {});
    }
  }, [refreshAll, isSuperAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-emerald-700" aria-hidden />
            {t("navVapt")}
          </h2>
          <p className="text-muted-foreground">{t("vaptSub")}</p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
          NBE/NCB/S/02/2026/27 · LOT4
        </Badge>
      </div>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("vaptSlaPolicy")}</p>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("vaptTabOverview")}</TabsTrigger>
          <TabsTrigger value="assets">{t("vaptTabAssets")}</TabsTrigger>
          <TabsTrigger value="scans">{t("vaptTabScans")}</TabsTrigger>
          <TabsTrigger value="vulns">{t("vaptTabVulns")}</TabsTrigger>
          <TabsTrigger value="adpaths">{t("vaptTabAd")}</TabsTrigger>
          <TabsTrigger value="bidmatrix">{t("vaptTabBid")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={overview} />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <AssetsTab assets={assets} canManage={canManage} isSuperAdmin={isSuperAdmin} orgs={orgs} onChanged={refreshAll} />
        </TabsContent>
        <TabsContent value="scans" className="mt-4">
          <ScansTab scans={scans} assets={assets} canManage={canManage} isSuperAdmin={isSuperAdmin} orgs={orgs} onChanged={refreshAll} />
        </TabsContent>
        <TabsContent value="vulns" className="mt-4">
          <VulnsTab vulns={vulns} canManage={canManage} isSuperAdmin={isSuperAdmin} onChanged={refreshAll} />
        </TabsContent>
        <TabsContent value="adpaths" className="mt-4">
          <AdPathsTab />
        </TabsContent>
        <TabsContent value="bidmatrix" className="mt-4">
          <BidMatrixTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewDTO | null }) {
  const { t } = useI18n();
  if (!data) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }
  const v = data.vulnerabilities;
  const kpis = [
    { icon: Server, label: t("vaptAssetsMonitored"), value: data.assets.total, sub: `${data.assets.unmanaged} ${t("vaptShadowIt")} · ${data.assets.external} ${t("vaptExternalSurface")}` },
    { icon: ShieldAlert, label: t("vaptExposureScore"), value: v.exposureScore.toFixed(1), sub: `${t("vaptAvgPriority")}: ${v.avgPriority?.toFixed(1) ?? "—"}` },
    { icon: Bug, label: t("vaptOpenVulns"), value: v.open + v.inProgress, sub: `${v.critical} ${t("critical").toLowerCase()} · ${v.high} ${t("high").toLowerCase()} · ${v.medium} ${t("medium").toLowerCase()} · ${v.low} ${t("vaptLow")}` },
    { icon: Timer, label: t("vaptOverdueCard"), value: v.overdue, sub: `${v.dueSoon} ${t("slaDueSoonCard")}` },
  ];

  const pieData = [
    { name: t("critical"), value: v.critical, color: "#DC2626" },
    { name: t("high"), value: v.high, color: "#D97706" },
    { name: t("medium"), value: v.medium, color: "#EAB308" },
    { name: t("vaptLow"), value: v.low, color: "#65A30D" },
  ].filter((d) => d.value > 0);

  const openRows = data.topRisk;
  const slaOf = (r: TopRiskRow) =>
    slaInfo({ status: r.status === "accepted" ? "waived" : r.status, dueAt: r.dueAt, remediatedAt: null });
  const pClasses = ["P1", "P2", "P3", "P4"];
  const prioData = pClasses.map((c, i) => ({
    name: c,
    count: openRows.filter((r) => r.priorityClass === c).length,
    fill: ["#DC2626", "#D97706", "#EAB308", "#65A30D"][i],
  }));

  return (
    <div className="space-y-6">
      {v.kev > 0 && (v.open + v.inProgress) > 0 && (
        <Card className="border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <Flame className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-red-900 dark:text-red-200">{data.kevOpenCount} {t("vaptKevOpen")}</p>
              <p className="mt-0.5 text-sm text-red-800/80 dark:text-red-300/80">
                EPSS + CISA KEV context-aware prioritisation — remediate these first (tender §Risk Prioritization).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("vaptSeverityMix")}</CardTitle></CardHeader>
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
            <div className="flex flex-wrap justify-center gap-4 text-xs">
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
          <CardHeader><CardTitle className="text-base">{t("vaptPriorityMix")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={268}>
              <BarChart data={prioData} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#D97706" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("vaptRecentScans")}</CardTitle></CardHeader>
          <CardContent className="px-2">
            <ScrollArea className="max-h-[268px]">
              <div className="space-y-2 px-2 pb-2">
                {data.recentScans.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">—</p>}
                {data.recentScans.map((s) => (
                  <div key={s.id} className="rounded-lg border px-3 py-2">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{s.scanType}</Badge>
                      {s.dastReal && <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">{t("vaptEngineHybrid").split("—")[0].trim()}</Badge>}
                      <span>{s.newCount} {t("vaptScanNew")}</span>
                      <span>· {s.knownCount} {t("vaptScanKnown")}</span>
                      <span>· {fmtDate(s.completedAt ?? s.startedAt)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("vaptTopRisk")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CVE</TableHead>
                  <TableHead>{t("vaptAssetCol")}</TableHead>
                  <TableHead>{t("critical")}</TableHead>
                  <TableHead>CVSS</TableHead>
                  <TableHead>EPSS</TableHead>
                  <TableHead>{t("vaptPriorityCol")}</TableHead>
                  <TableHead>{t("slaTitle")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openRows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">—</TableCell></TableRow>
                )}
                {openRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.cveId ?? "—"}</TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.asset.name} · {t(KIND_LABEL[r.asset.kind] ?? r.asset.kind)}</p>
                    </TableCell>
                    <TableCell><SeverityBadge severity={r.severity} /></TableCell>
                    <TableCell className="font-bold tabular-nums">{r.cvssScore.toFixed(1)}</TableCell>
                    <TableCell className="tabular-nums">{(r.epss * 100).toFixed(0)}%</TableCell>
                    <TableCell><PriorityBadge score={r.priorityScore} cls={r.priorityClass} /></TableCell>
                    <TableCell><SlaBadge state={slaOf(r).state} daysRemaining={slaOf(r).daysRemaining} dueAt={r.dueAt} /></TableCell>
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

// ── Assets tab ───────────────────────────────────────────────────────────────

interface AssetFormState {
  name: string; kind: string; identifier: string; environment: string; surface: string;
  criticality: string; osOrPlatform: string; tags: string; managed: boolean; notes: string;
}

const emptyAssetForm: AssetFormState = {
  name: "", kind: "SERVER", identifier: "", environment: "PROD", surface: "INTERNAL",
  criticality: "medium", osOrPlatform: "", tags: "", managed: true, notes: "",
};

function AssetsTab({ assets, canManage, isSuperAdmin, orgs, onChanged }: {
  assets: AssetRowDTO[] | null; canManage: boolean; isSuperAdmin: boolean; orgs: OrgBrief[]; onChanged: () => void;
}) {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssetRowDTO | null>(null);
  const [form, setForm] = useState<AssetFormState>(emptyAssetForm);
  const [orgId, setOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetRowDTO | null>(null);

  useEffect(() => {
    if (orgs.length && !orgId) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  const openAdd = () => { setEditTarget(null); setForm(emptyAssetForm); setDialogOpen(true); };
  const openEdit = (a: AssetRowDTO) => {
    setEditTarget(a);
    setForm({
      name: a.name, kind: a.kind, identifier: a.identifier, environment: a.environment,
      surface: a.surface, criticality: a.criticality, osOrPlatform: a.osOrPlatform ?? "",
      tags: a.tags.join(", "), managed: a.managed, notes: a.notes ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        identifier: form.identifier.trim(),
        environment: form.environment,
        surface: form.surface,
        criticality: form.criticality,
        osOrPlatform: form.osOrPlatform.trim() || undefined,
        tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
        managed: form.managed,
        notes: form.notes.trim() || undefined,
        ...(isSuperAdmin && !editTarget ? { organizationId: orgId } : {}),
      };
      if (editTarget) {
        await api(`/api/vapt/assets/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success(t("vaptEditAsset"));
      } else {
        await api("/api/vapt/assets", { method: "POST", body: JSON.stringify(payload) });
        toast.success(t("vaptAddAsset"));
      }
      setDialogOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/api/vapt/assets/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`${deleteTarget.name} — ${t("vaptDeleteAsset")}`);
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("vaptTabAssets")}</h3>
          <p className="text-sm text-muted-foreground">{t("vaptAssetsMonitored")}: {assets?.length ?? "…"}</p>
        </div>
        {canManage && <Button onClick={openAdd} className="bg-emerald-700 hover:bg-emerald-800 text-white"><Plus className="h-4 w-4" aria-hidden /> {t("vaptAddAsset")}</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          {assets === null ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : assets.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("vaptNoAssets")}</p>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("orgName")}</TableHead>
                    <TableHead>{t("vaptCategoryCol")}</TableHead>
                    <TableHead>{t("vaptAssetIdentifier")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("vaptAssetEnv")} / {t("vaptAssetSurface")}</TableHead>
                    <TableHead>{t("vaptAssetCrit")}</TableHead>
                    <TableHead>{t("findings")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("vaptAssetTags")}</TableHead>
                    {canManage && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-56">
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.osOrPlatform ?? t(KIND_LABEL[a.kind] ?? a.kind)}</p>
                        {!a.managed && <Badge variant="outline" className="mt-1 bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800">{t("vaptShadowIt")}</Badge>}
                      </TableCell>
                      <TableCell><KindBadge kind={a.kind} /></TableCell>
                      <TableCell className="font-mono text-xs max-w-44 truncate">{a.identifier}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        <p>{t(ENV_LABEL[a.environment] ?? a.environment)}</p>
                        <p className={a.surface === "EXTERNAL" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                          {a.surface === "EXTERNAL" ? t("vaptSurfaceExternal") : t("vaptSurfaceInternal")}
                        </p>
                      </TableCell>
                      <TableCell><SeverityBadge severity={a.criticality} /></TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold tabular-nums">{a.openCount}</p>
                        {a.criticalOpen > 0 && <p className="text-xs text-red-600 dark:text-red-400">{a.criticalOpen} {t("vaptAssetCriticalOpen")}</p>}
                        {a.kevOpen > 0 && <KevBadge kev />}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {a.tags.slice(0, 4).map((tg) => (
                            <Badge key={tg} variant="outline" className="text-[10px]">{tg}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} aria-label={`${t("vaptEditAsset")} ${a.name}`}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteTarget(a)} aria-label={`${t("vaptDeleteAsset")} ${a.name}`}>
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
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

      {/* Add / edit asset dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? t("vaptEditAsset") : t("vaptAddAsset")}</DialogTitle>
            <DialogDescription>{t("vaptAssetIdentifierPh")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {isSuperAdmin && !editTarget && orgs.length > 0 && (
              <div className="grid gap-1.5">
                <Label>{t("orgName")}</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="vapt-asset-name">{t("orgName")}</Label>
              <Input id="vapt-asset-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("vaptAssetNamePh")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("vaptCategoryCol")}</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{t(KIND_LABEL[k])}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("vaptAssetCrit")}</Label>
                <Select value={form.criticality} onValueChange={(v) => setForm((f) => ({ ...f, criticality: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{t(c === "low" ? "vaptLow" : c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vapt-asset-identifier">{t("vaptAssetIdentifier")}</Label>
              <Input id="vapt-asset-identifier" value={form.identifier} onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))} placeholder={t("vaptAssetIdentifierPh")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("vaptAssetEnv")}</Label>
                <Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{t(ENV_LABEL[e])}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("vaptAssetSurface")}</Label>
                <Select value={form.surface} onValueChange={(v) => setForm((f) => ({ ...f, surface: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">{t("vaptSurfaceInternal")}</SelectItem>
                    <SelectItem value="EXTERNAL">{t("vaptSurfaceExternal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vapt-asset-platform">{t("vaptAssetPlatform")}</Label>
              <Input id="vapt-asset-platform" value={form.osOrPlatform} onChange={(e) => setForm((f) => ({ ...f, osOrPlatform: e.target.value }))} placeholder="Windows Server 2019 · Ubuntu 22.04 · Cisco IOS-XE 17.6" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vapt-asset-tags">{t("vaptAssetTags")}</Label>
              <Input id="vapt-asset-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="core-banking, pci-scope, dmz" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="vapt-asset-managed" checked={form.managed} onCheckedChange={(v) => setForm((f) => ({ ...f, managed: v === true }))} />
              <Label htmlFor="vapt-asset-managed" className="font-normal">{t("vaptAssetManaged")}</Label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vapt-asset-notes">{t("vaptAssetNotes")}</Label>
              <Textarea id="vapt-asset-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.name.trim() || !form.identifier.trim()} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {editTarget ? t("vaptEditAsset") : t("vaptAddAsset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("vaptDeleteAsset")}</DialogTitle>
            <DialogDescription>{t("vaptDeleteAssetConfirm")}</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm font-mono">{deleteTarget.name} · {deleteTarget.identifier} · {deleteTarget.openCount} {t("findings").toLowerCase()}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">{t("vaptDeleteAsset")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Scans tab ────────────────────────────────────────────────────────────────

function ScansTab({ scans, assets, canManage, isSuperAdmin, orgs, onChanged }: {
  scans: ScanRowDTO[] | null; assets: AssetRowDTO[] | null; canManage: boolean; isSuperAdmin: boolean; orgs: OrgBrief[]; onChanged: () => void;
}) {
  const { t } = useI18n();
  const [scanType, setScanType] = useState("FULL");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [orgId, setOrgId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ scan: ScanRowDTO; dastReports?: { asset: string; target: string; reachable: boolean; checks: { id: string; result: string }[] }[] } | null>(null);
  const [detail, setDetail] = useState<{ scan: { id: string; name: string }; vulnerabilities: VulnRowDTO[] } | null>(null);

  useEffect(() => {
    if (orgs.length && !orgId) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  const launch = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api<{ scan: ScanRowDTO; dastReports: unknown[] }>("/api/vapt/scans", {
        method: "POST",
        body: JSON.stringify({
          scanType,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(selected.length ? { assetIds: selected } : {}),
          ...(isSuperAdmin ? { organizationId: orgId } : {}),
        }),
      });
      setResult({ scan: res.scan, dastReports: res.dastReports as never });
      toast.success(`${res.scan.name} — ${res.scan.newCount} ${t("vaptScanNew")}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setRunning(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const d = await api<{ scan: { id: string; name: string; vulnerabilities: VulnRowDTO[] } }>(`/api/vapt/scans/${id}`);
      setDetail({ scan: d.scan, vulnerabilities: d.scan.vulnerabilities });
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Radar className="h-4 w-4" aria-hidden /> {t("vaptNewScan")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {isSuperAdmin && orgs.length > 0 && (
                <div className="grid gap-1.5">
                  <Label>{t("orgName")}</Label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>{t("vaptScanType")}</Label>
                <Select value={scanType} onValueChange={setScanType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">{t("vaptScanTypeFull")}</SelectItem>
                    <SelectItem value="DAST">{t("vaptScanTypeDast")}</SelectItem>
                    <SelectItem value="INFRA">{t("vaptScanTypeInfra")}</SelectItem>
                    <SelectItem value="DISCOVERY">{t("vaptScanTypeDiscovery")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("vaptScanName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 perimeter sweep" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("vaptScanTargets")}</Label>
                <p className="text-sm text-muted-foreground px-1 py-2">
                  {selected.length ? `${selected.length} ${t("vaptScanTargetsCount")}` : `${t("vaptScanAllAssets")} (${assets?.length ?? 0})`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(assets ?? []).map((a) => (
                <label key={a.id} className="cursor-pointer">
                  <Badge variant="outline" className={`gap-1.5 ${selected.includes(a.id) ? "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300" : ""} hover:bg-transparent`}>
                    <Checkbox
                      checked={selected.includes(a.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => (v ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                      }
                      className="h-3.5 w-3.5"
                      aria-label={a.name}
                    />
                    {a.name}
                  </Badge>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={launch} disabled={running || !assets?.length} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {running ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
                {running ? t("vaptScanRunning") : t("vaptLaunch")}
              </Button>
              {running && <Progress value={70} className="w-40 h-2" aria-label={t("vaptScanRunning")} />}
            </div>
            {result && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> {result.scan.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.scan.targetCount} {t("vaptScanTargetsCount")} · {result.scan.newCount} {t("vaptScanNew")} · {result.scan.knownCount} {t("vaptScanKnown")}
                  {" · "}{result.scan.engineMode === "hybrid" ? t("vaptEngineHybrid") : t("vaptEngineSim")}
                </p>
                {result.dastReports && result.dastReports.length > 0 && (
                  <div className="grid gap-1.5">
                    {result.dastReports.map((r) => (
                      <div key={r.target} className="rounded-md border bg-background px-2 py-1.5">
                        <p className="text-xs font-medium font-mono">{r.asset} — {r.target} {r.reachable ? "" : "· ⚠ unreachable"}</p>
                        <p className="mt-0.5 flex flex-wrap gap-1">
                          {r.checks.map((c) => (
                            <Badge key={c.id} variant="outline" className={`text-[10px] ${c.result === "pass" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" : c.result === "fail" ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300" : ""}`}>
                              {c.id}: {c.result}
                            </Badge>
                          ))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("vaptRecentScans")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {scans === null ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : scans.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">—</p>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-420px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("vaptScanName")}</TableHead>
                    <TableHead>{t("vaptScanType")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("vaptScanNew")} / {t("vaptScanKnown")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("completedOn")}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-64">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        {isSuperAdmin && s.organization && <p className="text-xs text-muted-foreground">{s.organization.name}</p>}
                        <p className="text-xs text-muted-foreground">{s.dastReal ? t("vaptEngineHybrid") : t("vaptEngineSim")}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="whitespace-nowrap">{s.scanType}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`whitespace-nowrap ${s.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" : s.status === "FAILED" ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"}`}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {s.newCount} / {s.knownCount}
                        <p className="text-xs text-muted-foreground">{s.targetCount} {t("vaptScanTargetsCount")}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {fmtDate(s.completedAt ?? s.startedAt)}
                        {s.durationMs !== null && <p>{(s.durationMs / 1000).toFixed(1)}s</p>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openDetail(s.id)}>
                          <Eye className="h-3.5 w-3.5" aria-hidden /> {t("vaptViewEvidence")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.scan.name}</DialogTitle>
            <DialogDescription>{detail?.vulnerabilities.length ?? 0} {t("vaptTabVulns").toLowerCase()}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1.5 pr-2">
              {(detail?.vulnerabilities ?? []).map((v) => (
                <div key={v.id} className="rounded-lg border px-3 py-2">
                  <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                    {v.cveId && <code className="text-xs font-semibold">{v.cveId}</code>}
                    <SeverityBadge severity={v.severity} />
                    <PriorityBadge score={v.priorityScore} cls={v.priorityClass} />
                  </p>
                  <p className="mt-1 text-sm">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.asset.name} · CVSS {v.cvssScore.toFixed(1)} · EPSS {(v.epss * 100).toFixed(0)}%</p>
                </div>
              ))}
              {detail && detail.vulnerabilities.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">—</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Vulnerabilities tab ──────────────────────────────────────────────────────

function VulnsTab({ vulns, canManage, isSuperAdmin, onChanged }: {
  vulns: VulnRowDTO[] | null; canManage: boolean; isSuperAdmin: boolean; onChanged: () => void;
}) {
  const { t } = useI18n();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [sla, setSla] = useState("all");
  const [kevOnly, setKevOnly] = useState(false);
  const [promotedOnly, setPromotedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<VulnRowDTO | null>(null);
  const [acceptNote, setAcceptNote] = useState("");
  const [evidenceTarget, setEvidenceTarget] = useState<VulnRowDTO | null>(null);

  const filtered = useMemo(() => {
    if (!vulns) return null;
    const query = q.toLowerCase().trim();
    return vulns.filter((v) => {
      if (severity !== "all" && v.severity !== severity) return false;
      if (status !== "all" && v.status !== status) return false;
      if (sla !== "all" && v.slaState !== sla) return false;
      if (kevOnly && !v.kev) return false;
      if (promotedOnly && !v.promotedFindingId) return false;
      if (query && !v.title.toLowerCase().includes(query) && !(v.cveId ?? "").toLowerCase().includes(query) && !v.asset.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [vulns, severity, status, sla, kevOnly, promotedOnly, q]);

  const slaCounts = useMemo(() => {
    if (!vulns) return null;
    const c = { overdue: 0, dueSoon: 0, onTrack: 0, closedLate: 0, closedOnTime: 0, accepted: 0 };
    for (const v of vulns) {
      if (v.slaState === "OVERDUE") c.overdue++;
      else if (v.slaState === "DUE_SOON") c.dueSoon++;
      else if (v.slaState === "ON_TRACK") c.onTrack++;
      else if (v.slaState === "CLOSED_LATE") c.closedLate++;
      else if (v.slaState === "CLOSED_ON_TIME") c.closedOnTime++;
      else c.accepted++;
    }
    return c;
  }, [vulns]);

  const updateStatus = async (v: VulnRowDTO, newStatus: string, note?: string) => {
    setUpdating(v.id);
    try {
      await api(`/api/vapt/vulnerabilities/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus, note }) });
      toast.success(`${t("status")}: ${newStatus === "accepted" ? t("vaptStAccepted") : newStatus}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setUpdating(null);
      setAcceptTarget(null);
    }
  };

  const requestStatus = (v: VulnRowDTO, newStatus: string) => {
    if (newStatus === "accepted") {
      setAcceptTarget(v);
      setAcceptNote("");
      return;
    }
    updateStatus(v, newStatus);
  };

  const promote = async (v: VulnRowDTO) => {
    setUpdating(v.id);
    try {
      await api(`/api/vapt/vulnerabilities/${v.id}/promote`, { method: "POST" });
      toast.success(t("vaptPromotedBadge"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {slaCounts && slaCounts.overdue + slaCounts.dueSoon > 0 && (
        <Card className="border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">
              {slaCounts.overdue} {t("slaOverdueCard")} · {slaCounts.dueSoon} {t("slaDueSoonCard")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger aria-label={t("allSeverities")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSeverities")}</SelectItem>
            <SelectItem value="critical">{t("critical")}</SelectItem>
            <SelectItem value="high">{t("high")}</SelectItem>
            <SelectItem value="medium">{t("medium")}</SelectItem>
            <SelectItem value="low">{t("vaptLow")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label={t("allStatuses")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="open">{t("stOpen")}</SelectItem>
            <SelectItem value="in_progress">{t("stProgress")}</SelectItem>
            <SelectItem value="remediated">{t("stRemediated")}</SelectItem>
            <SelectItem value="accepted">{t("vaptStAccepted")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sla} onValueChange={setSla}>
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
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vaptVulnSearchPh")} aria-label={t("vaptVulnSearchPh")} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={kevOnly} onCheckedChange={(v) => setKevOnly(v === true)} aria-label={t("vaptKevOnly")} />
          <span className="text-muted-foreground">{t("vaptKevOnly")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={promotedOnly} onCheckedChange={(v) => setPromotedOnly(v === true)} aria-label={t("vaptPromotedOnly")} />
          <span className="text-muted-foreground">{t("vaptPromotedOnly")}</span>
        </label>
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
                    <TableHead>CVE / {t("rule")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("vaptAssetCol")}</TableHead>
                    <TableHead>CVSS / EPSS</TableHead>
                    <TableHead>{t("vaptPriorityCol")}</TableHead>
                    <TableHead>{t("slaTitle")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-72">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {v.cveId ? <code className="text-xs font-semibold">{v.cveId}</code> : <CategoryBadge category={v.category} />}
                          <SeverityBadge severity={v.severity} />
                          {v.kev && <KevBadge kev />}
                        </div>
                        <p className="text-sm mt-1 font-medium">{v.title}</p>
                        {isSuperAdmin && v.organization && <p className="text-xs text-muted-foreground">{v.organization.name}</p>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm font-medium max-w-40 truncate">{v.asset.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-40">{v.asset.identifier}</p>
                        <KindBadge kind={v.asset.kind} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        <p className="font-bold">{v.cvssScore.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">EPSS {(v.epss * 100).toFixed(0)}%</p>
                      </TableCell>
                      <TableCell><PriorityBadge score={v.priorityScore} cls={v.priorityClass} /></TableCell>
                      <TableCell>
                        <SlaBadge state={v.slaState} daysRemaining={v.daysRemaining} dueAt={v.dueAt} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <VulnStatusBadge status={v.status} />
                          {canManage && (
                            <Select value={v.status} onValueChange={(nv) => requestStatus(v, nv)} disabled={updating === v.id}>
                              <SelectTrigger className="h-7 w-7 border-0 p-0 justify-center" aria-label={`${t("status")} ${v.cveId ?? v.title.slice(0, 30)}`}>
                                <span className="text-xs text-muted-foreground">⋯</span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">{t("stOpen")}</SelectItem>
                                <SelectItem value="in_progress">{t("stProgress")}</SelectItem>
                                <SelectItem value="remediated">{t("stRemediated")}</SelectItem>
                                <SelectItem value="accepted">{t("vaptStAccepted")}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEvidenceTarget(v)} aria-label={`${t("vaptViewEvidence")} ${v.cveId ?? v.title.slice(0, 30)}`}>
                            <FileJson className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          {canManage && !v.promotedFindingId && ["critical", "high", "medium"].includes(v.severity) && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => promote(v)} disabled={updating === v.id}>
                              {t("vaptPromote")}
                            </Button>
                          )}
                          {v.promotedFindingId && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 whitespace-nowrap text-[10px]">
                              {t("vaptPromotedBadge")}
                            </Badge>
                          )}
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

      {/* Risk acceptance dialog */}
      <Dialog open={acceptTarget !== null} onOpenChange={(o) => { if (!o) setAcceptTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("vaptAcceptTitle")}</DialogTitle>
            <DialogDescription>{t("vaptAcceptDesc")}</DialogDescription>
          </DialogHeader>
          {acceptTarget && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              <code className="font-semibold">{acceptTarget.cveId ?? ""}</code> {acceptTarget.title}
            </p>
          )}
          <div className="grid gap-2">
            <label htmlFor="vapt-accept-note" className="text-sm font-medium">{t("vaptAcceptLabel")}</label>
            <Textarea id="vapt-accept-note" rows={3} value={acceptNote} onChange={(e) => setAcceptNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)}>Cancel</Button>
            <Button
              onClick={() => acceptTarget && updateStatus(acceptTarget, "accepted", acceptNote.trim())}
              disabled={acceptNote.trim().length < 5}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {t("vaptStAccepted")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence / proof dialog */}
      <Dialog open={evidenceTarget !== null} onOpenChange={(o) => { if (!o) setEvidenceTarget(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" aria-hidden /> {t("vaptEvidence")}</DialogTitle>
            <DialogDescription>
              {evidenceTarget?.cveId ? `${evidenceTarget.cveId} — ` : ""}{evidenceTarget?.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("vaptRemediationCol")}</p>
                <p className="mt-1 rounded-lg bg-muted/50 px-3 py-2">{evidenceTarget?.remediation}</p>
              </div>
              {evidenceTarget?.cvssVector && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">CVSS v3.1</p>
                  <p className="mt-1 font-mono text-xs">{evidenceTarget.cvssVector} — {evidenceTarget.cvssScore.toFixed(1)}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("vaptEvidence")}</p>
                {evidenceTarget?.evidence ? (
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(evidenceTarget.evidence, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1 text-muted-foreground">—</p>
                )}
              </div>
              {evidenceTarget?.promotedFindingId && (
                <p className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("vaptPromotedBadge")} — {t("vaptPromoteHelp")}
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
