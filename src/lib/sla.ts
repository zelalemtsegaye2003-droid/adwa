/**
 * Adwa Cyber — Remediation SLA policy (corrective-action timelines).
 *
 * The Cybersecurity Proclamation No. 1426/2026 requires operators of critical
 * information infrastructure to implement corrective actions within the
 * timelines set by the competent authority, and NBE supervisors expect banks
 * to submit remediation plans for supervisory findings promptly (typically
 * within 30 days) and to close them on an agreed schedule. The platform's
 * default policy mirrors that supervisory practice by severity:
 *
 *   critical → 30 days   (supervisory remediation-plan window)
 *   high     → 60 days   (one NBE reporting quarter)
 *   medium   → 90 days   (one quarter plus board-cycle sign-off)
 *
 * The policy is a platform default, not a legal citation: exact statutory
 * day counts are set per directive and can be tuned centrally here. dueAt is
 * stamped once (when the finding is born at scan completion) so a later
 * policy change never rewrites an existing commitment.
 *
 * Pure module — safe on both server and client.
 */

export const SLA_DAYS: Record<string, number> = {
  critical: 30,
  high: 60,
  medium: 90,
};

export const SLA_DUE_SOON_WINDOW_DAYS = 7; // "due soon" warning band

export function slaDaysFor(severity: string): number {
  return SLA_DAYS[severity] ?? SLA_DAYS.medium;
}

/** Deadline for a finding of the given severity, counted from scan completion. */
export function slaDueDate(severity: string, from: Date, now = new Date()): Date {
  // A backfilled/historical finding (from in the past) keeps its real deadline;
  // a future-dated completion is clamped to now so SLAs never start early.
  const base = from.getTime() <= now.getTime() ? from : now;
  return new Date(base.getTime() + slaDaysFor(severity) * 86_400_000);
}

// ── SLA state machine ────────────────────────────────────────────────────────

export type SlaState =
  | "ON_TRACK" // open/in_progress, more than the due-soon window left
  | "DUE_SOON" // open/in_progress, ≤ 7 days left
  | "OVERDUE" // open/in_progress, past the deadline
  | "CLOSED_ON_TIME" // remediated before (or on) the deadline
  | "CLOSED_LATE" // remediated after the deadline — needs supervisor attention
  | "WAIVED" // accepted risk — SLA no longer applies
  | "NOT_TRACKED"; // legacy finding without a due date

export interface SlaInput {
  status: string; // open | in_progress | remediated | waived
  dueAt: string | Date | null;
  remediatedAt: string | Date | null;
  now?: Date;
}

export interface SlaInfo {
  state: SlaState;
  /** Calendar days remaining until the deadline (negative when overdue). */
  daysRemaining: number | null;
  dueAt: Date | null;
}

export function slaInfo({ status, dueAt, remediatedAt, now = new Date() }: SlaInput): SlaInfo {
  const due = dueAt ? new Date(dueAt) : null;
  const closed = remediatedAt ? new Date(remediatedAt) : null;

  if (status === "waived") {
    return { state: "WAIVED", daysRemaining: null, dueAt: due };
  }
  if (!due) {
    return { state: "NOT_TRACKED", daysRemaining: null, dueAt: null };
  }

  // Whole-day arithmetic: a deadline later today still counts as 0 days left.
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);

  if (status === "remediated") {
    const onTime = closed ? closed.getTime() <= due.getTime() : null;
    return {
      state: onTime === null ? "NOT_TRACKED" : onTime ? "CLOSED_ON_TIME" : "CLOSED_LATE",
      daysRemaining,
      dueAt: due,
    };
  }

  // open | in_progress
  const state: SlaState = daysRemaining < 0 ? "OVERDUE" : daysRemaining <= SLA_DUE_SOON_WINDOW_DAYS ? "DUE_SOON" : "ON_TRACK";
  return { state, daysRemaining, dueAt: due };
}

// ── Summary helper ───────────────────────────────────────────────────────────

export interface SlaSummary {
  tracked: number; // findings with a deadline, not waived
  onTrack: number;
  dueSoon: number;
  overdue: number;
  closedOnTime: number;
  closedLate: number;
  waived: number;
  notTracked: number;
}

export function emptySlaSummary(): SlaSummary {
  return {
    tracked: 0, onTrack: 0, dueSoon: 0, overdue: 0,
    closedOnTime: 0, closedLate: 0, waived: 0, notTracked: 0,
  };
}

export function summarizeSla(infos: SlaInfo[]): SlaSummary {
  const s = emptySlaSummary();
  for (const i of infos) {
    switch (i.state) {
      case "ON_TRACK": s.onTrack++; s.tracked++; break;
      case "DUE_SOON": s.dueSoon++; s.tracked++; break;
      case "OVERDUE": s.overdue++; s.tracked++; break;
      case "CLOSED_ON_TIME": s.closedOnTime++; s.tracked++; break;
      case "CLOSED_LATE": s.closedLate++; s.tracked++; break;
      case "WAIVED": s.waived++; break;
      default: s.notTracked++;
    }
  }
  return s;
}

/** Human outcome for the audit trail when a finding closes. */
export function slaClosureNote(info: SlaInfo): string {
  if (info.state === "CLOSED_ON_TIME") {
    const d = info.daysRemaining ?? 0;
    return `closed on time (${d === 0 ? "on the deadline" : `${d} day${Math.abs(d) === 1 ? "" : "s"} to spare`})`;
  }
  if (info.state === "CLOSED_LATE") {
    const d = Math.abs(info.daysRemaining ?? 0);
    return `closed LATE (${d} day${d === 1 ? "" : "s"} past the deadline)`;
  }
  return "closed without a tracked deadline";
}
