"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, UserPlus, MoreHorizontal, Loader2, ShieldCheck, ShieldOff, KeyRound,
  Building2, ShieldAlert, CheckCircle2, XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError, ROLE_COLORS, ROLE_SHORT } from "@/lib/auth-client";
import { MfaBadge } from "./mfa-setup";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: string; email: string; name: string; role: string; status: string;
  mfaEnabled: boolean; authProvider: string; organizationId: string | null;
  orgName: string | null; lastLoginAt: string | null; createdAt: string; isSelf: boolean;
}

interface UsersResponse { users: UserRow[]; assignableRoles: string[] }

interface OrgOption { id: string; name: string }

export function UsersView({ canManage, isSuperAdmin }: { canManage: boolean; isSuperAdmin: boolean }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add-user form
  const [nuName, setNuName] = useState("");
  const [nuEmail, setNuEmail] = useState("");
  const [nuRole, setNuRole] = useState("VIEWER");
  const [nuPassword, setNuPassword] = useState("");
  const [nuOrg, setNuOrg] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<UsersResponse>("/api/auth/users");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Failed to load users.");
    }
  }, []);

  useEffect(() => {
    load();
    if (isSuperAdmin) {
      api<{ organizations: OrgOption[] }>("/api/organizations")
        .then((r) => setOrgs(r.organizations))
        .catch(() => undefined);
    }
  }, [load, isSuperAdmin]);

  const patchUser = async (id: string, patch: Record<string, unknown>, successMsg: string) => {
    setBusyId(id);
    try {
      await api(`/api/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      toast({ title: successMsg });
      await load();
    } catch (err) {
      toast({
        title: lang === "en" ? "Update failed" : "ማዘመን አልተሳካም",
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setFieldErrors({});
    try {
      await api("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({
          name: nuName, email: nuEmail, role: nuRole, password: nuPassword,
          organizationId: isSuperAdmin ? nuOrg || undefined : undefined,
        }),
      });
      toast({ title: `${nuName} — ${t("addUser")} ✓` });
      setAddOpen(false);
      setNuName(""); setNuEmail(""); setNuRole("VIEWER"); setNuPassword(""); setNuOrg("");
      await load();
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else setError("Network error.");
    } finally {
      setAdding(false);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "am-ET", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : t("never");

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-emerald-700 dark:text-emerald-500" aria-hidden />
            {t("team")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("teamSub")}</p>
        </div>
        {canManage && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t("addUser")}
          </Button>
        )}
      </header>

      {error && !data && <p className="text-sm text-red-600">{error}</p>}

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-950 dark:bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/40">
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("security")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("lastLogin")}</TableHead>
                {isSuperAdmin && <TableHead className="hidden xl:table-cell">{t("org")}</TableHead>}
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">—</TableCell>
                </TableRow>
              )}
              {data.users.map((u) => (
                <TableRow key={u.id} className={busyId === u.id ? "opacity-50" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
                        {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name} {u.isSelf && <span className="text-xs text-muted-foreground">({t("you")})</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage && !u.isSelf && data.assignableRoles.includes(u.role) ? (
                      <Select value={u.role} onValueChange={(v) => patchUser(u.id, { role: v }, `${u.name}: ${v}`)} disabled={busyId === u.id}>
                        <SelectTrigger className="h-8 w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {data.assignableRoles.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_SHORT[r] ?? r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`${ROLE_COLORS[u.role] ?? ""} whitespace-nowrap`}>
                        {ROLE_SHORT[u.role] ?? u.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.status === "ACTIVE" ? (
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />{t("active")}
                      </Badge>
                    ) : (
                      <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" aria-hidden />{t("disabled")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><MfaBadge enabled={u.mfaEnabled} /></TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">{fmtDate(u.lastLoginAt)}</TableCell>
                  {isSuperAdmin && <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{u.orgName ?? <Badge variant="outline">{t("platform")}</Badge>}</TableCell>}
                  {canManage && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busyId === u.id || u.isSelf} aria-label={`${t("role")} ${u.name}`}>
                            {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{u.name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {u.status === "ACTIVE" ? (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { status: "DISABLED" }, `${u.name}: ${t("disabled")}`)}>
                              <ShieldOff className="mr-2 h-4 w-4" aria-hidden />{t("disabled")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { status: "ACTIVE" }, `${u.name}: ${t("active")}`)}>
                              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />{t("active")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              const pw = window.prompt(lang === "en"
                                ? `New password for ${u.email} (min 10 chars, letters + numbers):`
                                : `ለ${u.email} አዲስ የመግቢያ ቃል (ቢያንስ 10):`);
                              if (pw) patchUser(u.id, { password: pw }, `${t("resetPassword")} — ${u.email}`);
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" aria-hidden />{t("resetPassword")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Add user dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
              {t("addUser")}
            </DialogTitle>
            <DialogDescription>{t("teamSub")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={addUser} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nu-name">{t("adminName")}</Label>
              <Input id="nu-name" value={nuName} onChange={(e) => setNuName(e.target.value)} required disabled={adding} />
              {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-email">{t("adminEmail")}</Label>
              <Input id="nu-email" type="email" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} required disabled={adding} />
              {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("role")}</Label>
                <Select value={nuRole} onValueChange={setNuRole} disabled={adding}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(data?.assignableRoles ?? []).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_SHORT[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.role && <p className="text-xs text-red-600">{fieldErrors.role}</p>}
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>{t("org")}</Label>
                  <Select value={nuOrg} onValueChange={setNuOrg} disabled={adding}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platform">{t("platform")} (Super Admin)</SelectItem>
                      {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {fieldErrors.organizationId && <p className="text-xs text-red-600">{fieldErrors.organizationId}</p>}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-pw">{t("choosePassword")}</Label>
              <Input id="nu-pw" type="text" value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} required disabled={adding}
                placeholder="Temp#Pass2026" />
              {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
            </div>
            <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={adding}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Building2 className="mr-2 h-4 w-4" aria-hidden />}
              {t("addUser")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
