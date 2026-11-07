"use client";

import React, { useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScrollText, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, KeyRound,
  LogIn, LogOut, UserPlus, Lock, RefreshCw, AlertTriangle, UploadCloud, Download,
  Pencil, Archive, ArchiveRestore, Trash2, ShieldOff, Link2, Unlink, Play, CheckCircle2, ListChecks,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/auth-client";

interface AuditRow {
  id: string; type: string; email: string; organizationId: string | null;
  ip: string | null; userAgent: string | null; detail: string | null; createdAt: string;
}

interface AuditResponse {
  events: AuditRow[]; page: number; pageSize: number; total: number; totalPages: number;
}

const EVENT_META: Record<string, { icon: React.ElementType; cls: string }> = {
  LOGIN_SUCCESS: { icon: LogIn, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  GOOGLE_LOGIN: { icon: LogIn, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  LOGIN_FAILED: { icon: ShieldX, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  LOGIN_LOCKED: { icon: Lock, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  ACCOUNT_LOCKED: { icon: Lock, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  MFA_CHALLENGE: { icon: KeyRound, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  MFA_PASSED: { icon: ShieldCheck, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  MFA_FAILED: { icon: KeyRound, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  MFA_ENROLLMENT_STARTED: { icon: KeyRound, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  MFA_ENABLED: { icon: ShieldCheck, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  MFA_DISABLED: { icon: AlertTriangle, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  CAPTCHA_FAILED: { icon: ShieldX, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  LOGOUT: { icon: LogOut, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  TOKEN_REFRESHED: { icon: RefreshCw, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  TOKEN_REUSE_DETECTED: { icon: AlertTriangle, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  SESSIONS_REVOKED: { icon: AlertTriangle, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  REGISTER_ORG: { icon: UserPlus, cls: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" },
  USER_CREATED: { icon: UserPlus, cls: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" },
  USER_UPDATED: { icon: UserPlus, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  USER_DISABLED: { icon: ShieldX, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  GOOGLE_LOGIN_FAILED: { icon: ShieldX, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  ACCESS_DENIED: { icon: ShieldX, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  EVIDENCE_UPLOADED: { icon: UploadCloud, cls: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" },
  EVIDENCE_DOWNLOAD: { icon: Download, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  EVIDENCE_UPDATED: { icon: Pencil, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  EVIDENCE_ARCHIVED: { icon: Archive, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  EVIDENCE_RESTORED: { icon: ArchiveRestore, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  EVIDENCE_DELETED: { icon: Trash2, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  EVIDENCE_REJECTED: { icon: ShieldOff, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  EVIDENCE_INTEGRITY_WARNING: { icon: AlertTriangle, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  EVIDENCE_LINKED: { icon: Link2, cls: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" },
  EVIDENCE_UNLINKED: { icon: Unlink, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
  EVIDENCE_AUTO_LINKED: { icon: Link2, cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  SCAN_STARTED: { icon: Play, cls: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" },
  SCAN_COMPLETED: { icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  SCAN_DELETED: { icon: Trash2, cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  FINDING_STATUS_CHANGED: { icon: ListChecks, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" },
};

const TYPE_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: "Sign-in succeeded", LOGIN_FAILED: "Sign-in failed", LOGIN_LOCKED: "Sign-in blocked (lock)",
  ACCOUNT_LOCKED: "Account locked", MFA_CHALLENGE: "MFA challenge issued", MFA_PASSED: "MFA verified",
  MFA_FAILED: "MFA failed", MFA_ENROLLMENT_STARTED: "MFA enrollment started", MFA_ENABLED: "MFA enabled",
  MFA_DISABLED: "MFA disabled", CAPTCHA_FAILED: "Captcha failed", LOGOUT: "Signed out",
  TOKEN_REFRESHED: "Session refreshed", TOKEN_REUSE_DETECTED: "Token reuse — sessions revoked",
  SESSIONS_REVOKED: "All sessions revoked", REGISTER_ORG: "Organization onboarded",
  USER_CREATED: "User created", USER_UPDATED: "User updated", USER_DISABLED: "User disabled",
  GOOGLE_LOGIN: "Google sign-in", GOOGLE_LOGIN_FAILED: "Google sign-in failed", ACCESS_DENIED: "Access denied",
  EVIDENCE_UPLOADED: "Evidence uploaded", EVIDENCE_DOWNLOAD: "Evidence downloaded",
  EVIDENCE_UPDATED: "Evidence updated", EVIDENCE_ARCHIVED: "Evidence archived",
  EVIDENCE_RESTORED: "Evidence restored", EVIDENCE_DELETED: "Evidence deleted",
  EVIDENCE_REJECTED: "Evidence upload rejected", EVIDENCE_INTEGRITY_WARNING: "Evidence integrity warning",
  EVIDENCE_LINKED: "Evidence linked to obligation", EVIDENCE_UNLINKED: "Evidence unlinked",
  EVIDENCE_AUTO_LINKED: "Evidence auto-linked from tag",
  SCAN_STARTED: "Assessment started", SCAN_COMPLETED: "Assessment completed",
  SCAN_DELETED: "Assessment deleted", FINDING_STATUS_CHANGED: "Finding status changed",
};

export function AuditView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AuditResponse>(`/api/auth/audit?page=${page}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Failed to load audit trail."); });
    return () => { cancelled = true; };
  }, [page]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "am-ET", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-emerald-700 dark:text-emerald-500" aria-hidden />
          {t("auditLog")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auditSub")}{isSuperAdmin ? ` — ${t("platform")} (${t("crossTenant")})` : ""}
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-950 dark:bg-background">
            <div className="max-h-[62vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/40">
                    <TableHead>{t("event")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("when")}</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("detail")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">—</TableCell></TableRow>
                  )}
                  {data.events.map((e) => {
                    const meta = EVENT_META[e.type] ?? { icon: ScrollText, cls: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700" };
                    const Icon = meta.icon;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Badge className={`${meta.cls} whitespace-nowrap`}>
                            <Icon className="mr-1 h-3 w-3" aria-hidden />
                            {TYPE_LABEL[e.type] ?? e.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{e.email}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">{fmt(e.createdAt)}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{e.ip ?? "—"}</TableCell>
                        <TableCell className="hidden max-w-[280px] truncate text-sm text-muted-foreground xl:table-cell" title={e.detail ?? undefined}>{e.detail ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.total} · {t("page")} {data.page}/{data.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
