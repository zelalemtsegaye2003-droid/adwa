"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { useAuth } from "@/components/auth/auth-gate";
import { ScoreRing, fmtDate, type OrgDTO } from "./shared";

export function OrganizationsView({ onNewScan }: { onNewScan: (orgId: string) => void }) {
  const { t, pick } = useI18n();
  const { me } = useAuth();
  const isSuper = me.user.role === "SUPER_ADMIN";
  const [orgs, setOrgs] = useState<OrgDTO[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", nameAm: "", sector: "Banking", tier: "mid-market", contactEmail: "", notes: "" });

  const load = () => api<{ organizations: OrgDTO[] }>("/api/organizations").then((d) => setOrgs(d.organizations)).catch(() => setOrgs([]));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim()) { toast.error(t("orgName")); return; }
    try {
      await api("/api/organizations", {
        method: "POST", body: JSON.stringify(form),
      });
      toast.success(`${form.name} — ${t("save")}`);
      setOpen(false);
      setForm({ name: "", nameAm: "", sector: "Banking", tier: "mid-market", contactEmail: "", notes: "" });
      load();
    } catch (err) {
      toast.error(err instanceof ApiCallError ? err.message : "Error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {isSuper && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Plus className="h-4 w-4" aria-hidden /> {t("addOrg")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("addOrg")}</DialogTitle>
              <DialogDescription>Proclamation 1321/2024 assessment</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="org-name">{t("orgName")} *</Label>
                <Input id="org-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-name-am">{t("orgNameAm")}</Label>
                <Input id="org-name-am" lang="am" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="org-sector">{t("orgSector")}</Label>
                  <select id="org-sector" className="border rounded-md h-9 px-2 bg-background text-sm"
                    value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                    {["Banking", "Microfinance", "Telecom", "SME", "Fintech", "Government", "NGO", "Other"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="org-tier">{t("orgTier")}</Label>
                  <select id="org-tier" className="border rounded-md h-9 px-2 bg-background text-sm"
                    value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                    {["enterprise", "mid-market", "sme"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-email">{t("orgEmail")}</Label>
                <Input id="org-email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-notes">Notes</Label>
                <Textarea id="org-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={submit} className="bg-emerald-700 hover:bg-emerald-800 text-white">{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {!orgs && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orgs?.map((o) => (
          <Card key={o.id} className="flex flex-col">
            <CardContent className="p-5 flex flex-col gap-4 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{o.name}</p>
                    <p className="text-xs text-muted-foreground" lang="am">{o.nameAm || "—"}</p>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">{o.sector}</Badge>
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs">{t("latestScan")}</p>
                  {o.latestScan && o.latestScan.status === "complete" ? (
                    <>
                      <p className="font-medium">{o.latestScan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(o.latestScan.completedAt)} · {o.latestScan.findingsCount} {t("findings").toLowerCase()}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t("noScans")}</p>
                  )}
                </div>
                {o.latestScan?.overallScore != null ? (
                  <ScoreRing score={o.latestScan.overallScore} size={76} />
                ) : (
                  <span className="text-3xl text-muted-foreground font-light">—</span>
                )}
              </div>

              <Button
                onClick={() => onNewScan(o.id)}
                variant="outline"
                className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
              >
                <ScanLine className="h-4 w-4" aria-hidden /> {t("newScan")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
