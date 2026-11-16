"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Lock, LockOpen, Scale, RefreshCw, Plus, Landmark, FileCheck2, Coins, Gavel,
  AlertTriangle, CheckCircle2, Clock, Ban, CircleDashed, History, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { ACFS_STATUS_LABELS, ACFS_DOMAINS } from "@/lib/acfs-gates";

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface GateItemDTO {
  id: string;
  code: string;
  titleEn: string;
  titleAm: string;
  description: string | null;
  status: string;
  owner: string | null;
  evidenceRef: string | null;
  dueDate: string | null;
  notes: string | null;
  updatedAt: string;
}

interface DomainDTO {
  domain: string;
  total: number;
  satisfied: number;
  inProgress: number;
  blocked: number;
  notStarted: number;
  complete: boolean;
  meta: { labelEn: string; labelAm: string; short: string; descriptionEn: string; descriptionAm: string };
  items: GateItemDTO[];
}

interface DecisionDTO {
  id: string;
  decision: string;
  rationale: string;
  decidedBy: string;
  createdAt: string;
}

interface OverviewDTO {
  generatedAt: string;
  gate: {
    verdict: "LOCKED" | "GATE_OPEN";
    gateOpen: boolean;
    progressPct: number;
    satisfiedItems: number;
    totalItems: number;
    missingDomains: string[];
  };
  domains: DomainDTO[];
  decisions: DecisionDTO[];
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  EMA_PARTNERSHIP: Landmark,
  EHRC_DUE_DILIGENCE: Scale,
  TRANSPARENCY_FRAMEWORK: Gavel,
  DEDICATED_FUNDING: Coins,
};

const STATUS_STYLES: Record<string, { cls: string; icon: React.ElementType }> = {
  NOT_STARTED: { cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: CircleDashed },
  IN_PROGRESS: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", icon: Clock },
  EVIDENCE_SUBMITTED: { cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", icon: FileCheck2 },
  SATISFIED: { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  BLOCKED: { cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", icon: Ban },
};

// ── View ─────────────────────────────────────────────────────────────────────

export function AcfsGateView() {
  const { t, lang, pick } = useI18n();
  const [ov, setOv] = useState<OverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<GateItemDTO | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await api<OverviewDTO>("/api/acfs/overview"));
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed to load the ACFS gate register");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || !ov) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  const locked = !ov.gate.gateOpen;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${locked ? "bg-red-700" : "bg-emerald-700"}`}>
            {locked ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("acfsTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("acfsSub")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-1 h-4 w-4" /> {pick("Refresh", "ተመለስ")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("acfsAddItem")}
          </Button>
          <Button size="sm" onClick={() => setDecisionOpen(true)}>
            <History className="mr-1 h-4 w-4" /> {t("acfsRecordDecision")}
          </Button>
        </div>
      </div>

      {/* Gate status banner */}
      <Card className={`border-2 ${locked ? "border-red-200 dark:border-red-950 bg-red-50/60 dark:bg-red-950/20" : "border-emerald-200 dark:border-emerald-950 bg-emerald-50/60 dark:bg-emerald-950/20"}`}>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {locked ? (
                <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-700 dark:text-red-400" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
              )}
              <div>
                <p className="font-bold">
                  {locked ? t("acfsGateLocked") : t("acfsGateOpen")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locked
                    ? pick(
                        `${ov.gate.satisfiedItems} of ${ov.gate.totalItems} institutional preconditions satisfied (${ov.gate.progressPct}%). No content-filtering engineering is permitted while the gate is shut — by design.`,
                        `ከ${ov.gate.totalItems} ተቋማዊ ቅድመ-ሁኔታዎች ውስጥ ${ov.gate.satisfiedItems} ተሟልተዋል (${ov.gate.progressPct}%)። በተቆለፈበት ጊዜ ምንም የይዘት ማጣሪያ ሥራ አይፈቀድም — በንድፈ-ሐሳብ ነው።`
                      )
                    : t("acfsGateOpenDesc")}
                </p>
                {locked && ov.gate.missingDomains.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ov.gate.missingDomains.map((d) => {
                      const meta = ov.domains.find((x) => x.domain === d)?.meta;
                      return (
                        <Badge key={d} variant="outline" className="border-red-300 text-red-800 dark:border-red-900 dark:text-red-300">
                          <AlertTriangle className="mr-1 h-3 w-3" /> {meta ? pick(meta.labelEn, meta.labelAm) : d}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-[180px]">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("acfsPreconditions")}</span>
                <span className="font-semibold tabular-nums">{ov.gate.satisfiedItems}/{ov.gate.totalItems}</span>
              </div>
              <Progress value={ov.gate.progressPct} className="h-2.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Four gate domains */}
      <div className="grid gap-4 lg:grid-cols-2">
        {ov.domains.map((d) => {
          const Icon = DOMAIN_ICONS[d.domain] ?? Gavel;
          const pct = d.total ? Math.round((d.satisfied / d.total) * 100) : 0;
          return (
            <Card key={d.domain} className={d.complete ? "border-emerald-200 dark:border-emerald-950" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${d.complete ? "bg-emerald-700" : "bg-slate-600"}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <CardTitle className="text-base">{pick(d.meta.labelEn, d.meta.labelAm)}</CardTitle>
                      <CardDescription className="mt-0.5 max-w-md text-xs leading-snug">
                        {pick(d.meta.descriptionEn, d.meta.descriptionAm)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={d.complete ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}>
                    {d.satisfied}/{d.total}
                  </Badge>
                </div>
                <Progress value={pct} className="mt-3 h-1.5" />
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-64 pr-3">
                  <div className="space-y-1.5">
                    {d.items.map((item) => {
                      const st = STATUS_STYLES[item.status] ?? STATUS_STYLES.NOT_STARTED;
                      const StIcon = st.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setEditItem(item)}
                          className="flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
                        >
                          <StIcon className={`mt-0.5 h-4 w-4 shrink-0 ${item.status === "SATISFIED" ? "text-emerald-600" : item.status === "BLOCKED" ? "text-red-600" : "text-muted-foreground"}`} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{item.code}</span>
                              <span className="text-sm font-medium leading-snug">{pick(item.titleEn, item.titleAm)}</span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              {item.owner && <span>· {item.owner}</span>}
                              {item.evidenceRef && <span className="truncate">· {t("acfsEvidence")}: {item.evidenceRef}</span>}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                            {pick(ACFS_STATUS_LABELS[item.status as keyof typeof ACFS_STATUS_LABELS]?.[0] ?? item.status, ACFS_STATUS_LABELS[item.status as keyof typeof ACFS_STATUS_LABELS]?.[1] ?? item.status)}
                          </span>
                        </button>
                      );
                    })}
                    {d.items.length === 0 && (
                      <p className="p-2 text-xs text-muted-foreground">{t("acfsNoItems")}</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Decision history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" aria-hidden /> {t("acfsDecisionHistory")}
          </CardTitle>
          <CardDescription>{t("acfsDecisionHistoryDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {ov.decisions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("acfsNoDecisions")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acfsDecision")}</TableHead>
                  <TableHead className="min-w-[240px]">{t("acfsRationale")}</TableHead>
                  <TableHead>{pick("Recorded by", "ያስመዘገበው")}</TableHead>
                  <TableHead className="text-right">{pick("Date", "ቀን")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ov.decisions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge className={d.decision === "UNLOCKED" ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}>
                        {d.decision === "UNLOCKED" ? t("acfsUnlocked") : t("acfsRemainedLocked")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{d.rationale}</TableCell>
                    <TableCell className="text-sm">{d.decidedBy}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {editItem && (
        <EditItemDialog
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            void refresh();
          }}
        />
      )}
      <AddItemDialog open={addItemOpen} onClose={() => setAddItemOpen(false)} onSaved={() => { setAddItemOpen(false); void refresh(); }} domains={ov.domains.map((d) => d.domain)} />
      <DecisionDialog open={decisionOpen} onClose={() => setDecisionOpen(false)} onSaved={() => { setDecisionOpen(false); void refresh(); }} />
    </div>
  );
}

// ── Edit item dialog ─────────────────────────────────────────────────────────

function EditItemDialog({ item, onClose, onSaved }: { item: GateItemDTO; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [status, setStatus] = useState(item.status);
  const [evidenceRef, setEvidenceRef] = useState(item.evidenceRef ?? "");
  const [owner, setOwner] = useState(item.owner ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/acfs/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, evidenceRef, owner, notes }),
      });
      toast.success(pick(`Precondition ${item.code} updated`, `ቅድመ-ሁኔታ ${item.code} ተዘምኗል`));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold dark:bg-slate-800">{item.code}</span>
            {pick(item.titleEn, item.titleAm)}
          </DialogTitle>
          <DialogDescription>{item.description ?? ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("acfsStatus")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACFS_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{pick(v[0], v[1])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("acfsEvidenceRefLabel")}</Label>
            <Input value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder={t("acfsEvidencePh")} />
            <p className="text-[11px] text-muted-foreground">{t("acfsEvidenceHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Owner", "ባለቤት")}</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Notes", "ማስታወሻዎች")}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? pick("Saving…", "በማስቀመጥ ላይ…") : pick("Save", "አስቀምጥ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add item dialog ──────────────────────────────────────────────────────────

function AddItemDialog({ open, onClose, onSaved, domains }: { open: boolean; onClose: () => void; onSaved: () => void; domains: string[] }) {
  const { t, pick } = useI18n();
  const [domain, setDomain] = useState(domains[0] ?? "EMA_PARTNERSHIP");
  const [titleEn, setTitleEn] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (titleEn.trim().length < 3) {
      toast.error(pick("Title is required (min 3 characters).", "ርዕስ ያስፈልጋል (ቢያንስ 3 ፊደላት)።"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/acfs/items", {
        method: "POST",
        body: JSON.stringify({ domain, titleEn, description, owner }),
      });
      toast.success(pick("Precondition added to the register", "ቅድመ-ሁኔታ ታክሏል"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiCallError ? e.message : "Failed to add precondition");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("acfsAddItem")}</DialogTitle>
          <DialogDescription>{t("acfsAddItemDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("acfsDomain")}</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACFS_DOMAINS.map((d) => (
                  <SelectItem key={d} value={d}>{d.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Title", "ርዕስ")}</Label>
            <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Publish category definitions in the Federal Negarit Gazette" />
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Description", "መግለጫ")}</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{pick("Owner", "ባለቤት")}</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? pick("Adding…", "በመጨመር ላይ…") : pick("Add", "ጨምር")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Gate decision dialog ─────────────────────────────────────────────────────

function DecisionDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const [decision, setDecision] = useState("REMAINED_LOCKED");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (rationale.trim().length < 10) {
      toast.error(t("acfsRationaleRequired"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/acfs/decision", {
        method: "POST",
        body: JSON.stringify({ decision, rationale }),
      });
      toast.success(t("acfsDecisionRecorded"));
      setRationale("");
      onSaved();
    } catch (e) {
      // 409 GATE_NOT_OPEN — the server refused to unlock: show why.
      toast.error(e instanceof ApiCallError ? e.message : "Failed to record decision");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gavel className="h-4 w-4" /> {t("acfsRecordDecision")}</DialogTitle>
          <DialogDescription>{t("acfsRecordDecisionDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("acfsDecision")}</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REMAINED_LOCKED">{t("acfsRemainedLocked")}</SelectItem>
                <SelectItem value="UNLOCKED">{t("acfsUnlocked")}</SelectItem>
              </SelectContent>
            </Select>
            {decision === "UNLOCKED" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {t("acfsUnlockWarning")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("acfsRationale")}</Label>
            <Textarea rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={t("acfsRationalePh")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{pick("Cancel", "ሰርዝ")}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? pick("Recording…", "በመመዝገብ ላይ…") : pick("Record decision", "ውሳኔ መዝግብ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
