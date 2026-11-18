/**
 * Adwa Cyber — hash-chained append-only VAPT audit log (plan §1: "Audit log
 * every action (who, what, target, time, result). Append-only table,
 * hash-chained rows.").
 *
 * Chain design:
 *   row.hash = sha256( seq ‖ prevHash ‖ canonical(payload) )
 * The chain is stored in one table, written only through `appendVaptAudit`
 * (single transaction: read last row → compute hash → insert with seq = last+1).
 * `verifyVaptAuditChain` walks the table recomputing every hash — the first
 * mismatch pins the exact tampered row and every later row also fails.
 */
import { createHash } from "crypto";
import { db } from "./db";

export type VaptAuditType =
  | "SCOPE_CREATED"
  | "SCOPE_APPROVED"
  | "SCOPE_REJECTED"
  | "SCOPE_EXPIRED"
  | "SCAN_STARTED"
  | "SCAN_COMPLETED"
  | "SCAN_FAILED"
  | "SCAN_REJECTED" // the authorization gate refusal — the plan's acceptance test
  | "SCAN_PROFILE_BLOCKED" // intrusive profile attempted without opt-in
  | "FINDING_DEDUPED"
  | "FINDING_AUTOCLOSED" // not re-observed on rescan → verified fixed
  | "CHECK_CREATED"
  | "CHECK_TESTED"
  | "CHECK_REJECTED"; // custom-check test-run blocked at the authorization gate

export interface VaptAuditInput {
  type: VaptAuditType;
  actorId?: string | null;
  actorEmail: string;
  organizationId?: string | null;
  target?: string | null;
  action: string;
  result: string;
  payload?: Record<string, unknown>;
}

const GENESIS = "GENESIS";

function canonical(value: unknown): string {
  // Deterministic JSON: sorted keys, no whitespace — stable across engines.
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(rec).sort()) out[k] = walk(rec[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

export function computeRowHash(seq: number, prevHash: string, payload: Record<string, unknown>): string {
  return createHash("sha256").update(`${seq}|${prevHash}|${canonical(payload)}`).digest("hex");
}

/**
 * Append one audit row (single-threaded-safe under SQLite's serial writers:
 * the read-last/compute/insert is wrapped in Prisma's interactive
 * transaction; the unique seq index enforces monotonicity regardless).
 */
export async function appendVaptAudit(input: VaptAuditInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const last = await tx.vaptAuditChain.findFirst({ orderBy: { seq: "desc" } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS;
    const payload: Record<string, unknown> = {
      type: input.type,
      actorEmail: input.actorEmail,
      organizationId: input.organizationId ?? null,
      target: input.target ?? null,
      action: input.action,
      result: input.result,
      detail: input.payload ?? {},
    };
    const hash = computeRowHash(seq, prevHash, payload);
    await tx.vaptAuditChain.create({
      data: {
        seq,
        type: input.type,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail,
        organizationId: input.organizationId ?? null,
        target: input.target ?? null,
        action: input.action,
        result: input.result,
        payload: canonical(payload),
        prevHash,
        hash,
      },
    });
  });
}

export interface ChainVerification {
  rows: number;
  valid: boolean;
  firstBadSeq?: number;
  note: string;
}

/**
 * Walk the entire chain and recompute every hash (tamper check).
 * The plan's governance requirement: "audit logging UI with search, filters,
 * export and tamper check" — this is the tamper check.
 */
export async function verifyVaptAuditChain(): Promise<ChainVerification> {
  const rows = await db.vaptAuditChain.findMany({ orderBy: { seq: "asc" } });
  let prev = GENESIS;
  for (const row of rows) {
    const parsed = JSON.parse(row.payload || "{}");
    const expected = computeRowHash(row.seq, prev, {
      type: row.type,
      actorEmail: row.actorEmail,
      organizationId: row.organizationId ?? null,
      target: row.target ?? null,
      action: row.action,
      result: row.result,
      detail: parsed.detail ?? {},
    });
    if (row.prevHash !== prev || row.hash !== expected) {
      return {
        rows: rows.length,
        valid: false,
        firstBadSeq: row.seq,
        note: `Hash chain broken at seq ${row.seq} — row (or an earlier row) was modified after the fact.`,
      };
    }
    prev = row.hash;
  }
  return { rows: rows.length, valid: true, note: `Chain intact — ${rows.length} hash-linked rows, verified end-to-end.` };
}
