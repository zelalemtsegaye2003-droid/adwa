"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Network, Waypoints, Flame, Clock3, KeyRound, ShieldAlert, Crown, User, Users, Server, ArrowRight, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";

// ── DTOs (mirror /api/vapt/ad-paths) ─────────────────────────────────────────

interface AdNodeDTO {
  id: string;
  type: "user" | "group" | "computer" | "domain";
  name: string;
  tier: 0 | 1 | 2;
  col: number;
  flags: {
    entry?: boolean;
    target?: boolean;
    kerberoastable?: boolean;
    asrepRoastable?: boolean;
    passwordAgeDays?: number;
    dormantDays?: number;
    overPrivileged?: boolean;
    unconstrainedDelegation?: boolean;
  };
  note: string;
  noteAm: string;
}

interface AdEdgeDTO {
  from: string;
  to: string;
  type: string;
  relation: string;
  note: string;
  noteAm: string;
}

interface AttackPathDTO {
  id: string;
  entryId: string;
  entryName: string;
  targetId: string;
  targetName: string;
  nodes: string[];
  hops: { nodeId: string; edgeType: string }[];
  length: number;
  techniques: string[];
  risk: number;
  remediations: string[];
  shortest: boolean;
}

interface AdAnalysisDTO {
  domain: string;
  stats: {
    nodes: number;
    edges: number;
    entries: number;
    targets: number;
    paths: number;
    shortestHops: number | null;
    tier0ExposedEntries: string[];
    tier0ExposurePct: number;
    kerberoastable: string[];
    asrepRoastable: string[];
    dormantAccounts: string[];
    stalePasswords: string[];
    overPrivileged: string[];
    unconstrainedDelegationHosts: string[];
    chokepoints: { id: string; name: string; pathCount: number }[];
  };
  nodes: AdNodeDTO[];
  edges: AdEdgeDTO[];
  paths: AttackPathDTO[];
  remediations: { id: string; title: string; titleAm: string; detail: string }[];
}

// ── layout constants ─────────────────────────────────────────────────────────

const COL_X = [95, 345, 595, 845, 1095];
const NODE_W = 190;
const NODE_H = 64;
const VIEW_W = 1240;

const TIER_COLORS: Record<number, { border: string; fill: string; label: string }> = {
  0: { border: "#DC2626", fill: "fill-red-50 dark:fill-red-950/70", label: "Tier-0" },
  1: { border: "#D97706", fill: "fill-amber-50 dark:fill-amber-950/70", label: "Tier-1" },
  2: { border: "#0F766E", fill: "fill-teal-50 dark:fill-teal-950/70", label: "Tier-2" },
};

const EDGE_COLORS: Record<string, string> = {
  MemberOf: "#64748B",
  HasSession: "#F59E0B",
  AdminCreds: "#EA580C",
  ResetPassword: "#DC2626",
  Kerberoast: "#E11D48",
  AsRepRoast: "#BE123C",
  CanRDP: "#2563EB",
  AdminTo: "#0891B2",
  UnconstrainedDeleg: "#7C3AED",
};

const TYPE_ICON: Record<string, React.ElementType> = { user: User, group: Users, computer: Server, domain: Network };

// ── graph canvas ─────────────────────────────────────────────────────────────

function AdGraph({
  data,
  selectedPath,
  selectedNode,
  onNodeClick,
}: {
  data: AdAnalysisDTO;
  selectedPath: AttackPathDTO | null;
  selectedNode: string | null;
  onNodeClick: (id: string | null) => void;
}) {
  const { t, lang } = useI18n();

  const colCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const n of data.nodes) counts[n.col] = (counts[n.col] ?? 0) + 1;
    return counts;
  }, [data.nodes]);

  const pos = useMemo(() => {
    const idx: Record<number, number> = {};
    const map = new Map<string, { x: number; y: number }>();
    const maxCol = Math.max(...Object.values(colCounts));
    const step = NODE_H + 46;
    const span = maxCol * step + 40;
    for (const n of data.nodes) {
      const i = idx[n.col] ?? 0;
      idx[n.col] = i + 1;
      const total = colCounts[n.col] * step;
      const y = 46 + (span - total) / 2 + i * step;
      map.set(n.id, { x: COL_X[n.col] - NODE_W / 2, y });
    }
    const height = span + 90;
    return { map, height };
  }, [data.nodes, colCounts]);

  const activeNodes = useMemo(() => new Set(selectedPath?.nodes ?? []), [selectedPath]);
  const activeEdgeKeys = useMemo(() => {
    if (!selectedPath) return new Set<string>();
    const keys = new Set<string>();
    for (let i = 0; i < selectedPath.nodes.length - 1; i++) keys.add(`${selectedPath.nodes[i]}>${selectedPath.nodes[i + 1]}`);
    return keys;
  }, [selectedPath]);

  const chokepointIds = useMemo(() => new Set(data.stats.chokepoints.map((c) => c.id)), [data.stats]);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${VIEW_W} ${pos.height}`} className="min-w-[900px] w-full select-none" role="img" aria-label={t("adGraphTitle")}>
        <defs>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
        </defs>

        {/* column captions */}
        {COL_X.map((x, i) => (
          <text key={x} x={x} y={22} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11, fontWeight: 600 }}>
            {t(`adCol${i}`)}
          </text>
        ))}

        {/* edges */}
        {data.edges.map((e) => {
          const a = pos.map.get(e.from);
          const b = pos.map.get(e.to);
          if (!a || !b) return null;
          const sx = a.x + NODE_W;
          const sy = a.y + NODE_H / 2;
          const tx = b.x;
          const ty = b.y + NODE_H / 2;
          const dx = Math.max(40, (tx - sx) / 2);
          const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
          const active = activeEdgeKeys.has(`${e.from}>${e.to}`);
          const color = EDGE_COLORS[e.type] ?? "#64748B";
          const note = lang === "am" ? e.noteAm : e.note;
          return (
            <g key={`${e.from}>${e.to}`} opacity={selectedPath && !active ? 0.16 : 1} style={{ cursor: "help" }}>
              <path d={d} fill="none" stroke={color} strokeWidth={active ? 3.5 : 1.75} markerEnd={`url(#arrow-${e.type})`} className="drop-shadow-sm" />
              {/* invisible fat hit area for hover */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={14}>
                <title>{`${e.type} — ${e.relation}\n${note}`}</title>
              </path>
            </g>
          );
        })}

        {/* nodes */}
        {data.nodes.map((n) => {
          const p = pos.map.get(n.id);
          if (!p) return null;
          const tier = TIER_COLORS[n.tier];
          const Icon = TYPE_ICON[n.type] ?? User;
          const active = activeNodes.has(n.id);
          const dim = (selectedPath && !active) || (selectedNode && selectedNode !== n.id && !selectedPath);
          const isTarget = n.flags.target;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              opacity={dim ? 0.3 : 1}
              onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); onNodeClick(selectedNode === n.id ? null : n.id); }}
              style={{ cursor: "pointer" }}
            >
              {/* entry ring */}
              {n.flags.entry && (
                <rect x={-6} y={-6} width={NODE_W + 12} height={NODE_H + 12} rx={12} fill="none" stroke="#DC2626" strokeWidth={2} strokeDasharray="6 4" />
              )}
              {active && (
                <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={11} fill="none" stroke="#DC2626" strokeWidth={2.5} />
              )}
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={10}
                className={tier.fill}
                stroke={tier.border}
                strokeWidth={selectedNode === n.id ? 2.5 : 1.5}
              />
              <g transform={`translate(12, 12)`}>
                <Icon className="pointer-events-none" color={tier.border} width={18} height={18} aria-hidden />
              </g>
              <text x={40} y={26} style={{ fontSize: 13, fontWeight: 700 }} className="fill-foreground font-mono">
                {n.name}
              </text>
              <text x={40} y={44} style={{ fontSize: 10 }} className="fill-muted-foreground">
                {t(`adType${n.type}`)} · {tier.label}
              </text>
              <text x={NODE_W - 10} y={26} textAnchor="end" style={{ fontSize: 9, fontWeight: 700 }} fill={tier.border}>
                {n.flags.entry ? t("adEntryTag") : isTarget ? t("adTargetTag") : ""}
              </text>
              {/* risk flag chips */}
              {(() => {
                const chips: string[] = [];
                if (n.flags.kerberoastable) chips.push("KERB");
                if (n.flags.asrepRoastable) chips.push("AS-REP");
                if (n.flags.overPrivileged) chips.push("OVER-PRIV");
                if (!chips.length) return null;
                return (
                  <text x={40} y={56} style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3 }} fill="#DC2626">
                    {chips.join(" · ")}
                  </text>
                );
              })()}
              {/* chokepoint marker */}
              {chokepointIds.has(n.id) && !n.flags.target && !n.flags.entry && (
                <g transform={`translate(${NODE_W - 22}, ${NODE_H - 18})`}>
                  <circle r={8} fill="#7C3AED" opacity={0.15} />
                  <g transform="translate(-5,-5)">
                    <Waypoints width={10} height={10} color="#7C3AED" aria-hidden />
                  </g>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── right-side detail helpers ───────────────────────────────────────────────

function PathCard({ p, selected, onSelect }: { p: AttackPathDTO; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-red-400 bg-red-50/70 dark:border-red-800 dark:bg-red-950/40" : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-xs">{p.entryName} → {p.targetName}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {p.shortest && <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600">{t("adShortestBadge")}</Badge>}
          <Badge variant="outline" className="tabular-nums bg-muted/50 hover:bg-transparent">{p.length} {t("adHops")}</Badge>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {p.techniques.map((tech) => (
          <span key={tech} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tech}</span>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <span className="block h-full bg-red-600" style={{ width: `${p.risk}%` }} />
        </span>
        <span className="tabular-nums">{t("adRisk")} {p.risk}</span>
      </div>
    </button>
  );
}

function NodeDetail({ n, remediations }: { n: AdNodeDTO; remediations: { id: string; title: string; titleAm: string; detail: string }[] }) {
  const { t, lang } = useI18n();
  const flagList: { icon: React.ElementType; label: string; sub: string }[] = [];
  if (n.flags.kerberoastable) flagList.push({ icon: Flame, label: "Kerberoastable", sub: t("adFlagKerb") });
  if (n.flags.asrepRoastable) flagList.push({ icon: Flame, label: "AS-REP roastable", sub: t("adFlagAsrep") });
  if (n.flags.overPrivileged) flagList.push({ icon: ShieldAlert, label: t("adFlagOverpriv"), sub: t("adFlagOverprivSub") });
  if (n.flags.passwordAgeDays != null) flagList.push({ icon: KeyRound, label: `${t("adFlagPwAge")} ${n.flags.passwordAgeDays}d`, sub: t("adFlagStaleSub") });
  if (n.flags.dormantDays != null) flagList.push({ icon: Clock3, label: `${t("adFlagDormant")} ${n.flags.dormantDays}d`, sub: t("adFlagDormantSub") });
  if (n.flags.unconstrainedDelegation) flagList.push({ icon: ArrowRight, label: t("adFlagDeleg"), sub: t("adFlagDelegSub") });
  const remedIds =
    n.flags.kerberoastable ? ["rotate-spn-password"] :
    n.flags.asrepRoastable ? ["enable-preauth"] :
    n.flags.overPrivileged ? ["least-privilege"] :
    n.flags.unconstrainedDelegation ? ["replace-unconstrained-delegation"] : [];
  const rems = remediations.filter((r) => remedIds.includes(r.id));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">{n.name}</span>
        <Badge variant="outline" className="bg-muted/50 hover:bg-transparent">Tier-{n.tier}</Badge>
        {n.flags.entry && <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600 gap-1"><Crown className="h-3 w-3" aria-hidden />{t("adEntryTag")}</Badge>}
        {n.flags.target && <Badge className="bg-red-600 text-white border-red-700 hover:bg-red-600 gap-1"><Crown className="h-3 w-3" aria-hidden />{t("adTargetTag")}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{lang === "am" ? n.noteAm : n.note}</p>
      {flagList.length > 0 && (
        <ul className="space-y-1.5">
          {flagList.map((f) => (
            <li key={f.label} className="flex items-start gap-2 text-xs">
              <f.icon className="mt-0.5 h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
              <span><span className="font-semibold">{f.label}</span> — {f.sub}</span>
            </li>
          ))}
        </ul>
      )}
      {rems.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
          {rems.map((r) => (
            <div key={r.id} className="text-xs">
              <p className="font-semibold text-emerald-900 dark:text-emerald-300">{lang === "am" ? r.titleAm : r.title}</p>
              <p className="mt-0.5 text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main tab ─────────────────────────────────────────────────────────────────

export function AdPathsTab() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<AdAnalysisDTO | null>(null);
  const [pathId, setPathId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);

  useEffect(() => {
    api<AdAnalysisDTO>("/api/vapt/ad-paths").then(setData).catch(() => {});
  }, []);

  const selectedPath = useMemo(() => data?.paths.find((p) => p.id === pathId) ?? null, [data, pathId]);
  const selectedNode = useMemo(() => data?.nodes.find((n) => n.id === nodeId) ?? null, [data, nodeId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      </div>
    );
  }

  const s = data.stats;
  const kpis = [
    { icon: Waypoints, label: t("adKpiPaths"), value: s.paths, sub: `${s.entries} ${t("adKpiEntries")} → ${s.targets} ${t("adKpiTargets")}` },
    { icon: ArrowRight, label: t("adKpiShortest"), value: s.shortestHops ?? "—", sub: t("adKpiShortestSub") },
    { icon: Flame, label: t("adKpiRoast"), value: s.kerberoastable.length + s.asrepRoastable.length, sub: `${s.kerberoastable.map((n) => n).join(", ")} · ${s.asrepRoastable.join(", ")}` },
    { icon: ShieldAlert, label: t("adKpiT0"), value: `${s.tier0ExposurePct}%`, sub: s.tier0ExposedEntries.join(", ") },
  ];

  const hopChain = (p: AttackPathDTO) =>
    p.hops.map((h, i) => {
      const node = data.nodes.find((n) => n.id === h.nodeId);
      return (
        <React.Fragment key={`${h.nodeId}-${i}`}>
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
            <span className="font-semibold text-red-700 dark:text-red-400">{h.edgeType}</span>
            <span aria-hidden>→</span> {node?.name}
          </span>
        </React.Fragment>
      );
    });

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* graph */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-red-600" aria-hidden />
              {t("adGraphTitle")} — {data.domain}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("adGraphSub")}</p>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <div onClick={() => { setNodeId(null); }} role="presentation">
              <AdGraph data={data} selectedPath={selectedPath} selectedNode={nodeId} onNodeClick={(id) => setNodeId(id)} />
            </div>
            {/* legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
              {[0, 1, 2].map((tier) => (
                <span key={tier} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: TIER_COLORS[tier].border, background: TIER_COLORS[tier].fill }} />
                  {TIER_COLORS[tier].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-red-600 border-dashed bg-transparent" />{t("adEntryTag")}</span>
              <span className="flex items-center gap-1.5"><Waypoints className="h-3 w-3 text-violet-600" aria-hidden />{t("adChokepoint")}</span>
              {["Kerberoast", "AsRepRoast", "AdminCreds", "CanRDP", "AdminTo", "UnconstrainedDeleg"].map((e) => (
                <span key={e} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded" style={{ background: EDGE_COLORS[e] }} />
                  {e}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* right column: paths + detail */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Waypoints className="h-4 w-4 text-red-600" aria-hidden />
                {t("adPathsTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("adPathsSub")}</p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="space-y-2 p-3">
                  {data.paths.map((p) => (
                    <PathCard key={p.id} p={p} selected={p.id === pathId} onSelect={() => setPathId(p.id === pathId ? null : p.id)} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-red-600" aria-hidden />
                {selectedPath ? t("adDetailPath") : selectedNode ? t("adDetailNode") : t("adHygieneTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedPath && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{selectedPath.entryName} → {selectedPath.targetName}</span>
                    <span className="tabular-nums">{selectedPath.length} {t("adHops")} · {t("adRisk")} {selectedPath.risk}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {hopChain(selectedPath)}
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">{t("adRemedTitle")}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {selectedPath.remediations.map((rid) => {
                        const r = data.remediations.find((x) => x.id === rid);
                        if (!r) return null;
                        return (
                          <li key={rid} className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{lang === "am" ? r.titleAm : r.title}</span> — {r.detail}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
              {!selectedPath && selectedNode && <NodeDetail n={selectedNode} remediations={data.remediations} />}
              {!selectedPath && !selectedNode && (
                <div className="space-y-2.5 text-xs">
                  {([
                    { icon: Flame, label: t("adMisKerb"), items: s.kerberoastable },
                    { icon: Flame, label: t("adMisAsrep"), items: s.asrepRoastable },
                    { icon: Clock3, label: t("adMisDormant"), items: s.dormantAccounts },
                    { icon: KeyRound, label: t("adMisStale"), items: s.stalePasswords },
                    { icon: ShieldAlert, label: t("adMisOverpriv"), items: s.overPrivileged },
                    { icon: ArrowRight, label: t("adMisDeleg"), items: s.unconstrainedDelegationHosts },
                  ] as { icon: React.ElementType; label: string; items: string[] }[]).map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-2 border-b pb-2 last:border-b-0">
                      <span className="flex items-center gap-1.5 font-medium"><row.icon className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />{row.label}</span>
                      <span className="text-right font-mono text-muted-foreground">{row.items.length ? row.items.join(", ") : "—"}</span>
                    </div>
                  ))}
                  {s.chokepoints.length > 0 && (
                    <p className="pt-1 text-muted-foreground">
                      <Waypoints className="mr-1 inline h-3.5 w-3.5 text-violet-600" aria-hidden />
                      {t("adChokepoint")}: <span className="font-mono">{s.chokepoints.slice(0, 3).map((c) => `${c.name} (×${c.pathCount})`).join(" · ")}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
