"use client";

/**
 * Adwa Cyber — Track C Gate Board (proposal Phases 4–5 governance).
 *
 * The roadmap gates content filtering (ACFS) and CII monitoring behind
 * institutional criteria that do not exist yet, exactly so the commercial
 * core is never hostage to them. This view is the living record of those
 * gates: two phase panels, per-criterion status, readiness math, and the
 * unambiguous posture banner ("deployment locked while any gate is closed").
 *
 * Accountability layer: every criterion carries a SHA-256-sealed evidence
 * register (satisfaction without an artefact is refused server-side) and an
 * append-only per-criterion timeline — the record a funder, regulator, or
 * university partner audits. The Dossier button exports the whole posture
 * as a PDF for exactly those counterparts.
 * Platform-level: SUPER_ADMIN only (governance:view / governance:manage).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Lock, LockOpen, CheckCircle2, CircleDashed, Loader2, Ban,
  FileSignature, Scale, Handshake, Landmark, DraftingCompass, Umbrella,
  FileCheck2, Paperclip, History, FileDown, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { CiiMonitorView } from "./cii-monitor";
import { AcfsGateView } from "./acfs-gate";
import { api, ApiCallError } from "@/lib/auth-client";

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface EvidenceDTO {
  id: string;
  fileName: string;
  description: string | null;
  mimeType: string;
  fileSize: number;
  checksum: string;
  uploadedBy: { name: string } | null;
  createdAt: string;
}

interface CriterionDTO {
  id: string;
  code: string;
  titleEn: string;
  titleAm: string;
  detailEn: string;
  detailAm: string;
  category: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SATISFIED" | "BLOCKED";
  blocking: boolean;
  notes: string | null;
  targetDate: string | null;
  updatedBy: { name: string } | null;
  updatedAt: string;
  evidence: EvidenceDTO[];
  eventCount: number;
}

interface ReadinessDTO {
  phase: string;
  total: number;
  satisfied: number;
  inProgress: number;
  blocked: number;
  readinessPct: number;
  open: boolean;
  deploymentAllowed: boolean;
}

interface PhaseDTO {
  phase: string;
  label: string;
  labelAm: string;
  instrument: string;
  readiness: ReadinessDTO;
  criteria: CriterionDTO[];
}

interface GatesResponse {
  phases: PhaseDTO[];
  trackC: { anyGateOpen: boolean; deploymentAllowed: boolean; policy: string };
}

interface GateEventDTO {
  id: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  evidenceId: string | null;
  actor: { name: string; role: string } | null;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PARTNERSHIP: Handshake,
  LEGAL: Scale,
  HUMAN_RIGHTS: FileSignature,
  FUNDING: Landmark,
  DESIGN: DraftingCompass,
  INSURANCE: Umbrella,
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const diffH = Math.round((Date.now() - d.getTime()) / 36e5);
  const date = d.toISOString().slice(0, 10);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  return date;
}

function StatusChip({ status }: { status: CriterionDTO["status"] }) {
  const map = {
    NOT_STARTED: "bg-slate-100 text-slate-600 border-slate-200",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
    SATISFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    BLOCKED: "bg-red-50 text-red-700 border-red-200",
  } as const;
  const label = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", SATISFIED: "Satisfied", BLOCKED: "Blocked" }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>
      {status === "SATISFIED" ? <CheckCircle2 className="h-3 w-3" /> : status === "BLOCKED" ? <Ban className="h-3 w-3" /> : status === "IN_PROGRESS" ? <Loader2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function TrackCView({ canManageCii = false }: { canManageCii?: boolean }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<GatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackPane, setTrackPane] = useState<"board" | "cii" | "acfs">("board");

  // review dialog state
  const [reviewing, setReviewing] = useState<CriterionDTO | null>(null);
  const [tab, setTab] = useState<"status" | "evidence" | "timeline">("status");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<CriterionDTO["status"]>("IN_PROGRESS");
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<GateEventDTO[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [desc, setDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<GatesResponse>("/api/gates");
      setData(res);
      // keep an open review dialog in sync with fresh board state
      setReviewing((r) => (r ? res.phases.flatMap((p) => p.criteria).find((c) => c.id === r.id) ?? r : r));
    } catch (e) {
      if (e instanceof ApiCallError) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = (c: CriterionDTO, which: "status" | "evidence" | "timeline" = "status") => {
    setReviewing(c);
    setTab(which);
    setNote(c.notes ?? "");
    setStatus(c.status === "SATISFIED" ? "SATISFIED" : c.status === "NOT_STARTED" ? "IN_PROGRESS" : c.status);
    setSaving(false);
    setDesc("");
    setEvents(null);
  };

  // lazy-load the timeline when its tab is opened
  useEffect(() => {
    if (!reviewing || tab !== "timeline" || events) return;
    let live = true;
    setEventsLoading(true);
    api<{ events: GateEventDTO[] }>(`/api/gates/${reviewing.id}/events`)
      .then((res) => { if (live) setEvents(res.events); })
      .catch((e) => { if (e instanceof ApiCallError) toast.error(e.message); })
      .finally(() => { if (live) setEventsLoading(false); });
    return () => { live = false; };
  }, [reviewing, tab, events]);

  const save = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      await api(`/api/gates/${reviewing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      toast.success(t("gateSaved"));
      await load();
    } catch (e) {
      if (e instanceof ApiCallError) toast.error(e.message);
      else toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const upload = async () => {
    if (!reviewing) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (desc.trim()) fd.append("description", desc.trim());
      await api(`/api/gates/${reviewing.id}/evidence`, { method: "POST", body: fd });
      toast.success(t("gateUploaded"));
      if (fileRef.current) fileRef.current.value = "";
      setDesc("");
      await load();
    } catch (e) {
      if (e instanceof ApiCallError) toast.error(e.message);
      else toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading && !data && trackPane === "board") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data && trackPane === "board") return null;

  const locked = !data?.trackC.deploymentAllowed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-end gap-3">
        {trackPane === "board" && (
          <a
            href={`/api/gates/dossier?lang=${lang}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            title={t("gateDossierHint")}
          >
            <FileDown className="h-4 w-4 text-emerald-700" />
            {t("gateDossier")}
          </a>
        )}
      </div>

      {/* Pane switcher: gate board (§11.1) · CII readiness (P5) · ACFS register (P4) */}
      <div role="tablist" aria-label={t("gateTitle")} className="flex w-full max-w-xl rounded-lg border bg-muted p-1 text-sm">
        {(["board", "cii", "acfs"] as const).map((pane) => (
          <button
            key={pane}
            role="tab"
            aria-selected={trackPane === pane}
            onClick={() => setTrackPane(pane)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              trackPane === pane ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {pane === "board" ? t("gateTabBoard") : pane === "cii" ? t("gateTabCii") : t("gateTabAcfs")}
          </button>
        ))}
      </div>

      {trackPane === "cii" && <CiiMonitorView canManage={canManageCii} />}
      {trackPane === "acfs" && <AcfsGateView />}

      {trackPane === "board" && (
        <>
      {/* Posture banner */}
      <div className={`flex flex-col gap-1 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4 ${locked ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        {locked ? <Lock className="h-8 w-8 shrink-0 text-amber-600" /> : <LockOpen className="h-8 w-8 shrink-0 text-emerald-600" />}
        <div>
          <p className={`text-sm font-semibold ${locked ? "text-amber-800" : "text-emerald-800"}`}>
            {locked ? t("gateLocked") : t("gateOpen")}
          </p>
          <p className="text-xs text-muted-foreground">{data?.trackC.policy}</p>
        </div>
      </div>

      {data?.phases.map((p) => (
        <Card key={p.phase}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{lang === "am" ? p.labelAm : p.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.instrument}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("gateReadiness")}</p>
                  <p className="text-lg font-bold tabular-nums">{p.readiness.readinessPct}%</p>
                </div>
                <Badge variant={p.readiness.open ? "default" : "secondary"} className={p.readiness.open ? "bg-emerald-700" : ""}>
                  {p.readiness.open ? t("gateOpenChip") : t("gateLockedChip")}
                </Badge>
              </div>
            </div>
            <Progress value={p.readiness.readinessPct} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground">
              {p.readiness.satisfied}/{p.readiness.total} {t("gateCriteriaSatisfied")} · {p.readiness.inProgress} {t("gateInProgress")} · {p.readiness.blocked} {t("gateBlocked")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.criteria.map((c) => {
              const Icon = CATEGORY_ICONS[c.category] ?? Scale;
              return (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5 rounded-md bg-muted p-2">
                    <Icon className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{lang === "am" ? c.titleAm : c.titleEn}</p>
                      <StatusChip status={c.status} />
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c.code}</span>
                      <button
                        type="button"
                        onClick={() => openReview(c, "evidence")}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          c.evidence.length ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                        title={t("gateTabEvidence", String(c.evidence.length))}
                      >
                        <FileCheck2 className="h-3 w-3" />
                        {t("gateArtifacts", String(c.evidence.length))}
                      </button>
                      {c.eventCount > 0 && (
                        <button
                          type="button"
                          onClick={() => openReview(c, "timeline")}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100"
                          title={t("gateTabTimeline")}
                        >
                          <History className="h-3 w-3" />
                          {c.eventCount}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{lang === "am" ? c.detailAm : c.detailEn}</p>
                    {c.notes && (
                      <p className="mt-1 rounded bg-muted/60 px-2 py-1 text-xs italic text-muted-foreground">
                        “{c.notes}”{c.updatedBy ? ` — ${c.updatedBy.name}` : ""}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openReview(c)}>
                    {t("gateReview")}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
        </>
      )}

      {/* ── Review dialog: status · evidence · timeline ─────────────────────── */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {reviewing ? (lang === "am" ? reviewing.titleAm : reviewing.titleEn) : ""}
              {reviewing && <StatusChip status={reviewing.status} />}
            </DialogTitle>
            <DialogDescription>{reviewing?.code}</DialogDescription>
          </DialogHeader>

          {/* tab bar */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["status", "evidence", "timeline"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "status" ? (
                  t("gateTabStatus")
                ) : k === "evidence" ? (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" />
                    {t("gateTabEvidence", String(reviewing?.evidence.length ?? 0))}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <History className="h-3.5 w-3.5" />
                    {t("gateTabTimeline")}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Status tab ── */}
          {tab === "status" && reviewing && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{t("gateDialogSub")}</p>
              <div className="space-y-2">
                <Label>{t("gateNewStatus")}</Label>
                <div className="flex flex-wrap gap-2">
                  {(["NOT_STARTED", "IN_PROGRESS", "SATISFIED", "BLOCKED"] as const).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={status === s ? "default" : "outline"}
                      className={status === s ? "bg-emerald-700 hover:bg-emerald-800" : ""}
                      onClick={() => setStatus(s)}
                    >
                      {s === "NOT_STARTED" ? t("gateStNotStarted") : s === "IN_PROGRESS" ? t("gateStInProgress") : s === "SATISFIED" ? t("gateStSatisfied") : t("gateStBlocked")}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("gateNote")}</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("gateNotePh")}
                  rows={3}
                />
                {status === "SATISFIED" && note.trim().length < 10 && (
                  <p className="text-xs text-red-600">{t("gateNoteRequired")}</p>
                )}
                {status === "SATISFIED" && reviewing.evidence.length === 0 && (
                  <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                    <Paperclip className="mr-1 inline h-3 w-3" />
                    {t("gateEvidenceRequired")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Evidence tab ── */}
          {tab === "evidence" && reviewing && (
            <div className="space-y-4">
              {reviewing.evidence.length === 0 ? (
                <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("gateNoEvidence")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {reviewing.evidence.map((e) => (
                    <li key={e.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.fileName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtBytes(e.fileSize)} · {e.uploadedBy?.name ?? "—"} · {fmtWhen(e.createdAt)}
                          </p>
                          {e.description && <p className="mt-0.5 text-xs italic text-muted-foreground">{e.description}</p>}
                        </div>
                        <a
                          href={`/api/gates/${reviewing.id}/evidence/${e.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm hover:bg-accent"
                        >
                          <FileDown className="h-3.5 w-3.5 text-emerald-700" />
                          {t("gateDownload")}
                        </a>
                      </div>
                      <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground" title={e.checksum}>
                        {t("gateChecksumShort")} · {e.checksum}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <Label className="text-xs">{t("gateUpload")}</Label>
                <Input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt,.zip" className="text-xs" />
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("gateUploadDesc")}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">{t("gateUploadHint")}</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={upload}
                  disabled={uploading || !fileRef.current?.files?.[0]}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1 h-4 w-4" />}
                  {uploading ? t("gateUploading") : t("gateUpload")}
                </Button>
              </div>
            </div>
          )}

          {/* ── Timeline tab ── */}
          {tab === "timeline" && reviewing && (
            <div className="space-y-3">
              {eventsLoading && !events && (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {events && events.length === 0 && (
                <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("gateNoEvents")}
                </p>
              )}
              {events && events.length > 0 && (
                <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                  {events.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-600" />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold">
                          {ev.kind === "STATUS_CHANGE" ? (
                            <span className="inline-flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-emerald-700" />
                              {t("gateEvStatusChange")}
                              {ev.fromStatus && ev.toStatus && (
                                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                  {ev.fromStatus} → {ev.toStatus}
                                </span>
                              )}
                            </span>
                          ) : ev.kind === "EVIDENCE_ATTACHED" ? (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="h-3 w-3 text-emerald-700" />
                              {t("gateEvEvidence")}
                            </span>
                          ) : ev.kind === "CRITERION_SEEDED" ? (
                            <span className="inline-flex items-center gap-1">
                              <CircleDashed className="h-3 w-3 text-emerald-700" />
                              {t("gateEvSeeded")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <FileCheck2 className="h-3 w-3 text-emerald-700" />
                              {t("gateEvVerified")}
                            </span>
                          )}
                        </p>
                        <span className="text-[11px] text-muted-foreground">
                          {ev.actor?.name ?? "system"} · {fmtWhen(ev.createdAt)}
                        </span>
                      </div>
                      {ev.note && <p className="mt-0.5 text-xs text-muted-foreground">{ev.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>{t("cancel")}</Button>
            {tab === "status" && (
              <Button
                onClick={save}
                disabled={saving || (status === "SATISFIED" && note.trim().length < 10)}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t("gateSave")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
