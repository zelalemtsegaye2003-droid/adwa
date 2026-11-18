"use client";
/**
 * Adwa Cyber — VAPT Scopes & Authorization tab (plan §1 "Authorization first").
 *
 * The scan authorization gate made visible: request scopes (written
 * authorization objects), show the four-eyes approval state, approve/reject
 * drafts as the SECOND user, and verify the hash-chained audit trail with a
 * one-click tamper check (plan §Phase 11 governance).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldX, Link2, FileCheck2 } from "lucide-react";

interface ScopeRow {
  id: string;
  name: string;
  targets: string;
  targetsParsed?: { kind: string; value: string }[];
  owner: string;
  authorizationNote: string;
  validFrom: string;
  validUntil: string;
  status: string;
  intrusiveAllowed: boolean;
  fourEyes: boolean;
  live: boolean;
  requestedBy?: { email?: string };
  approvedBy?: { email?: string } | null;
}

interface AuditRow {
  seq: number;
  type: string;
  actorEmail: string;
  target?: string | null;
  action: string;
  result: string;
  createdAt: string;
}

interface Verification {
  rows: number;
  valid: boolean;
  firstBadSeq?: number;
  note: string;
}

/** Auto-detect the target kind from a raw entry: ip | cidr | url | domain. */
function detectKind(raw: string): { kind: string; value: string } | null {
  const v = raw.trim().toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(v)) return { kind: "cidr", value: v };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return { kind: "ip", value: v };
  if (/^https?:\/\//.test(v)) return { kind: "url", value: v };
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/.test(v) && v.length >= 2) return { kind: "domain", value: v };
  return null;
}

export function ScopesTab({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const [scopes, setScopes] = useState<ScopeRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    targets: "",
    owner: "",
    authorizationNote: "",
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    intrusiveAllowed: false,
  });

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        fetch("/api/vapt/scopes").then((r) => (r.ok ? r.json() : { scopes: [] })),
        fetch("/api/vapt/audit").then((r) => (r.ok ? r.json() : { chain: [] })),
      ]);
      setScopes(s.scopes ?? []);
      setAudit(a.chain ?? []);
    } catch {
      setScopes([]);
      setAudit([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createScope = async () => {
    setFormError(null);
    const targets = form.targets
      .split(/[,\n]/)
      .map((x) => detectKind(x))
      .filter((x): x is { kind: string; value: string } => x !== null);
    if (!form.name || !targets.length || !form.owner || !form.authorizationNote) {
      setFormError(t("vaptScopeFormIncomplete"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/vapt/scopes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          targets,
          owner: form.owner,
          authorizationNote: form.authorizationNote,
          validFrom: form.validFrom,
          validUntil: form.validUntil,
          intrusiveAllowed: form.intrusiveAllowed,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(j?.error ?? t("vaptScopeCreateFailed"));
      } else {
        setForm({ ...form, name: "", targets: "", owner: "", authorizationNote: "" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusy(true);
    try {
      await fetch(`/api/vapt/scopes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason: action === "reject" ? "withdrawn from the scope console" : undefined }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const verifyChain = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/vapt/audit?verify=1");
      const j = await res.json().catch(() => ({}));
      setVerification(j.verification ?? null);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toISOString().slice(0, 10);

  const targetSummary = useMemo(() => {
    return (s: ScopeRow) =>
      (s.targetsParsed ?? []).map((t) => `${t.kind === "cidr" ? "🌐" : t.kind === "ip" ? "📍" : t.kind === "url" ? "🔗" : "🏷"} ${t.value}`);
  }, []);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> {t("vaptScopesTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("vaptScopesIntro")}</p>
          {scopes === null ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("vaptScopeColName")}</TableHead>
                    <TableHead>{t("vaptScopeColTargets")}</TableHead>
                    <TableHead>{t("vaptScopeColWindow")}</TableHead>
                    <TableHead>{t("vaptScopeColStatus")}</TableHead>
                    <TableHead className="text-right">{t("vaptScopeColActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[220px] align-top">
                        <div className="font-medium">{s.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t("vaptScopeOwner")}: {s.owner}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                      <div className="flex max-w-[280px] flex-wrap gap-1 py-0.5">
                        {targetSummary(s).map((chip, i) => (
                          <span
                            key={i}
                            title={s.targetsParsed?.[i]?.value ?? chip}
                            className="inline-flex max-w-full items-center overflow-hidden whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            <span className="truncate">{chip}</span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                      <TableCell className="py-2 align-top text-xs tabular-nums">
                        <div className="whitespace-nowrap">{fmt(s.validFrom)}</div>
                        <div className="whitespace-nowrap text-muted-foreground">→ {fmt(s.validUntil)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={s.status === "APPROVED" ? "default" : s.status === "DRAFT" ? "secondary" : "destructive"}>
                            {s.status}
                          </Badge>
                          {s.status === "APPROVED" && (
                            <Badge variant={s.fourEyes ? "default" : "destructive"} className="gap-1">
                              {s.fourEyes ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                              {t("vaptScopeFourEyes")}
                            </Badge>
                          )}
                          {s.intrusiveAllowed && <Badge variant="outline">{t("vaptScopeIntrusive")}</Badge>}
                          {!s.live && s.status === "APPROVED" && <Badge variant="outline">{t("vaptScopeExpired")}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && s.status === "DRAFT" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(s.id, "approve")}>
                              {t("vaptScopeApprove")}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(s.id, "reject")}>
                              {t("vaptScopeReject")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!scopes.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                        {t("vaptScopeEmpty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("vaptScopeFourEyesNote")}</p>

          {canManage && (
            <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-2">
              <Input placeholder={t("vaptScopeFName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder={t("vaptScopeFOwner")} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              <Input
                className="md:col-span-2"
                placeholder={t("vaptScopeFTargets")}
                value={form.targets}
                onChange={(e) => setForm({ ...form, targets: e.target.value })}
              />
              <Input
                className="md:col-span-2"
                placeholder={t("vaptScopeFNote")}
                value={form.authorizationNote}
                onChange={(e) => setForm({ ...form, authorizationNote: e.target.value })}
              />
              <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
                <input type="checkbox" checked={form.intrusiveAllowed} onChange={(e) => setForm({ ...form, intrusiveAllowed: e.target.checked })} />
                {t("vaptScopeFIntrusive")}
              </label>
              {formError && <p className="text-xs text-destructive md:col-span-2">{formError}</p>}
              <div className="md:col-span-2">
                <Button size="sm" disabled={busy} onClick={createScope}>
                  <FileCheck2 className="mr-1 h-4 w-4" /> {t("vaptScopeFSubmit")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" /> {t("vaptAuditTitle")}
            <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={verifyChain}>
              {t("vaptAuditVerify")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {verification && (
            <p className={`rounded-lg border px-3 py-2 text-xs ${verification.valid ? "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
              {verification.note}
            </p>
          )}
          {audit === null ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("vaptAuditColType")}</TableHead>
                    <TableHead>{t("vaptAuditColAction")}</TableHead>
                    <TableHead>{t("vaptAuditColActor")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.slice(0, 40).map((row) => (
                    <TableRow key={row.seq}>
                      <TableCell className="tabular-nums text-xs">{row.seq}</TableCell>
                      <TableCell>
                        <Badge variant={row.type.includes("REJECT") || row.type.includes("FAIL") || row.type.includes("BLOCK") ? "destructive" : "secondary"} className="text-[10px]">
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px] text-xs">
                        <div className="truncate" title={row.action}>{row.action}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.actorEmail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("vaptAuditNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
