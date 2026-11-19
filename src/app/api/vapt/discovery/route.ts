import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { scopeIsLive, parseScopeTargets, targetMatches, extractTarget } from "@/lib/vapt/vapt-scope";
import { discoverSubdomains, type CrtShEntry, type Fetcher } from "@/lib/vapt/vapt-easm";
import { appendVaptAudit } from "@/lib/vapt/vapt-audit";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

/**
 * POST /api/vapt/discovery — run a REAL external-attack-surface discovery
 * (NBE LOT4 EASM: certificate-transparency + DNS) for one root domain.
 *
 * Authorization first, even for passive OSINT: the domain must be covered by
 * an APPROVED, in-window scope (domain or URL target) — otherwise the run is
 * rejected and recorded in the hash-chained audit log (DISCOVERY_REJECTED).
 *
 * Source handling, honestly labelled: crt.sh is queried LIVE (with a retry);
 * when the live source is unreachable the run falls back to the repo's own
 * REAL captured CT snapshot for that domain when one is bundled
 * (scripts/assets/easm-<domain>-fixture.json) and the response + audit say
 * exactly which source produced the rows.
 *
 * Discovered hostnames are classified against approved scopes (inScope) and
 * the registered asset inventory (managed) — the tender's "unmanaged /
 * shadow-IT / orphaned asset" signal — and stored for the EASM registry.
 */
interface DiscoveryBody {
  organizationId?: string;
  domain: string;
}

function discoverySchema(data: unknown): DiscoveryBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.domain !== "string") return null;
  const domain = d.domain.trim().toLowerCase().replace(/\.$/, "");
  // sane multi-label DNS domain (not a URL, not an IP)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) return null;
  if (domain.length > 200) return null;
  return { domain, organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Which approved-scope targets cover the queried root domain itself? */
function domainAuthorized(domain: string, scopeTargets: { kind: string; value: string }[]): boolean {
  return scopeTargets.some((t) =>
    t.kind === "domain" || t.kind === "url"
      ? targetMatches({ kind: "domain", value: t.kind === "domain" ? t.value : safeHost(t.value) }, domain)
      : false
  );
}

/** Bundled REAL CT capture for a domain (returns null when none exists). */
function bundledFixtureFetcher(domain: string): { fetcher: Fetcher; asOf: string } | null {
  const fixturePath = join(process.cwd(), "scripts", "assets", `easm-${domain}-fixture.json`);
  if (!existsSync(fixturePath)) return null;
  try {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { asOf: string; domain: string; hosts: unknown[] };
    if (fixture.domain !== domain || !Array.isArray(fixture.hosts)) return null;
    const entries: CrtShEntry[] = [];
    for (const h of fixture.hosts) {
      const ct = (h as { ct?: { entryId?: number; issuer?: string; notBefore?: string } }).ct;
      entries.push({
        issuer_ca_id: 0,
        issuer_name: ct?.issuer ?? "",
        name_value: (h as { name: string }).name,
        id: ct?.entryId ?? 0,
        not_before: ct?.notBefore,
      });
    }
    return {
      fetcher: async () => entries,
      asOf: fixture.asOf,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, discoverySchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const isSuper = can(user.role, "vapt:manage-all");
  const organizationId = isSuper ? body.organizationId : user.orgId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  if (!isSuper && body.organizationId && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "You can only run discovery for your own organization" }, { status: 403 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  // ── Authorization gate: the root domain must be inside an approved scope
  const scopes = await db.vaptScope.findMany({ where: { organizationId } });
  const now = new Date();
  const liveTargets = scopes
    .filter((s) => scopeIsLive(s, now))
    .flatMap((s) => parseScopeTargets(s.targets) ?? []);
  if (!domainAuthorized(body.domain, liveTargets)) {
    await appendVaptAudit({
      type: "DISCOVERY_REJECTED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: body.domain,
      action: `EASM discovery rejected — "${body.domain}" is outside every approved, in-window scope`,
      result: "rejected — no discovery performed",
      payload: { domain: body.domain },
    });
    return NextResponse.json(
      {
        error: "Discovery rejected by the authorization gate — the root domain must be covered by an approved, in-window scope.",
        remediation: "Create a scope with a domain target covering this zone and have a second user approve it (four-eyes), then rerun discovery.",
      },
      { status: 403 }
    );
  }

  // ── REAL passive discovery: LIVE certificate-transparency logs + DNS first.
  //    If crt.sh is unreachable, fall back to the repo's bundled REAL capture
  //    for this domain (labelled) — otherwise surface the failure honestly.
  let source: "live-ct" | "bundled-ct-snapshot" = "live-ct";
  let snapshotAsOf: string | null = null;
  let liveError: string | null = null;
  let discovery = await discoverSubdomains(body.domain, { timeoutMs: 25_000 });
  if (discovery.error) {
    liveError = discovery.error;
    const fallback = bundledFixtureFetcher(body.domain);
    if (fallback) {
      source = "bundled-ct-snapshot";
      snapshotAsOf = fallback.asOf;
      discovery = await discoverSubdomains(body.domain, { fetcher: fallback.fetcher, timeoutMs: 25_000 });
    }
  }

  if (discovery.error) {
    await appendVaptAudit({
      type: "DISCOVERY_RUN",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: body.domain,
      action: `EASM discovery run for "${body.domain}" failed at the CT-log source`,
      result: `error: ${discovery.error}`,
      payload: { domain: body.domain },
    });
    return NextResponse.json({ error: `Discovery failed: ${discovery.error}` }, { status: 502 });
  }

  // ── Classification against scopes and the registered inventory
  const assets = await db.vaptAsset.findMany({
    where: { organizationId },
    select: { identifier: true },
  });
  const assetDomains = new Set<string>();
  const assetIps = new Set<string>();
  for (const a of assets) {
    const cand = extractTarget(a.identifier);
    if (cand.domain) assetDomains.add(cand.domain);
    if (cand.host) assetIps.add(cand.host);
  }
  const classify = (name: string, ips: string[]): { inScope: boolean; managed: boolean } => ({
    inScope: liveTargets.some((t) => targetMatches(t, name)) || ips.some((ip) => liveTargets.some((t) => targetMatches(t, ip))),
    managed: assetDomains.has(name) || ips.some((ip) => assetIps.has(ip)),
  });

  let inScopeCount = 0;
  let resolvedCount = 0;
  let managedCount = 0;
  for (const host of discovery.hosts) {
    const { inScope, managed } = classify(host.name, host.ipAddresses);
    if (inScope) inScopeCount++;
    if (host.resolved) resolvedCount++;
    if (managed) managedCount++;
    await db.vaptDiscovery.upsert({
      where: { organizationId_domain_name: { organizationId, domain: body.domain, name: host.name } },
      create: {
        organizationId,
        domain: body.domain,
        name: host.name,
        ipAddresses: JSON.stringify(host.ipAddresses),
        sources: JSON.stringify([host.sources]),
        resolved: host.resolved,
        inScope,
        managed,
      },
      update: {
        ipAddresses: JSON.stringify(host.ipAddresses),
        sources: JSON.stringify([host.sources]),
        resolved: host.resolved,
        inScope,
        managed,
        lastSeenAt: now,
      },
    });
  }

  const shadowCount = discovery.hosts.filter((h) => h.resolved && !h.ipAddresses.some((ip) => assetIps.has(ip)) && !assetDomains.has(h.name)).length;
  const sourceNote =
    source === "live-ct"
      ? "crt.sh live certificate-transparency query"
      : `bundled REAL CT snapshot (captured ${snapshotAsOf}) — live crt.sh source unreachable (${liveError ?? "error"})`;

  await appendVaptAudit({
    type: "DISCOVERY_RUN",
    actorId: user.id,
    actorEmail: user.email,
    organizationId,
    target: body.domain,
    action: `EASM discovery run for "${body.domain}" (${sourceNote})`,
    result: `${discovery.hosts.length} hostname(s), ${resolvedCount} resolving, ${inScopeCount} in-scope, ${shadowCount} unmanaged/shadow`,
    payload: { domain: body.domain, source, snapshotAsOf, liveError, total: discovery.hosts.length, resolved: resolvedCount, inScope: inScopeCount, shadow: shadowCount },
  });
  await audit({
    type: "VAPT_DISCOVERY_RUN",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `EASM discovery for ${org.name}: ${discovery.hosts.length} hostname(s) under "${body.domain}" (${shadowCount} unmanaged/shadow) — ${sourceNote}.`,
  });

  return NextResponse.json(
    {
      domain: body.domain,
      source,
      snapshotAsOf,
      fetchedAt: discovery.fetchedAt,
      sourceNote,
      counts: { total: discovery.hosts.length, resolved: resolvedCount, inScope: inScopeCount, managed: managedCount, shadow: shadowCount },
      hosts: discovery.hosts.map((h) => {
        const { inScope, managed } = classify(h.name, h.ipAddresses);
        return {
          name: h.name,
          ipAddresses: h.ipAddresses,
          resolved: h.resolved,
          inScope,
          managed,
          sources: h.sources,
        };
      }),
    },
    { status: 201 }
  );
}

/**
 * GET /api/vapt/discovery — the EASM registry: stored discoveries with
 * scope/managed classification (the tender's unmanaged / shadow-IT view).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const discoveries = await db.vaptDiscovery.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: [{ lastSeenAt: "desc" }, { name: "asc" }],
    take: 200,
  });

  const resolved = discoveries.filter((d) => d.resolved);
  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    counts: {
      total: discoveries.length,
      resolved: resolved.length,
      inScope: discoveries.filter((d) => d.inScope).length,
      unmanaged: discoveries.filter((d) => !d.managed).length,
      shadow: resolved.filter((d) => !d.managed).length,
    },
    discoveries: discoveries.map((d) => ({
      id: d.id,
      domain: d.domain,
      name: d.name,
      ipAddresses: JSON.parse(d.ipAddresses) as string[],
      resolved: d.resolved,
      inScope: d.inScope,
      managed: d.managed,
      sources: JSON.parse(d.sources),
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
    })),
  });
}
