"use client";

/**
 * Adwa Cyber — Track C Gate Board (proposal Phases 4–5 governance).
 *
 * The roadmap gates content filtering (ACFS) and CII monitoring behind
 * institutional criteria that do not exist yet, exactly so the commercial
 * core is never hostage to them. This view is the living record of those
 * gates: two phase panels, per-criterion status, readiness math, and the
 * unambiguous posture banner ("deployment locked while any gate is closed").
 * Platform-level: SUPER_ADMIN only (governance:view / governance:manage).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldAlert, Lock, LockOpen, CheckCircle2, CircleDashed, Loader2, Ban,
  FileSignature, Scale, Handshake, Landmark, DraftingCompass, Umbrella,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";

// ── DTOs ─────────────────────────────────────────────────────────────────────

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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PARTNERSHIP: Handshake,
  LEGAL: Scale,
  HUMAN_RIGHTS: FileSignature,
  FUNDING: Landmark,
  DESIGN: DraftingCompass,
  INSURANCE: Umbrella,
};

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

export function TrackCView() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<GatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CriterionDTO | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<CriterionDTO["status"]>("IN_PROGRESS");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<GatesResponse>("/api/gates");
      setData(res);
    } catch (e) {
      if (e instanceof ApiCallError) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (c: CriterionDTO) => {
    setEditing(c);
    setNote(c.notes ?? "");
    setStatus(c.status === "SATISFIED" ? "SATISFIED" : c.status === "NOT_STARTED" ? "IN_PROGRESS" : c.status);
    setSaving(false);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/gates/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      toast.success(t("gateSaved"));
      setEditing(null);
      await load();
    } catch (e) {
      if (e instanceof ApiCallError) toast.error(e.message);
      else toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const locked = !data.trackC.deploymentAllowed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-emerald-700" />
          {t("gateTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("gateSub")}</p>
      </div>

      {/* Posture banner */}
      <div className={`flex flex-col gap-1 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4 ${locked ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        {locked ? <Lock className="h-8 w-8 shrink-0 text-amber-600" /> : <LockOpen className="h-8 w-8 shrink-0 text-emerald-600" />}
        <div>
          <p className={`text-sm font-semibold ${locked ? "text-amber-800" : "text-emerald-800"}`}>
            {locked ? t("gateLocked") : t("gateOpen")}
          </p>
          <p className="text-xs text-muted-foreground">{data.trackC.policy}</p>
        </div>
      </div>

      {data.phases.map((p) => (
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{lang === "am" ? c.detailAm : c.detailEn}</p>
                    {c.notes && (
                      <p className="mt-1 rounded bg-muted/60 px-2 py-1 text-xs italic text-muted-foreground">
                        “{c.notes}”{c.updatedBy ? ` — ${c.updatedBy.name}` : ""}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    {t("gateUpdate")}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Update dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? (lang === "am" ? editing.titleAm : editing.titleEn) : ""}</DialogTitle>
            <DialogDescription>{t("gateDialogSub")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving || (status === "SATISFIED" && note.trim().length < 10)} className="bg-emerald-700 hover:bg-emerald-800">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t("gateSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
