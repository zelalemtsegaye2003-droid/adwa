"use client";
/**
 * Adwa Cyber — Ethiopian Cyber Landscape panel (real national sources).
 *
 * Mounted on the dashboard. Renders the REAL Ethiopian security ecosystem
 * from GET /api/threats/ethio:
 *   - Ethio-CERT contact: hotline 933, ethiocert@insa.gov.et, services,
 *     live public advisories (national JSON API)
 *   - Ethio-CERT national alerts (severity + dates, bilingual)
 *   - Ethiopia's ITU GCI pillar scores + the 2014→2024 trajectory
 *   - Ethio-CERT national security news + INSA institutional news
 *   - The national cyber legal corpus (Computer Crime Proclamation …) with
 *     official PDF links
 *   - INSA posture stats, awareness tips, national products
 *   - NBE financial-sector directives + market sizing
 *
 * Honesty badges: "live" (fetched just now) vs "snapshot" (real captured
 * fallback, labelled with capture date + degradation reason). Every fact
 * carries its source link.
 */
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, Mail, Globe, ShieldAlert, Newspaper, Landmark, Package, Lightbulb, ExternalLink, Scale, TrendingUp, Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";

interface LandscapeFactDTO {
  id: string;
  labelEn: string;
  labelAm: string;
  valueEn: string;
  valueAm: string;
  detailEn?: string;
  provenance: string;
  sourceName: string;
  sourceUrl: string;
  asOf: string;
}

interface FeedBase {
  mode: "live" | "snapshot";
  url: string;
  asOf: string;
  note?: string;
  degradedReason?: string;
}

interface EthioData {
  web: { siteUrl: string; apiBase: string; insaNewsUrl: string; disabled: boolean };
  mode: "live" | "snapshot";
  cert: {
    contact: {
      hotline: string;
      email: string;
      website: string;
      established: string;
      parentAuthorityEn: string;
      parentAuthorityAm: string;
    };
    services: { nameEn: string; nameAm: string }[];
    advisories: FeedBase & { entries: { id: string; titleEn: string; titleAm?: string; url: string; date: string | null; severity: string | null }[] };
    alerts: FeedBase & { entries: { id: string; titleEn: string; titleAm?: string; url: string; date: string | null; severity: string | null; summaryEn?: string }[] };
    news: FeedBase & { entries: { id: string; titleEn: string; titleAm?: string; url: string; date: string | null; summaryEn?: string }[] };
    regulations: FeedBase & { entries: { id: string; titleEn: string; titleAm?: string; year: number | null; url: string; type: string | null }[] };
    gci: FeedBase & {
      year: number;
      pillars: { legal: number; technical: number; organizational: number; capacity: number; cooperation: number };
      timeline: { year: number; pillars: { legal: number; technical: number; organizational: number; capacity: number; cooperation: number } }[];
      sourceUrl: string;
    };
    exchange: { mode: "live" | "fixture"; endpoint: string | null; hasKey: boolean };
  };
  insa: {
    news: FeedBase & { entries: { id: string; titleEn: string; url: string; date: string | null; summaryEn?: string }[] };
    stats: LandscapeFactDTO[];
    awareness: { id: string; titleEn: string; titleAm: string; sourceUrl: string }[];
    products: { name: string; categoryEn: string }[];
  };
  nbe: LandscapeFactDTO[];
  market: LandscapeFactDTO[];
}

function ModeBadge({ mode, asOf, reason }: { mode: "live" | "snapshot"; asOf: string; reason?: string }) {
  const { t } = useI18n();
  const date = asOf.slice(0, 10);
  return (
    <Badge
      variant="outline"
      title={reason ? `${mode} — ${reason}` : `${mode} — ${date}`}
      className={`whitespace-nowrap ${
        mode === "live"
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
      }`}
    >
      {mode === "live" ? `${t("ethioLive")} · ${date}` : `${t("ethioSnapshot")} · ${date}`}
    </Badge>
  );
}

function severityClass(s: string | null) {
  if (s === "critical") return "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
  if (s === "high") return "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  if (s === "medium") return "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800";
  return "bg-muted text-muted-foreground border-border";
}

function FactTile({ fact, accent }: { fact: LandscapeFactDTO; accent: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground">{fact.labelEn}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: accent }}>{fact.valueEn}</p>
      {fact.detailEn && <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-3">{fact.detailEn}</p>}
      <a
        href={fact.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        {fact.sourceName} <ExternalLink className="h-2.5 w-2.5" aria-hidden />
      </a>
    </div>
  );
}

const GCI_PILLARS: { key: "legal" | "technical" | "organizational" | "capacity" | "cooperation"; label: string }[] = [
  { key: "legal", label: "Legal" },
  { key: "technical", label: "Technical" },
  { key: "organizational", label: "Organizational" },
  { key: "capacity", label: "Capacity" },
  { key: "cooperation", label: "Cooperation" },
];

export function EthioLandscape() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<EthioData | null>(null);

  useEffect(() => {
    api<EthioData>("/api/threats/ethio").then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null; // panel appears only when the endpoint answers (authed app shell)

  const am = lang === "am";
  const accent = "#0d9488"; // teal-600 — Ethio-CERT sharing colour used across the SOC view
  const alerts = data.cert.alerts.entries;
  const advisories = data.cert.advisories.entries;
  const certNews = data.cert.news.entries;
  const regulations = data.cert.regulations.entries;
  const gci = data.cert.gci;
  const gciTotal = Math.round((gci.pillars.legal + gci.pillars.technical + gci.pillars.organizational + gci.pillars.capacity + gci.pillars.cooperation) * 100) / 100;
  const timeline = gci.timeline.length > 1 ? gci.timeline : [];
  const pick = (en: string, amText?: string) => (am && amText ? amText : en);

  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#078930 0%,#fcdd09 50%,#da121a 100%)" }} aria-hidden />
      <CardContent className="p-5 space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-teal-600" aria-hidden />
            {t("ethioTitle")}
          </h3>
          <ModeBadge mode={data.mode} asOf={data.cert.alerts.asOf} />
          <p className="w-full text-xs text-muted-foreground">{t("ethioSub")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Ethio-CERT card — hotline first: it is the national reporting path */}
          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">{t("ethioHotline")}</p>
                <p className="text-3xl font-black tabular-nums text-teal-700 dark:text-teal-300">{data.cert.contact.hotline}</p>
                <p className="text-[11px] text-muted-foreground">{t("ethioHotline247")}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px]">
                <a href={`mailto:${data.cert.contact.email}`} className="flex items-center gap-1 text-teal-800 hover:underline dark:text-teal-300">
                  <Mail className="h-3 w-3" aria-hidden /> {data.cert.contact.email}
                </a>
                <a href={data.cert.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-teal-800 hover:underline dark:text-teal-300">
                  <Globe className="h-3 w-3" aria-hidden /> ethiocert.gov.et
                </a>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioServices")}</p>
              <ul className="mt-1 space-y-0.5">
                {data.cert.services.map((s) => (
                  <li key={s.nameEn} className="flex items-center gap-1.5 text-xs">
                    <Phone className="h-2.5 w-2.5 text-teal-600" aria-hidden /> {am ? s.nameAm : s.nameEn}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioAdvisories")}</p>
              {advisories.length === 0 ? (
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("ethioAdvisoriesNone")}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {advisories.slice(0, 4).map((a) => (
                    <li key={a.id} className="text-xs">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {a.severity && (
                          <Badge variant="outline" className={`mr-1 ${severityClass(a.severity)}`}>{a.severity}</Badge>
                        )}
                        {pick(a.titleEn, a.titleAm)}
                      </a>
                      {a.date ? <span className="ml-1 text-[10px] text-muted-foreground">{a.date}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* National alerts (real, with severity) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioAlerts")}</p>
            </div>
            {alerts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 4).map((a) => (
                  <li key={a.id} className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-start gap-1.5">
                      {a.severity && <Badge variant="outline" className={`shrink-0 ${severityClass(a.severity)}`}>{a.severity}</Badge>}
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium leading-snug hover:underline line-clamp-2">
                        {pick(a.titleEn, a.titleAm)}
                      </a>
                    </div>
                    {a.summaryEn && <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">{a.summaryEn}</p>}
                    {a.date && <p className="mt-0.5 text-[10px] text-muted-foreground">{a.date} · ethiocert.gov.et</p>}
                  </li>
                ))}
              </ul>
            )}
            <a href="https://www.ethiocert.gov.et/alerts" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
              {t("ethioViewAll")} <ExternalLink className="h-2.5 w-2.5" aria-hidden />
            </a>
          </div>

          {/* ITU GCI national pillars (real API data) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioGci")} · {gci.year}</p>
              <ModeBadge mode={gci.mode} asOf={gci.asOf} reason={gci.degradedReason} />
            </div>
            <div className="space-y-1.5">
              {GCI_PILLARS.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{p.label}</span>
                  <Progress value={(gci.pillars[p.key] / 20) * 100} className="h-1.5 flex-1" />
                  <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: accent }}>
                    {gci.pillars[p.key].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("ethioGciTotal")}: <span className="font-bold" style={{ color: accent }}>{gciTotal.toFixed(2)}</span>
            </p>
            {timeline.length > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {t("ethioGciGrowth")}: {timeline.map((tp) => `${tp.year} ${Math.round((tp.pillars.legal + tp.pillars.technical + tp.pillars.organizational + tp.pillars.capacity + tp.pillars.cooperation) * 10) / 10}`).join(" → ")}
              </p>
            )}
            <a href="https://www.itu.int" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
              via ethiocert.gov.et/api/gci (ITU Global Cybersecurity Index pillars, each of 20) <ExternalLink className="h-2.5 w-2.5" aria-hidden />
            </a>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* National security news (real ethiocert API) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Newspaper className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioCertNews")}</p>
              <ModeBadge mode={data.cert.news.mode} asOf={data.cert.news.asOf} reason={data.cert.news.degradedReason} />
            </div>
            <ul className="space-y-1.5">
              {certNews.slice(0, 4).map((n) => (
                <li key={n.id} className="rounded-lg border bg-muted/30 p-2">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium leading-snug hover:underline line-clamp-2">
                    {pick(n.titleEn, n.titleAm)}
                  </a>
                  {n.date && <p className="text-[10px] text-muted-foreground">{n.date}</p>}
                </li>
              ))}
            </ul>
          </div>

          {/* INSA institutional news */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioNews")}</p>
              <ModeBadge mode={data.insa.news.mode} asOf={data.insa.news.asOf} reason={data.insa.news.degradedReason} />
            </div>
            <ul className="space-y-1.5">
              {data.insa.news.entries.slice(0, 4).map((n) => (
                <li key={n.id} className="rounded-lg border bg-muted/30 p-2">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium leading-snug hover:underline line-clamp-2">
                    {n.titleEn}
                  </a>
                  {n.date && <p className="text-[10px] text-muted-foreground">{n.date} · insa.gov.et</p>}
                </li>
              ))}
            </ul>
          </div>

          {/* National legal corpus (real regulations with official PDFs) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioRegulations")}</p>
              <ModeBadge mode={data.cert.regulations.mode} asOf={data.cert.regulations.asOf} reason={data.cert.regulations.degradedReason} />
            </div>
            <ul className="space-y-1">
              {regulations.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-baseline gap-1.5 text-[11px] leading-snug">
                  <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{r.year ?? "—"}</span>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline line-clamp-1" title={pick(r.titleEn, r.titleAm)}>
                    {pick(r.titleEn, r.titleAm)}
                  </a>
                </li>
              ))}
            </ul>
            <a href="https://www.ethiocert.gov.et/regulations" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
              {t("ethioViewAll")} ({regulations.length}) <ExternalLink className="h-2.5 w-2.5" aria-hidden />
            </a>
          </div>
        </div>

        {/* NBE + posture stats + products + awareness */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioStats")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.insa.stats.slice(0, 4).map((f) => (
                <FactTile key={f.id} fact={f} accent={accent} />
              ))}
            </div>
            {data.market.map((f) => (
              <FactTile key={f.id} fact={f} accent="#d97706" />
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioNbe")}</p>
            </div>
            {data.nbe.map((f) => (
              <div key={f.id} className="rounded-lg border bg-muted/30 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{f.labelEn}</p>
                  <p className="text-xs font-bold" style={{ color: "#b45309" }}>{f.valueEn}</p>
                </div>
                {f.detailEn && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-3">{f.detailEn}</p>}
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
                  {f.sourceName} <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioProducts")}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.insa.products.map((p) => (
                  <Badge key={p.name} variant="outline" title={p.categoryEn} className="bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ethioAwareness")}</p>
              </div>
              <ul className="space-y-1">
                {data.insa.awareness.map((a) => (
                  <li key={a.id} className="text-[11px] leading-snug">
                    <span className="mr-1 inline-block h-1 w-1 rounded-full align-middle" style={{ background: "#d97706", opacity: 0.6 }} aria-hidden />
                    {am ? a.titleAm : a.titleEn}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground">{t("ethioAwarenessNote")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
