"use client";

/**
 * Adwa Cyber — CII Monitoring Readiness view (proposal Phase 5, Track C).
 *
 * The view is deliberately a GOVERNANCE console, not a collection console:
 * it shows, per designated operator, the two gate preconditions (in-force MOU
 * with enumerated scope + ACTIVE INSA authorisation), the registered critical
 * systems and their readiness. MONITORING_AUTHORIZED is only ever reachable
 * through the API when the operator's gate is open — the server enforces it
 * and this UI surfaces the refusal.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Factory, RefreshCw, Plus, FileSignature, Landmark, Server, CheckCircle2, XCircle,
  Eye, ShieldAlert, EyeOff, ArrowRightCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import {
  CII_MOU_STATUS_LABELS, CII_AUTH_STATUS_LABELS, CII_READINESS_LABELS,
  CII_MOU_STATUSES, CII_AUTH_STATUSES, CII_SYSTEM_READINESS,
  CII_SYSTEM_CATEGORIES, CII_SECTORS,
  type CiiMouStatus, type CiiAuthStatus, type CiiSystemReadiness,
} from "@/lib/governance/cii-engine";

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface GateDTO {
  operatorId: string;
  operatorCode: string;
  mouGate: boolean;
  mouStatus: CiiMouStatus | null;
  insaGate: boolean;
  authStatus: CiiAuthStatus | null;
  gateOpen: boolean;
  unmetGates: string[];
}

interface MouDTO {
  id: string;
  version: number;
  status: string;
  scope: string; // JSON array of authorised telemetry domains
  dataTerms: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  updatedAt: string;
}

interface AuthDTO {
  id: string;
  reference: string | null;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  scope: string | null;
  notes: string | null;
  updatedAt: string;
}

interface SystemDTO {
  id: string;
  name: string;
  nameAm: string | null;
  category: string;
  criticality: string;
  readiness: string;
  effectiveReadiness: string;
  notes: string | null;
  updatedAt: string;
}

interface OperatorDTO {
  id: string;
  code: string;
  name: string;
  nameAm: string;
  sector: string;
  tier: string;
  orgId: string | null;
  contactEmail: string | null;
  tenantName?: string | null;
  gate: GateDTO;
  mous: MouDTO[];
  authorizations: AuthDTO[];
  systems: SystemDTO[];
}

interface OverviewDTO {
  scope: "platform" | "tenant";
  readOnly: boolean;
  linked?: boolean;
  generatedAt?: string;
  summary?: {
    operators: number;
    gatesOpen: number;
    systemsTotal: number;
    systemsMonitoring: number;
    mousInForce: number;
    insaInForce: number;
  };
  operators: OperatorDTO[];
}

// ── Small shared pieces ──────────────────────────────────────────────────────

function parseScope(scopeJson: string): string[] {
  try {
    const v = JSON.parse(scopeJson);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const MOU_PILL: Record<string, string> = {
  DRAFTING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  LEGAL_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  SIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  TERMINATED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const AUTH_PILL: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  GRANTED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  REVOKED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function ReadinessPill({ readiness, effective }: { readiness: string; effective: string }) {
  const { pick } = useI18n();
  const suspended = effective === "SUSPENDED_GATE_SHUT";
  const lbl = CII_READINESS_LABELS[readiness as CiiSystemReadiness];
  const cls =
    suspended
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : readiness === "MONITORING_AUTHORIZED"
        ? "bg-emerald-700 text-white"
        : readiness === "AGENT_READY"
          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
          : readiness === "INVENTORY_MAPPED"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {suspended ? <EyeOff className="h-3 w-3" aria-hidden /> : null}
      {suspended
        ? pick("Suspended — gate shut", "ቆሟል — በሩ ዝግ ነው")
        : lbl
          ? pick(lbl[0], lbl[1])
          : readiness}
    </span>
  );
}

function GateChip({ ok, label, statusLabel }: { ok: boolean; label: string; statusLabel: string | null }) {
  const { pick } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
      <span className="font-semibold">{label}</span>
      {statusLabel ? <span className="opacity-75">· {statusLabel}</span> : <span className="opacity-75">· {pick("none", "የለም")}</span>}
    </span>
  );
}

function mouStatusLabel(s: string | null): string | null {
  if (!s) return null;
  const l = CII_MOU_STATUS_LABELS[s as CiiMouStatus];
  return l ? l[0] : s;
}
function authStatusLabel(s: string | null): string | null {
  if (!s) return null;
  const l = CII_AUTH_STATUS_LABELS[s as CiiAuthStatus];
  return l ? l[0] : s;
}

// ── View ─────────────────────────────────────────────────────────────────────

export function CiiMonitorView({ canManage }: { canManage: boolean }) {
  const { t, pick, lang } = useI18n();
  const [ov, setOv] = useState<OverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const [addOperatorOpen, setAddOperatorOpen] = useState(false);
  const [mouTarget, setMouTarget] = useState<OperatorDTO | null>(null); // record new MOU
  const [advanceMou, setAdvanceMou] = useState<{ mou: MouDTO; op: OperatorDTO } | null>(null);
  const [authTarget, setAuthTarget] = useState<OperatorDTO | null>(null); // record new INSA auth
  const [advanceAuth, setAdvanceAuth] = useState<AuthDTO | null>(null);
  const [systemTarget, setSystemTarget] = useState<OperatorDTO | null>(null); // register system
  const [advanceSystem, setAdvanceSystem] = useState<SystemDTO | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await api<OverviewDTO>("/api/cii/overview"));
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : pick("Failed to load the CII readiness register", "የCII ዝግጅት መዝገብ መጫን አልተሳካም"));
    } finally {
      setLoading(false);
    }
  }, [pick]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const operators = ov?.operators ?? [];
  const byCode = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);

  if (loading || !ov) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      </div>
    );
  }

  const isTenant = ov.scope === "tenant";
  const summary = ov.summary ?? {
    operators: operators.length,
    gatesOpen: operators.filter((o) => o.gate.gateOpen).length,
    systemsTotal: operators.reduce((a, o) => a + o.systems.length, 0),
    systemsMonitoring: operators.reduce((a, o) => a + o.systems.filter((s) => s.readiness === "MONITORING_AUTHORIZED").length, 0),
    mousInForce: operators.filter((o) => o.gate.mouGate).length,
    insaInForce: operators.filter((o) => o.gate.insaGate).length,
  };

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
          <Factory className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("ciiTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("ciiSub")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden /> {pick("Refresh", "ተመለስ")}
        </Button>
        {canManage && !isTenant && (
          <Button size="sm" onClick={() => setAddOperatorOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> {t("ciiAddOperator")}
          </Button>
        )}
      </div>
    </div>
  );

  // ── Tenant (read-only) scope ─────────────────────────────────────────────
  if (isTenant) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        {header}
        <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden />
            <p className="text-sm text-sky-900 dark:text-sky-200">{t("ciiTenantView")}</p>
          </CardContent>
        </Card>
        {!ov.linked ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {pick(
                "Your organization is not designated as a CII operator on this platform.",
                "ድርጅትዎ በዚህ መድረኽ ላይ እንደ CII አስተዳደር አልተመዘገበም።"
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {operators.map((op) => <OperatorGateCard key={op.id} op={op} lang={lang} />)}
          </div>
        )}
      </div>
    );
  }

  // ── Platform scope ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4 md:p-6">
      {header}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("ciiTabOverview")}</TabsTrigger>
          <TabsTrigger value="operators">{t("ciiTabOperators")}</TabsTrigger>
          <TabsTrigger value="auth">{t("ciiTabAuth")}</TabsTrigger>
          <TabsTrigger value="systems">{t("ciiTabSystems")}</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Factory} label={t("ciiOperators")} value={`${summary.operators}`} sub={pick(`${summary.mousInForce} MOUs in force`, `${summary.mousInForce} MOU በሀይል ላይ`)} />
            <KpiCard icon={ShieldAlert} label={t("ciiAuthorized")} value={`${summary.gatesOpen}`} sub={pick(`${summary.insaInForce} INSA in force`, `${summary.insaInForce} INSA በሀይል ላይ`)} />
            <KpiCard icon={Server} label={t("ciiSystems")} value={`${summary.systemsTotal}`} sub={pick("registered critical systems", "የተመዘገቡ ወሳኝ ሥርዓቶች")} />
            <KpiCard icon={Eye} label={t("ciiSystemsMonitored")} value={`${summary.systemsMonitoring}`} sub={pick("of registered systems", "ከተመዘገቡ ሥርዓቶች")} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {operators.map((op) => <OperatorGateCard key={op.id} op={op} lang={lang} />)}
            {operators.length === 0 && (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{pick("No CII operators designated yet.", "እስካሁን CII አስተዳደር አልተመዘገበም።")}</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* Tab 2 — Operators & MOUs */}
        <TabsContent value="operators" className="mt-4 space-y-4">
          {operators.map((op) => (
            <Card key={op.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white">
                      <Landmark className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {lang === "en" ? op.name : op.nameAm}
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground">{op.code}</span>
                      </CardTitle>
                      <CardDescription className="mt-0.5 text-xs">
                        {op.sector} · {op.tier}
                        {op.tenantName ? ` · ${pick("tenant", "ተከራይ")}: ${op.tenantName}` : ""}
                        {op.contactEmail ? ` · ${op.contactEmail}` : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GateChip ok={op.gate.mouGate} label={t("ciiMouGate")} statusLabel={mouStatusLabel(op.gate.mouStatus)} />
                    <GateChip ok={op.gate.insaGate} label={t("ciiInsaGate")} statusLabel={authStatusLabel(op.gate.authStatus)} />
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => setMouTarget(op)}>
                        <FileSignature className="mr-1 h-3.5 w-3.5" aria-hidden /> {t("ciiAddMou")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {op.mous.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{t("ciiNoMous")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("ciiVersion")}</TableHead>
                        <TableHead>{t("ciiMouStatus")}</TableHead>
                        <TableHead>{t("ciiScope")}</TableHead>
                        <TableHead>{t("ciiSigned")}</TableHead>
                        <TableHead>{t("ciiExpires")}</TableHead>
                        {canManage && <TableHead className="text-right">—</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {op.mous.map((m) => {
                        const lbl = CII_MOU_STATUS_LABELS[m.status as CiiMouStatus];
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs font-semibold">v{m.version}</TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${MOU_PILL[m.status] ?? MOU_PILL.DRAFTING}`}>
                                {lbl ? pick(lbl[0], lbl[1]) : m.status}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <span className="flex flex-wrap gap-1">
                                {parseScope(m.scope).map((s) => (
                                  <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">{s}</span>
                                ))}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">{fmtDay(m.signedAt)}</TableCell>
                            <TableCell className="text-xs">{fmtDay(m.expiresAt)}</TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => setAdvanceMou({ mou: m, op })}>
                                  <ArrowRightCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> {pick("Advance", "አሳልፍ")}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Tab 3 — INSA authorisations */}
        <TabsContent value="auth" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{t("ciiTabAuth")}</CardTitle>
                  <CardDescription>
                    {pick(
                      "The regulatory licence to monitor — the second gate precondition per operator.",
                      "የክትትል ሕጋዊ ፈቃድ — ሁለተኛው የበር ቅድመ-ሁኔታ በአስተዳደር ደረጃ።"
                    )}
                  </CardDescription>
                </div>
                {canManage && operators.length > 0 && (
                  <Select onValueChange={(v) => { const op = byCode.get(v); if (op) setAuthTarget(op); }}>
                    <SelectTrigger className="w-56"><SelectValue placeholder={t("ciiAddAuth")} /></SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>{op.code} — {lang === "en" ? op.name : op.nameAm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {operators.every((o) => o.authorizations.length === 0) ? (
                <p className="py-3 text-sm text-muted-foreground">{t("ciiNoAuths")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{pick("Operator", "አስተዳደር")}</TableHead>
                      <TableHead>{t("ciiReference")}</TableHead>
                      <TableHead>{t("ciiAuthStatus")}</TableHead>
                      <TableHead>{t("ciiIssued")}</TableHead>
                      <TableHead>{t("ciiExpires")}</TableHead>
                      {canManage && <TableHead className="text-right">—</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operators.flatMap((op) =>
                      op.authorizations.map((a) => {
                        const lbl = CII_AUTH_STATUS_LABELS[a.status as CiiAuthStatus];
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm font-medium">
                              {op.code}
                              <span className="ml-1.5 text-xs text-muted-foreground">{lang === "en" ? op.name : op.nameAm}</span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{a.reference ?? "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${AUTH_PILL[a.status] ?? AUTH_PILL.PENDING}`}>
                                {lbl ? pick(lbl[0], lbl[1]) : a.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">{fmtDay(a.issuedAt)}</TableCell>
                            <TableCell className="text-xs">{fmtDay(a.expiresAt)}</TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => setAdvanceAuth(a)}>
                                  <ArrowRightCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> {pick("Advance", "አሳልፍ")}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4 — Critical systems */}
        <TabsContent value="systems" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{t("ciiTabSystems")}</CardTitle>
                  <CardDescription>{t("ciiAddSystemDesc")}</CardDescription>
                </div>
                {canManage && operators.length > 0 && (
                  <Select onValueChange={(v) => { const op = byCode.get(v); if (op) setSystemTarget(op); }}>
                    <SelectTrigger className="w-56"><SelectValue placeholder={t("ciiAddSystem")} /></SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>{op.code} — {lang === "en" ? op.name : op.nameAm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {operators.every((o) => o.systems.length === 0) ? (
                <p className="py-3 text-sm text-muted-foreground">{t("ciiNoSystems")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{pick("System", "ሥርዓት")}</TableHead>
                      <TableHead>{pick("Operator", "አስተዳደር")}</TableHead>
                      <TableHead>{t("ciiCategory")}</TableHead>
                      <TableHead>{t("ciiCriticality")}</TableHead>
                      <TableHead>{t("ciiReadiness")}</TableHead>
                      {canManage && <TableHead className="text-right">—</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operators.flatMap((op) =>
                      op.systems.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm font-medium">{lang === "am" && s.nameAm ? s.nameAm : s.name}</TableCell>
                          <TableCell className="text-xs">{op.code}</TableCell>
                          <TableCell className="font-mono text-[11px]">{s.category.replaceAll("_", " ")}</TableCell>
                          <TableCell>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.criticality === "CRITICAL" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                              {s.criticality}
                            </span>
                          </TableCell>
                          <TableCell><ReadinessPill readiness={s.readiness} effective={s.effectiveReadiness} /></TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={s.readiness === "MONITORING_AUTHORIZED"}
                                onClick={() => setAdvanceSystem(s)}
                              >
                                <ArrowRightCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> {pick("Advance", "አሳልፍ")}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {addOperatorOpen && (
        <AddOperatorDialog
          onClose={() => setAddOperatorOpen(false)}
          onSaved={() => { setAddOperatorOpen(false); void refresh(); }}
        />
      )}
      {mouTarget && (
        <AddMouDialog
          op={mouTarget}
          onClose={() => setMouTarget(null)}
          onSaved={() => { setMouTarget(null); void refresh(); }}
        />
      )}
      {advanceMou && (
        <AdvanceMouDialog
          mou={advanceMou.mou}
          op={advanceMou.op}
          onClose={() => setAdvanceMou(null)}
          onSaved={() => { setAdvanceMou(null); void refresh(); }}
        />
      )}
      {authTarget && (
        <AddAuthDialog
          op={authTarget}
          onClose={() => setAuthTarget(null)}
          onSaved={() => { setAuthTarget(null); void refresh(); }}
        />
      )}
      {advanceAuth && (
        <AdvanceAuthDialog
          auth={advanceAuth}
          onClose={() => setAdvanceAuth(null)}
          onSaved={() => { setAdvanceAuth(null); void refresh(); }}
        />
      )}
      {systemTarget && (
        <AddSystemDialog
          op={systemTarget}
          onClose={() => setSystemTarget(null)}
          onSaved={() => { setSystemTarget(null); void refresh(); }}
        />
      )}
      {advanceSystem && (
        <AdvanceSystemDialog
          system={advanceSystem}
          onClose={() => setAdvanceSystem(null)}
          onSaved={() => { setAdvanceSystem(null); void refresh(); }}
        />
      )}
    </div>
  );
}

// ── Operator gate card (shared by both scopes) ───────────────────────────────

function OperatorGateCard({ op, lang }: { op: OperatorDTO; lang: string }) {
  const { t, pick } = useI18n();
  const monitoring = op.systems.filter((s) => s.readiness === "MONITORING_AUTHORIZED").length;
  const open = op.gate.gateOpen;
  return (
    <Card className={open ? "border-emerald-200 dark:border-emerald-950" : "border-red-200 dark:border-red-950"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${open ? "bg-emerald-700" : "bg-red-700"}`}>
              {open ? <CheckCircle2 className="h-4.5 w-4.5" aria-hidden /> : <ShieldAlert className="h-4.5 w-4.5" aria-hidden />}
            </div>
            <div>
              <p className="font-semibold leading-tight">{lang === "en" ? op.name : op.nameAm}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono font-semibold">{op.code}</span> · {op.sector} · {op.tier}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${open ? "bg-emerald-700 text-white" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
            {open ? t("ciiAuthorized") : t("ciiGated")}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <GateChip ok={op.gate.mouGate} label={t("ciiMouGate")} statusLabel={mouStatusLabel(op.gate.mouStatus)} />
          <GateChip ok={op.gate.insaGate} label={t("ciiInsaGate")} statusLabel={authStatusLabel(op.gate.authStatus)} />
        </div>
        {!open && op.gate.unmetGates.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("ciiBlockedReason")}: {op.gate.unmetGates.join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("ciiSystems")}: {op.systems.length}
          {monitoring > 0 ? ` · ${monitoring} ${t("ciiSystemsMonitored")}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

function AddOperatorDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameAm, setNameAm] = useState("");
  const [sector, setSector] = useState<string>("Energy");
  const [contactEmail, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
      toast.error(pick("Code must be 2–20 characters: A–Z, digits, dashes.", "ኮድ 2–20 ፊደላት መሆን አለበት፦ A–Z፣ ቁጥሮች፣ መስመሮች።"));
      return;
    }
    if (name.trim().length < 3) {
      toast.error(pick("Name is required (min 3 characters).", "ስም ያስፈልጋል (ቢያንስ 3 ፊደላት)።"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/cii/operators", {
        method: "POST",
        body: JSON.stringify({ code, name, nameAm: nameAm || name, sector, tier: "TIER1", contactEmail }),
      });
      toast.success(pick("CII operator designated", "CII አስተዳደር ተመዝግቧል"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ciiAddOperator")}</DialogTitle>
          <DialogDescription>{t("ciiAddOperatorDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EEP" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Sector", "ዘርፍ")}</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CII_SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{pick("Name (English)", "ስም (እንግሊዝኛ)")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ethiopian Electric Power" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{pick("Name (Amharic)", "ስም (አማርኛ)")}</Label>
            <Input value={nameAm} onChange={(e) => setNameAm(e.target.value)} placeholder="የኢትዮጵያ ኤሌክትሪክ ኃይል" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{pick("Contact email", "የእውቂያ ኢሜይል")}</Label>
            <Input value={contactEmail} onChange={(e) => setEmail(e.target.value)} placeholder="cio@operator.et" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Register", "መዝግብ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMouDialog({ op, onClose, onSaved }: { op: OperatorDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [scope, setScope] = useState("");
  const [dataTerms, setDataTerms] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const items = scope.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) {
      toast.error(pick("Enumerate at least one authorised telemetry domain (comma-separated).", "ቢያንስ አንድ የተፈቀደ የቴሌሜትሪ ወሰን ይዘርዝሩ (በነጥብ የተለዩ)።"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/cii/mous", {
        method: "POST",
        body: JSON.stringify({ operatorId: op.id, scope: items, dataTerms }),
      });
      toast.success(pick(`MOU version recorded for ${op.code}`, `ለ${op.code} የMOU ቅጽ ተመዝግቧል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ciiAddMou")} — {op.code}</DialogTitle>
          <DialogDescription>{t("ciiAddMouDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("ciiScope")}</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="NETFLOW, DNS_LOGS, SIEM_ALERTS" className="font-mono" />
            <p className="text-[11px] text-muted-foreground">
              {pick("Comma-separated telemetry domains. Nothing outside this list may ever be collected.", "በነጥብ የተለዩ የቴሌሜትሪ ወሰኖች። ከዚህ ዝርዝር ውጭ ምንም መሰብሰብ አይቻልም።")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Data handling terms", "የመረጃ አያያዝ ደንብ")}</Label>
            <Textarea rows={3} value={dataTerms} onChange={(e) => setDataTerms(e.target.value)} placeholder={pick("e.g. 90-day retention, quarterly scope audit, cross-border prohibition", "ለምሳሌ፦ 90-ቀን ጥበቃ፣ የሩብ ዓመት ኦዲት")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Record", "መዝግብ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceMouDialog({ mou, op, onClose, onSaved }: { mou: MouDTO; op: OperatorDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [status, setStatus] = useState(mou.status);
  const [signedAt, setSignedAt] = useState(mou.signedAt ? mou.signedAt.slice(0, 10) : "");
  const [expiresAt, setExpiresAt] = useState(mou.expiresAt ? mou.expiresAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const needsSign = status === "SIGNED" || status === "ACTIVE";

  const save = async () => {
    if (needsSign && !signedAt) {
      toast.error(pick("A signing date is required to mark this MOU SIGNED/ACTIVE.", "MOU ፊርማ/ንቁ ለማድረግ የፊርማ ቀን ያስፈልጋል።"));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/cii/mous/${mou.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          signedAt: signedAt || null,
          expiresAt: expiresAt || null,
        }),
      });
      toast.success(pick(`MOU v${mou.version} (${op.code}) advanced to ${status}`, `MOU v${mou.version} (${op.code}) ወደ ${status} አልፏል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pick(`Advance MOU v${mou.version}`, `MOU v${mou.version} አሳልፍ`)} — {op.code}</DialogTitle>
          <DialogDescription>
            {pick("Scope", "ወሰን")}: {parseScope(mou.scope).join(", ") || "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("ciiMouStatus")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CII_MOU_STATUSES.map((s) => {
                  const l = CII_MOU_STATUS_LABELS[s];
                  return <SelectItem key={s} value={s}>{pick(l[0], l[1])}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ciiSigned")}</Label>
            <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ciiExpires")}</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Save", "አስቀምጥ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAuthDialog({ op, onClose, onSaved }: { op: OperatorDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [reference, setReference] = useState("");
  const [scope, setScope] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/cii/authorizations", {
        method: "POST",
        body: JSON.stringify({ operatorId: op.id, reference, scope }),
      });
      toast.success(pick(`INSA authorisation application recorded for ${op.code}`, `ለ${op.code} የINSA ፈቃድ ማመልከቻ ተመዝግቧል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ciiAddAuth")} — {op.code}</DialogTitle>
          <DialogDescription>{t("ciiAddAuthDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("ciiReference")}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INSA/CII/2026/041" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ciiScope")}</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder={pick("e.g. OT telemetry + incident reporting", "ለምሳሌ፦ OT ቴሌሜትሪ + የክስተት ሪፖርት")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Record", "መዝግብ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceAuthDialog({ auth, onClose, onSaved }: { auth: AuthDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [status, setStatus] = useState(auth.status);
  const [issuedAt, setIssuedAt] = useState(auth.issuedAt ? auth.issuedAt.slice(0, 10) : "");
  const [expiresAt, setExpiresAt] = useState(auth.expiresAt ? auth.expiresAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const needsIssue = status === "GRANTED" || status === "ACTIVE";

  const save = async () => {
    if (needsIssue && !issuedAt) {
      toast.error(pick("An issue date is required to GRANT or ACTIVATE the licence.", "ፈቃዱን ለመስጠት ወይም ለማንቃት የተሰጠበት ቀን ያስፈልጋል።"));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/cii/authorizations/${auth.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, issuedAt: issuedAt || null, expiresAt: expiresAt || null }),
      });
      toast.success(pick(`INSA authorisation advanced to ${status}`, `የINSA ፈቃድ ወደ ${status} አልፏል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ciiTabAuth")}</DialogTitle>
          <DialogDescription>
            {auth.reference ?? pick("(no reference)", "(መመለሻ የለም)")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("ciiAuthStatus")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CII_AUTH_STATUSES.map((s) => {
                  const l = CII_AUTH_STATUS_LABELS[s];
                  return <SelectItem key={s} value={s}>{pick(l[0], l[1])}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ciiIssued")}</Label>
            <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ciiExpires")}</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Save", "አስቀምጥ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSystemDialog({ op, onClose, onSaved }: { op: OperatorDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [name, setName] = useState("");
  const [nameAm, setNameAm] = useState("");
  const [category, setCategory] = useState<string>("SCADA");
  const [criticality, setCriticality] = useState("CRITICAL");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 3) {
      toast.error(pick("System name is required (min 3 characters).", "የሥርዓት ስም ያስፈልጋል (ቢያንስ 3 ፊደላት)።"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/cii/systems", {
        method: "POST",
        body: JSON.stringify({ operatorId: op.id, name, nameAm: nameAm || null, category, criticality }),
      });
      toast.success(pick(`Critical system registered for ${op.code}`, `ለ${op.code} ወሳኝ ሥርዓት ተመዝግቧል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ciiAddSystem")} — {op.code}</DialogTitle>
          <DialogDescription>{t("ciiAddSystemDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{pick("System name", "የሥርዓት ስም")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="National Grid SCADA" />
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Name (Amharic, optional)", "ስም (አማርኛ፣ አማራጭ)")}</Label>
            <Input value={nameAm} onChange={(e) => setNameAm(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("ciiCategory")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CII_SYSTEM_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replaceAll("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("ciiCriticality")}</Label>
              <Select value={criticality} onValueChange={setCriticality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Register", "መዝግብ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceSystemDialog({ system, onClose, onSaved }: { system: SystemDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [readiness, setReadiness] = useState(system.readiness);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/cii/systems/${system.id}`, {
        method: "PATCH",
        body: JSON.stringify({ readiness }),
      });
      toast.success(pick(`Readiness advanced to ${readiness}`, `ዝግጅት ወደ ${readiness} አድጓል`));
      onSaved();
    } catch (e) {
      // 409 GATE_SHUT — the server refused: operator gate shut. Explain why.
      if (e instanceof ApiCallError) {
        toast.error(`${t("ciiAuthorizeBlocked")}`, { description: e.message });
      } else {
        toast.error("Failed");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pick("Advance readiness", "ዝግጅት አሳልፍ")} — {system.name}</DialogTitle>
          <DialogDescription>{t("ciiAddSystemDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("ciiReadiness")}</Label>
            <Select value={readiness} onValueChange={setReadiness}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CII_SYSTEM_READINESS.map((r) => {
                  const l = CII_READINESS_LABELS[r];
                  return <SelectItem key={r} value={r}>{pick(l[0], l[1])}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {readiness === "MONITORING_AUTHORIZED" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {pick(
                  "The server re-evaluates the operator's MOU and INSA gates on every call — this is refused (and audited) if either precondition is not in force.",
                  "ሰርቨሩ በእያንዳንዱ ጥሪ የMOU እና የINSA በሮችን እንደገና ይገመግማል — አንዱ ቅድመ-ሁኔታ ባይሟላ ተቀብሎ ይመዘገባል።"
                )}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Save", "አስቀምጥ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
