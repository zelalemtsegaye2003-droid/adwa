"use client";

import React, { useState } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, ShieldCheck, LayoutDashboard, ScrollText, Building2, ScanLine, Flag, FileText, Languages } from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { DashboardView } from "@/components/adwa/dashboard";
import { CatalogueView } from "@/components/adwa/catalogue";
import { OrganizationsView } from "@/components/adwa/organizations";
import { ScanWizard } from "@/components/adwa/scan-wizard";
import { FindingsView } from "@/components/adwa/findings";
import { ExecutiveReport } from "@/components/adwa/executive-report";

type View = "dashboard" | "catalogue" | "organizations" | "scan" | "findings" | "report";

function Shell() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<View>("dashboard");
  const [reportScanId, setReportScanId] = useState<string | null>(null);
  const [scanOrgId, setScanOrgId] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const nav: { id: View; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: t("navDashboard"), icon: LayoutDashboard },
    { id: "catalogue", label: t("navCatalogue"), icon: ScrollText },
    { id: "organizations", label: t("navOrganizations"), icon: Building2 },
    { id: "scan", label: t("navScans"), icon: ScanLine },
    { id: "findings", label: t("navFindings"), icon: Flag },
    { id: "report", label: t("navReport"), icon: FileText },
  ];

  const go = (v: View) => { setView(v); };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <Sidebar className="border-r border-emerald-100 dark:border-emerald-950">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm" aria-hidden>
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
                  {nav.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={view === item.id}
                        onClick={() => go(item.id)}
                        className={view === item.id ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}
                      >
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("phase1Badge")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Bahir Dar, Ethiopia</p>
          </SidebarFooter>
        </Sidebar>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-14 items-center gap-3 px-4">
              <SidebarTrigger className="md:hidden" aria-label="Toggle menu" />
              <span className="text-sm font-medium text-muted-foreground hidden sm:block">{t("appName")} — {t("appSub")}</span>
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
          </header>

          <div className="flex-1 p-4 sm:p-6">
            {view === "dashboard" && (
              <DashboardView onOpenReport={(id) => { setReportScanId(id); go("report"); }} />
            )}
            {view === "catalogue" && <CatalogueView />}
            {view === "organizations" && (
              <OrganizationsView onNewScan={(orgId) => { setScanOrgId(orgId); setScanKey((k) => k + 1); go("scan"); }} />
            )}
            {view === "scan" && (
              <ScanWizard
                key={scanKey}
                preselectedOrgId={scanOrgId}
                onDone={(id) => { setReportScanId(id); go("report"); }}
              />
            )}
            {view === "findings" && <FindingsView />}
            {view === "report" && <ExecutiveReport scanId={reportScanId} />}
          </div>

          <footer className="mt-auto border-t">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
              <p>© 2026 {t("appName")} — Adwa Cyber Research Lab</p>
              <p>Proclamation No. 1321/2024 · NCSP 2024 · Digital Ethiopia 2030</p>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Page() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
