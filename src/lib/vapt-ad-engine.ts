/**
 * Adwa Cyber — AD attack-path analysis engine.
 *
 * Pure functions over the reference AD graph (vapt-ad-paths.ts):
 *  - shortest path per (entry → target) pair via BFS;
 *  - full simple-path enumeration (max length) for the multi-hop views;
 *  - tier-0 exposure, chokepoints (node betweenness over computed paths),
 *    roastable/dormant/stale/over-privileged account KPIs;
 *  - remediation guidance mapped from the abused techniques.
 *
 * Exposed via GET /api/vapt/ad-paths and the AD Attack Paths tab.
 */

import { AD_DOMAIN, AD_EDGES, AD_NODES, type AdEdge, type AdEdgeType, type AdNode } from "./vapt-ad-paths";

export interface AttackPathHop {
  nodeId: string;
  edgeType: AdEdgeType;
}

export interface AttackPath {
  id: string;
  entryId: string;
  entryName: string;
  targetId: string;
  targetName: string;
  /** node ids in traversal order (entry → … → target). */
  nodes: string[];
  hops: AttackPathHop[];
  length: number;
  techniques: AdEdgeType[];
  /** 20–100 — shorter and roast-assisted paths score higher. */
  risk: number;
  remediations: string[];
  shortest: boolean;
}

export interface AdRemediation {
  id: string;
  title: string;
  titleAm: string;
  detail: string;
}

export interface AdStats {
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
}

// ── remediation catalogue (mapped from abused techniques) ────────────────────

const EDGE_REMEDIATIONS: Partial<Record<AdEdgeType, string[]>> = {
  AsRepRoast: ["enable-preauth"],
  Kerberoast: ["rotate-spn-password"],
  ResetPassword: ["limit-reset-delegation"],
  AdminCreds: ["tiered-admin-model"],
  CanRDP: ["remove-rdp-reach"],
  HasSession: ["session-hygiene"],
  UnconstrainedDeleg: ["replace-unconstrained-delegation"],
  AdminTo: ["least-privilege"],
  MemberOf: [],
};

const NODE_FLAG_REMEDIATIONS: Array<{ flags: keyof typeof FLAG_CHECKS; ids: string[] }> = [
  { flags: "asrepRoastable", ids: ["enable-preauth"] },
  { flags: "kerberoastable", ids: ["rotate-spn-password"] },
  { flags: "overPrivileged", ids: ["least-privilege"] },
  { flags: "dormantDays", ids: ["dormant-hygiene"] },
  { flags: "passwordAgeDays", ids: ["dormant-hygiene"] },
  { flags: "unconstrainedDelegation", ids: ["replace-unconstrained-delegation"] },
];

const FLAG_CHECKS = {
  asrepRoastable: (n: AdNode) => n.flags.asrepRoastable === true,
  kerberoastable: (n: AdNode) => n.flags.kerberoastable === true,
  overPrivileged: (n: AdNode) => n.flags.overPrivileged === true,
  dormantDays: (n: AdNode) => typeof n.flags.dormantDays === "number" && n.flags.dormantDays > 0,
  passwordAgeDays: (n: AdNode) => typeof n.flags.passwordAgeDays === "number" && n.flags.passwordAgeDays > 90,
  unconstrainedDelegation: (n: AdNode) => n.flags.unconstrainedDelegation === true,
};

export const AD_REMEDIATIONS: AdRemediation[] = [
  {
    id: "enable-preauth",
    title: "Enable Kerberos pre-authentication on roastable accounts",
    titleAm: "በሚፈሩ አካውንቶች ላይ የ Kerberos ቅድመ-ማረጋገጥ ያንቁሩ",
    detail: "Clear DONT_REQ_PREAUTH (svc-webapp) so AS-REP roasting no longer yields offline-crackable material.",
  },
  {
    id: "rotate-spn-password",
    title: "Rotate SPN account credentials; migrate to gMSA",
    titleAm: "የ SPN አካውንት ማረጋገጫ ይመንዙን፤ ወደ gMSA ይሸጋገሩ",
    detail: "svc-sql has a 900-day password; rotate it and switch to group-managed service accounts with automatic rotation.",
  },
  {
    id: "limit-reset-delegation",
    title: "Remove helpdesk password-reset over service accounts",
    titleAm: "የሄልፕዴስክ የይለፍ-ቃል መቀየር በሰርቪስ አካውንቶች ላይ ያገዱ",
    detail: "IT Helpdesk holds ForceChangePassword over the service-account OU — restrict reset delegation to a controlled workflow.",
  },
  {
    id: "tiered-admin-model",
    title: "Enforce the tiered admin model",
    titleAm: "የደረጃ የአስተዳደር ሥነ ምሕደርን ይግብሩ",
    detail: "Administer workstations with dedicated tier-1 accounts whose credentials never cache on tier-2 hosts; block tier-0 logons outside PAWs.",
  },
  {
    id: "remove-rdp-reach",
    title: "Remove RDP reach from tier-2 into tier-1",
    titleAm: "ከከፍታ-2 ወደ ከፍታ-1 የ RDP ተደራሽነትን ያስወግዱ",
    detail: "svc-webapp can RDP into the core-banking app server — drop remote-interactive rights and manage through jump hosts.",
  },
  {
    id: "session-hygiene",
    title: "Tier-0 logon hygiene (no DA on tier-1 hosts)",
    titleAm: "የደረጃ-0 ትርፊክ ጽድቅ (በከፍታ-1 ላይ DA መሆን የለም)",
    detail: "ad.admin holds interactive sessions on CBE-APP01 — prohibit Domain Admin logons on tier-1 servers; use Privileged Access Workstations.",
  },
  {
    id: "replace-unconstrained-delegation",
    title: "Replace unconstrained delegation with RBCD",
    titleAm: "ያልተገደበን ልውውጥ በ RBCD ይተኩ",
    detail: "CBE-SQL01 caches credentials of authenticating principals (incl. the DC) — switch to resource-based constrained delegation.",
  },
  {
    id: "least-privilege",
    title: "Least-privilege the service accounts",
    titleAm: "ሰርቪስ አካውንቶችን በአነስተኛ መብት ይገልጹ",
    detail: "svc-webapp is admin on the whole web tier — reduce to exactly the rights the workload needs, on the hosts it needs.",
  },
  {
    id: "dormant-hygiene",
    title: "Dormant-account & password-age policy",
    titleAm: "የያለተገባ አካውንትና የይለፍ-ቃል ዕድሜ ፖሊሲ",
    detail: "Disable or rotate accounts unused beyond 30 days; enforce 90-day maximum password age on service accounts.",
  },
];

// ── graph helpers ───────────────────────────────────────────────────────────

const NODE_BY_ID = new Map(AD_NODES.map((n) => [n.id, n]));
const OUT_EDGES = new Map<string, AdEdge[]>();
for (const e of AD_EDGES) {
  const list = OUT_EDGES.get(e.from) ?? [];
  list.push(e);
  OUT_EDGES.set(e.from, list);
}

export function adNode(id: string): AdNode | undefined {
  return NODE_BY_ID.get(id);
}

/** BFS shortest path (node ids) from `from` to `to`, or null. */
function shortestPath(from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const e of OUT_EDGES.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, cur);
      if (e.to === to) {
        const path = [to];
        let p = cur;
        while (p !== from) {
          path.unshift(p);
          p = prev.get(p) as string;
        }
        path.unshift(from);
        return path;
      }
      queue.push(e.to);
    }
  }
  return null;
}

/** Enumerate all simple paths (≤ maxHops) from `from` to `to`. */
function allSimplePaths(from: string, to: string, maxHops: number): string[][] {
  const results: string[][] = [];
  const stack: string[] = [from];

  const walk = (node: string) => {
    if (node === to) {
      results.push([...stack]);
      return;
    }
    if (stack.length > maxHops) return;
    for (const e of OUT_EDGES.get(node) ?? []) {
      if (stack.includes(e.to)) continue; // simple path only
      stack.push(e.to);
      walk(e.to);
      stack.pop();
    }
  };
  walk(from);
  return results;
}

function edgeBetween(from: string, to: string): AdEdge | undefined {
  return (OUT_EDGES.get(from) ?? []).find((e) => e.to === to);
}

const ROAST_TYPES: AdEdgeType[] = ["Kerberoast", "AsRepRoast"];

function remediationsFor(pathNodes: string[], hops: AttackPathHop[]): string[] {
  const ids = new Set<string>();
  for (const h of hops) {
    for (const id of EDGE_REMEDIATIONS[h.edgeType] ?? []) ids.add(id);
  }
  for (const nodeId of pathNodes) {
    const n = NODE_BY_ID.get(nodeId);
    if (!n) continue;
    for (const { flags, ids: remIds } of NODE_FLAG_REMEDIATIONS) {
      const check = (FLAG_CHECKS as Record<string, (node: AdNode) => boolean>)[flags];
      if (check?.(n)) for (const id of remIds) ids.add(id);
    }
  }
  return [...ids];
}

function riskFor(hops: AttackPathHop[]): number {
  const roastAssist = hops.some((h) => ROAST_TYPES.includes(h.edgeType)) ? 6 : 0;
  const raw = 100 - (hops.length - 1) * 7 + roastAssist;
  return Math.max(20, Math.min(100, Math.round(raw)));
}

// ── main entry ──────────────────────────────────────────────────────────────

const MAX_HOPS = 8;

export function computeAdAttackPaths() {
  const entries = AD_NODES.filter((n) => n.flags.entry);
  const targets = AD_NODES.filter((n) => n.flags.target);

  // Shortest-path record per entry→target pair for marking.
  const shortestLen = new Map<string, number>();
  for (const e of entries) {
    for (const t of targets) {
      const sp = shortestPath(e.id, t.id);
      if (sp) shortestLen.set(`${e.id}->${t.id}`, sp.length - 1);
    }
  }

  const paths: AttackPath[] = [];
  for (const e of entries) {
    for (const t of targets) {
      for (const nodePath of allSimplePaths(e.id, t.id, MAX_HOPS)) {
        const hops: AttackPathHop[] = [];
        for (let i = 1; i < nodePath.length; i++) {
          const edge = edgeBetween(nodePath[i - 1], nodePath[i]);
          if (!edge) break; // shouldn't happen
          hops.push({ nodeId: nodePath[i], edgeType: edge.type });
        }
        if (hops.length !== nodePath.length - 1) continue;
        const key = `${e.id}->${t.id}`;
        paths.push({
          id: `path-${e.id}-${t.id}-${paths.length}`,
          entryId: e.id,
          entryName: e.name,
          targetId: t.id,
          targetName: t.name,
          nodes: nodePath,
          hops,
          length: hops.length,
          techniques: [...new Set(hops.map((h) => h.edgeType))],
          risk: riskFor(hops),
          remediations: remediationsFor(nodePath, hops),
          shortest: hops.length === shortestLen.get(key),
        });
      }
    }
  }
  paths.sort((a, b) => a.length - b.length || b.risk - a.risk);

  // Chokepoints: node betweenness across all computed paths (excluding entry/target).
  const betweenness = new Map<string, number>();
  for (const p of paths) {
    for (const nodeId of p.nodes.slice(1, -1)) {
      betweenness.set(nodeId, (betweenness.get(nodeId) ?? 0) + 1);
    }
  }
  const chokepoints = [...betweenness.entries()]
    .map(([id, pathCount]) => ({ id, name: NODE_BY_ID.get(id)?.name ?? id, pathCount }))
    .sort((a, b) => b.pathCount - a.pathCount)
    .slice(0, 5);

  // Tier-0 exposure per entry.
  const tier0ExposedEntries = entries
    .filter((e) =>
      AD_NODES.some(
        (t) =>
          t.tier === 0 &&
          (shortestPath(e.id, t.id) !== null || paths.some((p) => p.entryId === e.id && NODE_BY_ID.get(p.targetId)?.tier === 0))
      )
    )
    .map((e) => e.name);

  const flagNames = (check: (n: AdNode) => boolean) => AD_NODES.filter(check).map((n) => n.name);

  const stats: AdStats = {
    nodes: AD_NODES.length,
    edges: AD_EDGES.length,
    entries: entries.length,
    targets: targets.length,
    paths: paths.length,
    shortestHops: paths.length ? paths[0].length : null,
    tier0ExposedEntries,
    tier0ExposurePct: entries.length ? Math.round((tier0ExposedEntries.length / entries.length) * 100) : 0,
    kerberoastable: flagNames(FLAG_CHECKS.kerberoastable),
    asrepRoastable: flagNames(FLAG_CHECKS.asrepRoastable),
    dormantAccounts: flagNames(FLAG_CHECKS.dormantDays),
    stalePasswords: flagNames(FLAG_CHECKS.passwordAgeDays),
    overPrivileged: flagNames(FLAG_CHECKS.overPrivileged),
    unconstrainedDelegationHosts: flagNames(FLAG_CHECKS.unconstrainedDelegation),
    chokepoints,
  };

  return { domain: AD_DOMAIN, paths, stats, remediations: AD_REMEDIATIONS };
}
