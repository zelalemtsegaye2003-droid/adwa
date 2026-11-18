import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { parseCheckYaml, evaluateCheck } from "@/lib/vapt-checks";
import { runInfraScan, SAFE_DEFAULT } from "@/lib/vapt-netengine";
import { runDastScan } from "@/lib/vapt-engine";
import { extractTarget, authorizingScope } from "@/lib/vapt-scope";
import { appendVaptAudit } from "@/lib/vapt-audit";

export const runtime = "nodejs";

interface TestBody {
  target?: string;
  ports?: number[];
}

const MAX_PORTS = 64;

function testSchema(data: unknown): TestBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.target === undefined || typeof d.target !== "string" || !d.target.trim()) return null;
  if (d.ports !== undefined) {
    if (!Array.isArray(d.ports) || d.ports.length > MAX_PORTS) return null;
    for (const p of d.ports) {
      if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) return null;
    }
  }
  return {
    target: d.target.trim().slice(0, 200),
    ports: Array.isArray(d.ports) ? (d.ports as number[]) : undefined,
  };
}

/**
 * POST /api/vapt/checks/[id]/test — LIVE test-run of a custom check.
 *
 * The analyst supplies a target (IP / hostname / URL) and optional ports; the
 * runner executes the SAME SAFE probes the scan engine uses (TCP connect +
 * banner/TLS/HTTP-HEAD infra probes, DAST header battery for URL targets) and
 * evaluates the check's declarative matchers against the REAL observations.
 *
 * Authorization gate (plan §1, identical to scans): the target must lie inside
 * an APPROVED, in-window scope of the check's organization — otherwise the
 * test-run is REJECTED at the API level before any packet is sent, and both
 * the VAPT audit chain (CHECK_REJECTED) and the platform audit log record it.
 *
 * No execution surface: matchers evaluate probe DATA only (sandboxed by design).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const check = await db.vaptCustomCheck.findUnique({ where: { id } });
  if (!check) return NextResponse.json({ error: "Check not found" }, { status: 404 });

  const isSuper = can(user.role, "vapt:manage-all");
  if (!isSuper && check.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This check belongs to another organization" }, { status: 403 });
  }

  const parsed = await parseBody(req, testSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const target = body.target as string;

  let def;
  try {
    def = parseCheckYaml(check.yaml);
  } catch (err) {
    return NextResponse.json(
      { error: `Stored check YAML is no longer valid: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  // ── Authorization gate — BEFORE any probe leaves the box ─────────────────
  const scopes = await db.vaptScope.findMany({ where: { organizationId: check.organizationId } });
  const now = new Date();
  const scope = authorizingScope(target, scopes, now);
  if (!scope) {
    await appendVaptAudit({
      type: "CHECK_REJECTED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId: check.organizationId,
      target: target.slice(0, 200),
      action: `Custom check "${check.name}" test-run rejected at the authorization gate — target outside any approved, in-window scope`,
      result: "rejected — nothing was probed",
      payload: { checkId: check.id, target, matcherTypes: def.match.map((m) => m.type) },
    });
    await audit({
      type: "ACCESS_DENIED",
      userId: user.id,
      email: user.email,
      organizationId: check.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT custom check test-run rejected — out-of-scope target: ${target}`,
    });
    return NextResponse.json(
      {
        error: "Test-run rejected by the authorization gate — the target is not inside an approved, in-window scope.",
        remediation: "Create a scope covering this target and have a second user approve it (four-eyes), then re-run.",
      },
      { status: 403 }
    );
  }

  // ── SAFE live probes (same engines the scan route uses) ─────────────────
  const isUrl = /^https?:\/\//i.test(target);
  const cand = extractTarget(target);
  const host = cand.host ?? cand.domain;
  let infra = null as Awaited<ReturnType<typeof runInfraScan>> | null;
  let dast = null as Awaited<ReturnType<typeof runDastScan>> | null;
  let probeError: string | null = null;

  try {
    if (host) {
      const basePorts = body.ports?.length ? body.ports : SAFE_DEFAULT.ports;
      const ports = [...new Set([...basePorts, ...(cand.port ? [cand.port] : [])])].sort((a, b) => a - b);
      infra = await runInfraScan(host, { ...SAFE_DEFAULT, ports, concurrency: 8 });
    } else {
      probeError = "target is not scannable by the infra engine (no host/IP could be extracted)";
    }
    if (isUrl) {
      dast = await runDastScan(target);
    }
  } catch (err) {
    probeError = err instanceof Error ? err.message.slice(0, 200) : "engine error";
  }

  // ── Sandboxed evaluation over the REAL probe data ──────────────────────
  const evaluation = evaluateCheck(def, infra, dast);
  const reachable = (infra?.reachable ?? false) || (dast?.reachable ?? false);

  const lastResult = {
    matched: evaluation.matched,
    evidence: evaluation.evidence,
    target,
    host,
    reachable,
    openPorts: infra?.openPorts ?? [],
    dastChecks: dast ? dast.checks.length : 0,
    scopeId: scope.id,
    scopeName: scope.name,
    ranAt: now.toISOString(),
  };
  await db.vaptCustomCheck.update({
    where: { id: check.id },
    data: { lastRunAt: now, lastResult: JSON.stringify(lastResult) },
  });

  await appendVaptAudit({
    type: "CHECK_TESTED",
    actorId: user.id,
    actorEmail: user.email,
    organizationId: check.organizationId,
    target: target.slice(0, 200),
    action: `Custom check "${check.name}" test-run against ${target} under scope "${scope.name}"`,
    result: evaluation.matched
      ? `matched — ${evaluation.evidence.slice(0, 160)}`
      : `not matched${reachable ? " — target evaluated, no matcher fired" : " — target unreachable"}`,
    payload: {
      checkId: check.id,
      version: check.version,
      target,
      ports: body.ports ?? null,
      matched: evaluation.matched,
      reachable,
      openPorts: infra?.openPorts ?? [],
      probeError,
    },
  });
  await audit({
    type: "VAPT_CHECK_TESTED",
    userId: user.id,
    email: user.email,
    organizationId: check.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `VAPT custom check "${check.name}" test-run against ${target}: ${evaluation.matched ? "matched" : "not matched"} (${evaluation.evidence.slice(0, 120)}).`,
  });

  return NextResponse.json({
    check: { id: check.id, name: check.name, version: check.version },
    scope: { id: scope.id, name: scope.name },
    target,
    reachable,
    openPorts: infra?.openPorts ?? [],
    dastChecks: dast ? dast.checks.length : 0,
    probeError: probeError ?? infra?.error ?? dast?.error ?? null,
    result: { matched: evaluation.matched, evidence: evaluation.evidence },
  });
}
