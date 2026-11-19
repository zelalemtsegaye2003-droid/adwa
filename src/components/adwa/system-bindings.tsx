"use client";
/**
 * Adwa Cyber — Production Bindings console (Real-Data Roadmap Phase 3).
 *
 * The SUPER_ADMIN surface for GET /api/system/bindings: every external
 * integration in one honest table — Google SSO, SMTP mail, the Ethio-CERT
 * bilateral exchange, the public + keyed intel feeds, live EPSS, the
 * engine's offline-first catalogue. Each row carries the closed-set status
 * (live | mock | fixture | snapshot | unconfigured | disabled), what the
 * current mode actually serves, the exact env vars that flip it to
 * production, the snapshot as-of date and the ops refresh command.
 *
 * The same honesty pattern the data layer applies to every table row, now
 * applied to the binding layer itself: the incubator demo answers "which
 * parts are live?" in one glance, and flipping a binding is a named env
 * var — never a code change.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound, Mail, Landmark, Radar, Sparkles, Crosshair, RefreshCw, Lock, TerminalSquare, ShieldQuestion } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";
import { BINDING_DOMAINS, BINDING_DOMAIN_META, BINDING_STATUSES, BINDING_STATUS_META, type BindingDescriptor, type BindingReport, type BindingStatus } from "@/lib/bindings";

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  identity: KeyRound,
  mail: Mail,
  national: Landmark,
  intel: Radar,
  enrichment: Sparkles,
  vapt: Crosshair,
};

function StatusBadge({ status }: { status: BindingStatus }) {
  const { t } = useI18n();
  const meta = BINDING_STATUS_META[status];
  return (
    <Badge variant="outline" className={`whitespace-nowrap font-semibold ${meta.badgeClass}`}>
      {t(`sysSt_${status}`)}
    </Badge>
  );
}

function BindingRow({ b }: { b: BindingDescriptor }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{b.label}</p>
        <StatusBadge status={b.status} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.detail}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {b.envKeys.length > 0 ? (
          b.envKeys.map((k) => (
            <code
              key={k}
              title={t("sysEnvHint")}
              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {k}
            </code>
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground">{t("sysNoEnvKeys")}</span>
        )}
        {b.asOf && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {t("sysAsOf")} {b.asOf}
          </span>
        )}
      </div>
      {(b.refresh || b.docs) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {b.refresh && (
            <span className="inline-flex items-center gap-1">
              <TerminalSquare className="h-3 w-3" aria-hidden />
              <code className="font-mono">{b.refresh}</code>
            </span>
          )}
          {b.docs && <span className="inline-flex items-center gap-1"><ShieldQuestion className="h-3 w-3" aria-hidden />{b.docs}</span>}
        </div>
      )}
    </div>
  );
}

export function SystemBindingsView() {
  const { t } = useI18n();
  const [data, setData] = useState<BindingReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api<BindingReport>("/api/system/bindings")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const refresh = () => {
    setLoading(true);
    load();
  };

  const accent = "#0d9488"; // teal-600 — the ops/infrastructure identity of the system tab

  if (!data && !loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("sysRestricted")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip — the one-glance production posture */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{t("sysSummary")}</h3>
            {data && (
              <span className="text-[11px] text-muted-foreground">
                {t("sysGenerated")} {data.generatedAt.replace("T", " ").slice(0, 19)} UTC
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="ml-auto gap-1.5"
              aria-label={t("sysRefreshNow")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {t("sysRefreshNow")}
            </Button>
          </div>
          {data ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {BINDING_STATUSES.filter((s) => data.summary[s] > 0).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <StatusBadge status={s} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
                      {data.summary[s]}
                    </span>
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                {t("sysNoSecrets")}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain groups */}
      {!data
        ? Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        : BINDING_DOMAINS.map((dom) => {
            const rows = data.bindings.filter((b) => b.domain === dom);
            if (rows.length === 0) return null;
            const Icon = DOMAIN_ICONS[dom] ?? Radar;
            const domLive = rows.filter((b) => b.status === "live").length;
            return (
              <Card key={dom} className="overflow-hidden">
                <div className="h-0.5 w-full" style={{ background: accent, opacity: domLive > 0 ? 1 : 0.35 }} aria-hidden />
                <CardContent className="space-y-2.5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: accent }} aria-hidden />
                    <h3 className="font-semibold">{t(BINDING_DOMAIN_META[dom].i18nKey)}</h3>
                    <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border">
                      {domLive}/{rows.length} {t("sysLiveShort")}
                    </Badge>
                  </div>
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {rows.map((b) => (
                      <BindingRow key={b.id} b={b} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
    </div>
  );
}
