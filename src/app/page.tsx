"use client";

import React, { useState } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  Moon, Sun, ShieldCheck, LayoutDashboard, ScrollText, Building2, ScanLine, Flag,
  FileText, Languages, Users, LogOut, KeyRound, ChevronUp, FolderLock, Radar, GraduationCap, ShieldAlert, Crosshair, Cable,
} from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { DashboardView } from "@/components/adwa/dashboard";
import { CatalogueView } from "@/components/adwa/catalogue";
import { OrganizationsView } from "@/components/adwa/organizations";
import { ScanWizard } from "@/components/adwa/scan-wizard";
import { FindingsView } from "@/components/adwa/findings";
import { ExecutiveReport } from "@/components/adwa/executive-report";
import { EvidenceView } from "@/components/adwa/evidence-view";
import { SocView } from "@/components/adwa/soc";
import { AwarenessView } from "@/components/adwa/awareness";
import { TrackCView } from "@/components/adwa/track-c";
import { VaptView } from "@/components/adwa/vapt";
import { CyberCanvas } from "@/components/adwa/cyber-canvas";
import { TipTicker } from "@/components/adwa/tip-ticker";
import { tabTheme } from "@/lib/tab-theme";
import { AuthGate, useAuth } from "@/components/auth/auth-gate";
import { MfaSetupDialog, MfaBadge } from "@/components/auth/mfa-setup";
import { UsersView } from "@/components/auth/users-view";
import { AuditView } from "@/components/auth/audit-view";
import { SystemBindingsView } from "@/components/adwa/system-bindings";
import { ROLE_COLORS, ROLE_SHORT } from "@/lib/auth-client";

type View = "dashboard" | "catalogue" | "organizations" | "scan" | "findings" | "evidence" | "report" | "soc" | "vapt" | "awareness" | "trackc" | "team" | "audit" | "system";

/** Module masthead — the per-tab hero banner. Visual identity (colour + icon +
 *  tagline) is derived from the module's mission, cf. tab-theme.ts. */
function ViewHero({ view, icon: Icon }: { view: View; icon: React.ElementType }) {
  const { t } = useI18n();
  const th = tabTheme(view);
  return (
    <div
      className="hero-strip mb-4 px-4 py-4 text-white sm:mb-6 sm:px-6 sm:py-5"
      style={{
        background: `linear-gradient(105deg, ${th.accentDeep} 0%, ${th.accent} 52%, ${th.accentSoft}cc 100%)`,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">{t(th.titleKey)}</h1>
            {th.liveChip && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {th.liveChip}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 max-w-3xl text-xs text-white/85 sm:text-sm">{t(th.subKey)}</p>
        </div>
        <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-white/90 uppercase backdrop-blur-sm md:inline-flex">
          {th.chip}
        </span>
      </div>
    </div>
  );
}

function Shell() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { me, refreshMe, logout } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [reportScanId, setReportScanId] = useState<string | null>(null);
  const [scanOrgId, setScanOrgId] = useState<string | null>(null);
  const [resumeScanId, setResumeScanId] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [mfaOpen, setMfaOpen] = useState(false);

  const perms = new Set(me.permissions);
  const isSuper = me.user.role === "SUPER_ADMIN";
  const canManageUsers = perms.has("users:manage-org") || perms.has("users:manage-all");
  const canSeeAudit = perms.has("audit:view-org") || perms.has("audit:view-all");

  const nav: { id: View; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "dashboard", label: t("navDashboard"), icon: LayoutDashboard, show: true },
    { id: "catalogue", label: t("navCatalogue"), icon: ScrollText, show: perms.has("catalogue:view") },
    { id: "organizations", label: t("navOrganizations"), icon: Building2, show: perms.has("org:view-own") || isSuper },
    { id: "scan", label: t("navScans"), icon: ScanLine, show: perms.has("scans:view-org") || perms.has("scans:view-all") },
    { id: "findings", label: t("navFindings"), icon: Flag, show: perms.has("findings:view-org") || perms.has("findings:view-all") },
    { id: "evidence", label: t("navEvidence"), icon: FolderLock, show: perms.has("evidence:view-org") || perms.has("evidence:view-all") },
    { id: "soc", label: t("navSoc"), icon: Radar, show: perms.has("soc:view-org") || perms.has("soc:view-all") },
    { id: "vapt", label: t("navVapt"), icon: Crosshair, show: perms.has("vapt:view-org") || perms.has("vapt:view-all") },
    { id: "awareness", label: t("navAwareness"), icon: GraduationCap, show: perms.has("awareness:manage") },
    { id: "trackc", label: t("navTrackC"), icon: ShieldAlert, show: perms.has("governance:view") },
    { id: "report", label: t("navReport"), icon: FileText, show: perms.has("scans:view-org") || perms.has("scans:view-all") },
    { id: "team", label: t("team"), icon: Users, show: perms.has("users:view-org") || perms.has("users:view-all") },
    { id: "audit", label: t("auditLog"), icon: KeyRound, show: canSeeAudit },
    { id: "system", label: t("navSystem"), icon: Cable, show: isSuper },
  ];

  const go = (v: View) => {
    setView(v);
    if (v !== "scan") setResumeScanId(null); // leaving the wizard clears any resume target
  };
  const initials = me.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const th = tabTheme(view);
  const activeNav = nav.find((n) => n.id === view);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full">
        {/* Sidebar */}
        <Sidebar className="border-r border-emerald-100 dark:border-emerald-950">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md"
                style={{ background: "linear-gradient(135deg, #059669, #065f46)" }}
                aria-hidden
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold leading-tight">{t("appName")}</p>
                <p className="text-xs text-muted-foreground">{t("appSub")}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.filter((n) => n.show).map((item) => {
                    const it = tabTheme(item.id);
                    const active = view === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => {
                            if (item.id === "scan") setResumeScanId(null); // sidebar entry always starts fresh
                            go(item.id);
                          }}
                          className={active ? "nav-active-btn" : ""}
                          style={active ? { background: `linear-gradient(135deg, ${it.accent}, ${it.accentDeep})` } : undefined}
                        >
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 text-left transition-colors hover:bg-emerald-100/70 dark:border-emerald-950 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60"
                  aria-label={t("security")}
                >
                  <Avatar className="h-9 w-9 border border-emerald-200 dark:border-emerald-800">
                    <AvatarFallback className="bg-emerald-700 text-xs font-semibold text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{me.user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {me.user.orgName ?? t("platform")}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-64">
                <DropdownMenuLabel className="space-y-1.5">
                  <p className="truncate text-sm font-semibold">{me.user.email}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={`${ROLE_COLORS[me.user.role] ?? ""} text-[11px]`}>
                      {ROLE_SHORT[me.user.role] ?? me.user.role}
                    </Badge>
                    <MfaBadge enabled={me.user.mfaEnabled} />
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMfaOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                  {t("security")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {t("phase1Badge")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Bahir Dar, Ethiopia</p>
          </SidebarFooter>
        </Sidebar>

        {/* Main — relative container for the 3D ops background */}
        <main className="relative flex-1 flex flex-col min-w-0">
          {/* Ambient 3D cyber-ops background (globe + threat arcs), tinted by
              the active module's accent. Decorative only: aria-hidden,
              pointer-events-none, reduced-motion aware. */}
          <CyberCanvas accent={th.accent} />

          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-12 items-center gap-3 px-4">
              <SidebarTrigger className="md:hidden" aria-label="Toggle menu" />
              <span className="text-sm font-medium text-muted-foreground hidden sm:block">
                {t("appName")} — {me.user.orgName ?? t("platform")}
              </span>
              <Badge className={`${ROLE_COLORS[me.user.role] ?? ""} hidden sm:inline-flex`}>
                {ROLE_SHORT[me.user.role] ?? me.user.role}
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLang(lang === "en" ? "am" : "en")}
                  aria-label={t("language")}
                  className="gap-1.5"
                >
                  <Languages className="h-4 w-4" aria-hidden />
                  <span className="text-sm font-semibold">{lang === "en" ? "አማ" : "EN"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden />
                </Button>
              </div>
            </div>
            {/* Real-world security intel ribbon — published, verifiable facts
                (NIST CSF 2.0, CIS v8, OWASP, CISA KEV, FIRST EPSS, DBIR…). */}
            <TipTicker accent={th.accent} />
          </header>

          {/* flex-auto (not flex-1): tall views must EXPAND this box so the
              footer sits below the content. flex-1 set flex-basis 0, which
              made overflowing tables paint over the pinned footer. */}
          <div className="flex-auto p-4 sm:p-6">
            <ViewHero view={view} icon={activeNav?.icon ?? LayoutDashboard} />
            {view === "dashboard" && (
              <DashboardView
                onOpenReport={(id) => { setReportScanId(id); go("report"); }}
                onResumeScan={(id) => { setScanOrgId(null); setResumeScanId(id); setScanKey((k) => k + 1); go("scan"); }}
                canRunScans={perms.has("scans:run-org") || perms.has("scans:run-any-org")}
              />
            )}
            {view === "catalogue" && <CatalogueView />}
            {view === "organizations" && (
              <OrganizationsView onNewScan={(orgId) => { setScanOrgId(orgId); setResumeScanId(null); setScanKey((k) => k + 1); go("scan"); }} />
            )}
            {view === "scan" && (
              <ScanWizard
                key={scanKey}
                preselectedOrgId={scanOrgId}
                resumeScanId={resumeScanId}
                onDone={(id) => { setReportScanId(id); go("report"); }}
              />
            )}
            {view === "findings" && <FindingsView />}
            {view === "evidence" && (
              <EvidenceView
                canUpload={perms.has("evidence:upload")}
                canManage={perms.has("evidence:manage-org") || perms.has("evidence:manage-all")}
                isSuperAdmin={isSuper}
              />
            )}
            {view === "report" && <ExecutiveReport scanId={reportScanId} />}
            {view === "soc" && (
              <SocView
                canManage={perms.has("soc:manage-org") || perms.has("soc:manage-all")}
                canSync={perms.has("threats:sync")}
                isSuperAdmin={isSuper}
              />
            )}
            {view === "vapt" && (
              <VaptView
                canManage={perms.has("vapt:manage-org") || perms.has("vapt:manage-all")}
                isSuperAdmin={isSuper}
              />
            )}
            {view === "awareness" && <AwarenessView />}
            {view === "trackc" && <TrackCView canManageCii={perms.has("cii:manage")} />}
            {view === "team" && <UsersView canManage={canManageUsers} isSuperAdmin={isSuper} />}
            {view === "audit" && <AuditView isSuperAdmin={isSuper} />}
            {view === "system" && <SystemBindingsView />}
          </div>

          <footer className="mt-auto border-t bg-background/80 backdrop-blur">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
              <p>© 2026 {t("appName")} — Adwa Cyber Research Lab</p>
              <p>Proclamation No. 1321/2024 · NCSP 2024 · Digital Ethiopia 2030</p>
            </div>
          </footer>
        </main>
      </div>

      <MfaSetupDialog
        open={mfaOpen}
        onClose={() => setMfaOpen(false)}
        mfaEnabled={me.user.mfaEnabled}
        onMfaChanged={async (enabled) => {
          // Disabling MFA revokes every session → the next /me is a 401.
          try {
            await refreshMe();
          } catch {
            await logout();
            return;
          }
          if (!enabled) {
            // Sessions were revoked server-side; this client is signed out.
            await logout();
          }
        }}
      />
    </SidebarProvider>
  );
}

export default function Page() {
  return (
    <I18nProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </I18nProvider>
  );
}
