"use client";
/**
 * Adwa Cyber — VAPT EASM Discovery tab (NBE LOT4 §B "Asset Discovery &
 * External Attack Surface Management").
 *
 * The certificate-transparency + DNS discovery engine made visible: run a
 * (passive, authorization-gated) EASM sweep over an approved root domain and
 * browse the discovered-hostname registry with managed/shadow classification.
 * Source honesty is rendered verbatim: live CT query vs the labelled bundled
 * real snapshot fallback when crt.sh is unreachable.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Radar, ShieldAlert, ShieldCheck } from "lucide-react";

interface DiscoveryRow {
  id: string;
  domain: string;
  name: string;
  ipAddresses: string[];
  resolved: boolean;
  inScope: boolean;
  managed: boolean;
  sources: { ct?: { entryId: number; issuer: string; notBefore?: string } }[];
  firstSeenAt: string;
  lastSeenAt: string;
}

interface DiscoveryCounts {
  total: number;
  resolved: number;
  inScope: number;
  unmanaged: number;
  shadow: number;
}

interface RunResult {
  domain: string;
  source: "live-ct" | "bundled-ct-snapshot";
  snapshotAsOf?: string | null;
  sourceNote?: string;
  counts: DiscoveryCounts;
}

export function DiscoveryTab({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<DiscoveryRow[] | null>(null);
  const [counts, setCounts] = useState<DiscoveryCounts | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/vapt/discovery");
      const j = await res.json().catch(() => ({ discoveries: [], counts: null }));
      setRows(j.discoveries ?? []);
      setCounts(j.counts ?? null);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runDiscovery = useCallback(async () => {
    const d = domain.trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) {
      setError(t("vaptEasmDomainInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch("/api/vapt/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? t("vaptEasmRunFailed"));
      } else {
        setRun(j as RunResult);
        await load();
      }
    } catch {
      setError(t("vaptEasmRunFailed"));
    } finally {
      setBusy(false);
    }
  }, [domain, load, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("vaptEasmTitle")}</h3>
        <Badge variant="outline" className="whitespace-nowrap bg-muted/50">
          <Radar className="mr-1 h-3 w-3" />
          CT logs + DNS · {t("vaptEasmPassive")}
        </Badge>
      </div>
      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("vaptEasmIntro")}</p>

      {canManage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              {t("vaptEasmRunCard")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder={t("vaptEasmDomainPlaceholder")}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && runDiscovery()}
                className="max-w-sm"
              />
              <Button size="sm" onClick={runDiscovery} disabled={busy}>
                {busy ? t("vaptEasmRunning") : t("vaptEasmRun")}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {run && (
              <p className="text-xs text-muted-foreground">
                {t("vaptEasmRunResult")
                  .replace("{total}", String(run.counts.total))
                  .replace("{resolved}", String(run.counts.resolved))
                  .replace("{shadow}", String(run.counts.shadow))}
                {" — "}
                {run.source === "live-ct" ? t("vaptEasmSourceLive") : t("vaptEasmSourceSnapshot").replace("{asOf}", run.snapshotAsOf ?? "—")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {counts && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="font-semibold tabular-nums">{counts.total}</div>
            <div className="text-muted-foreground">{t("vaptEasmCountTotal")}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="font-semibold tabular-nums">{counts.resolved}</div>
            <div className="text-muted-foreground">{t("vaptEasmCountResolved")}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="font-semibold tabular-nums">{counts.inScope}</div>
            <div className="text-muted-foreground">{t("vaptEasmCountInScope")}</div>
          </div>
          <div className="rounded-lg border bg-orange-500/10 p-2">
            <div className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">{counts.shadow}</div>
            <div className="text-muted-foreground">{t("vaptEasmCountShadow")}</div>
          </div>
        </div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">{t("vaptEasmEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("vaptEasmColHost")}</TableHead>
                <TableHead>{t("vaptEasmColIps")}</TableHead>
                <TableHead>{t("vaptEasmColSource")}</TableHead>
                <TableHead>{t("vaptEasmColClass")}</TableHead>
                <TableHead>{t("vaptEasmColLastSeen")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 60).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="tabular-nums text-xs">{d.resolved ? d.ipAddresses.join(", ") : <span className="text-muted-foreground">{t("vaptEasmUnresolved")}</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.sources?.[0]?.ct ? `CT #${d.sources[0].ct.entryId} · ${(d.sources[0].ct.issuer ?? "").split("CN=")[1]?.split(",")[0] ?? d.sources[0].ct.issuer.slice(0, 24)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {d.inScope ? (
                        <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> {t("vaptEasmInScope")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-muted/50">
                          <ShieldAlert className="h-3 w-3" /> {t("vaptEasmOutOfScope")}
                        </Badge>
                      )}
                      {!d.managed && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                          {t("vaptEasmShadow")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(d.lastSeenAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
