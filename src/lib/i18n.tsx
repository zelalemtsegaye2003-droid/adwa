"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";

export type Lang = "en" | "am";

const DICT: Record<string, [string, string]> = {
  // Shell / nav
  appName: ["Adwa Cyber", "አድዋ ሳይበር"],
  appSub: ["Compliance Platform", "የቅጥ ሥርዓት"],
  phase1Badge: ["Phase 1 MVP — Proclamation 1321/2024", "ዙር 1 — አዋጅ 1321/2024"],
  navDashboard: ["Dashboard", "ዳሽቦርድ"],
  navCatalogue: ["Rule Catalogue", "የደንቦች ማህደር"],
  navOrganizations: ["Organizations", "ተቋማት"],
  navScans: ["Compliance Scans", "የቅጥ ፍተሻዎች"],
  navFindings: ["Findings", "ግኝቶች"],
  navReport: ["Executive Report", "የአመራር ሪፖርት"],
  language: ["Language", "ቋንቋ"],
  // Dashboard
  dashTitle: ["Compliance Posture Overview", "የቅጥ ሁኔታ አጠቃላይ እይታ"],
  dashSub: ["Live posture across monitored organizations", "የተቆጣጠሩት ተቋማት የአሁኑ ሁኔታ"],
  avgScore: ["Average compliance score", "አማካይ የቅጥ ውጤት"],
  orgsMonitored: ["Organizations monitored", "የሚቆጣጠሩ ተቋማት"],
  rulesEnforced: ["Rules enforced", "የሚተገበሩ ደንቦች"],
  auditDuration: ["Avg. automated audit", "አማካይ ራስ-ሰር ፍተሻ"],
  vsManual: ["vs 40–80 hrs manual (RQ1 target: >70% reduction)", "ከ40–80 ሰዓት በእጅ ፍተሻ ፈንታ (ግብ በRQ1)"],
  pillarPerf: ["Pillar performance (4 weighted pillars)", "የምሰሶዎች አፈጻጸም"],
  findingsSeverity: ["Findings by severity", "ግኝቶች በአደጋ ደረጃ"],
  articleRisk: ["Article risk heatmap — rules flagged", "በአንቀጽ የአደጋ ካርታ"],
  recentScans: ["Recent scans", "የቅርብ ፍተሻዎች"],
  // Catalogue
  catTitle: ["Rule Catalogue v1.0", "የደንቦች ማህደር v1.0"],
  catSub: ["47 obligations of Proclamation No. 1321/2024, machine-readable", "47 ግዴታዎች በአዋጅ 1321/2024"],
  searchPlaceholder: ["Search rules, articles, keywords…", "ደንቦችን ይፈልጉ…"],
  allArticles: ["All articles", "ሁሉም አንቀጾች"],
  allPillars: ["All pillars", "ሁሉም ምሰሶዎች"],
  allSeverities: ["All severities", "ሁሉም ደረጃዎች"],
  checkLogic: ["Automated check", "ራስ-ሰር ፍተሻ"],
  penalty: ["Penalty", "ቅጣት"],
  weight: ["Weight", "ክብደት"],
  priority: ["Priority", "ቅድሚያ"],
  // Organizations
  orgTitle: ["Organizations", "ተቋማት"],
  orgSub: ["Pilot and monitored organizations", "የሙከራ እና የሚቆጣጠሩ ተቋማት"],
  addOrg: ["Add organization", "ተቋም ያክሉ"],
  orgName: ["Name", "ስም"],
  orgNameAm: ["Name (Amharic)", "ስም (በአማርኛ)"],
  orgSector: ["Sector", "ዘርፍ"],
  orgTier: ["Tier", "ደረጃ"],
  orgEmail: ["Contact email", "የመገናኛ ኢሜይል"],
  latestScan: ["Latest scan", "የቅርብ ፍተሻ"],
  noScans: ["No scans yet", "እስካሁን ፍተሻ የለም"],
  newScan: ["New scan", "አዲስ ፍተሻ"],
  // Scan wizard
  scanTitle: ["Compliance Scan", "የቅጥ ፍተሻ"],
  scanSub: ["Evidence-based audit across all 47 rules", "በ47ው ደንብ ላይ የሰረት ፍተሻ"],
  step1: ["Select organization", "ተቋም ይምረጡ"],
  step2: ["Collect evidence", "ማስረጃ ይሰብስቡ"],
  step3: ["Engine results", "የሞተር ውጤት"],
  scanName: ["Scan name", "የፍተሻ ስም"],
  startScan: ["Start scan", "ፍተሻ ይጀምሩ"],
  runEngine: ["Run compliance engine", "የቅጥ ሞተሩን ያሂዱ"],
  running: ["Evaluating…", "በሂደት ላይ…"],
  answerYes: ["Compliant", "ተሟልቷል"],
  answerPartial: ["Partial", "በከፊል"],
  answerNo: ["Non-compliant", "አልተሟለም"],
  answerNa: ["N/A", "ማመልከቻ የለውም"],
  evidenceNote: ["Evidence note (optional)", "የማስረጃ ማስታወሻ (አማራጭ)"],
  answered: ["answered", "የተመለሱ"],
  overallScore: ["Overall compliance score", "አጠቃላይ የቅጥ ውጤት"],
  remediationPlan: ["Smart remediation plan (risk-ranked)", "የማስተካከያ ዕቅድ (በአደጋ ተራ)"],
  timeComparison: ["Audit time — RQ1", "የፍተሻ ጊዜ — RQ1"],
  // Findings
  findTitle: ["Findings & Remediation", "ግኝቶች እና ማስተካከያ"],
  findSub: ["Track remediation across all completed scans", "ማስተካከያዎችን በሁሉም ፍተሻዎች ይከታተሉ"],
  status: ["Status", "ሁኔታ"],
  stOpen: ["Open", "ክፍት"],
  stProgress: ["In progress", "በሂደት"],
  stRemediated: ["Remediated", "ተስተካክሏል"],
  stWaived: ["Waived", "ተተው"],
  allStatuses: ["All statuses", "ሁሉም ሁኔታዎች"],
  allScans: ["All scans", "ሁሉም ፍተሻዎች"],
  rule: ["Rule", "ደንብ"],
  org: ["Organization", "ተቋም"],
  risk: ["Risk", "አደጋ"],
  // Report
  repTitle: ["Executive Report", "ለአመራሮች ሪፖርት"],
  repSub: ["Board-ready summary of a completed scan", "ለቦርድ የተዘጋጀ ማጠቃለያ"],
  print: ["Print / PDF", "አትሚ / PDF"],
  auditor: ["Audited by", "መርሚያ"],
  completedOn: ["Completed", "የተጠናቀቀው"],
  findingsSummary: ["Findings summary", "የግኝቶች ማጠቃለያ"],
  topRemediation: ["Top 10 remediation priorities", "ምርጥ 10 ማስተካከያ ቅድሚያዎች"],
  noData: ["No completed scans yet — run a scan first.", "የተጠናቀቀ ፍተሻ የለም — መጀመሪያ ፍተሻ ያካሂዱ።"],
  // Misc
  critical: ["Critical", "ወሳኝ"],
  high: ["High", "ከፍተኛ"],
  medium: ["Medium", "መካከለኛ"],
  legal: ["Legal", "ሕጋዊ"],
  technical: ["Technical", "ቴክኒካል"],
  organisational: ["Organisational", "ድርጅታዊ"],
  awareness: ["Awareness", "ግንዛቤ"],
  loading: ["Loading…", "በመጫን ላይ…"],
  save: ["Save", "አስቀምጥ"],
  cancel: ["Cancel", "ተው"],
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT | string) => string;
  pick: (en: string, am: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

// External store for the persisted language choice (localStorage).
const langListeners = new Set<() => void>();
function subscribeLang(l: () => void) {
  langListeners.add(l);
  return () => { langListeners.delete(l); };
}
function getLangSnapshot(): Lang {
  try {
    return typeof window !== "undefined" && localStorage.getItem("adwa-lang") === "am" ? "am" : "en";
  } catch {
    return "en";
  }
}
const getServerLangSnapshot = (): Lang => "en";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLangSnapshot);

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem("adwa-lang", l);
    } catch {}
    for (const fn of langListeners) fn();
  };

  const t = (key: string) => {
    const e = DICT[key];
    if (!e) return key;
    return lang === "en" ? e[0] : e[1];
  };
  const pick = (en: string, am: string) => (lang === "en" ? en : am);

  return <Ctx.Provider value={{ lang, setLang, t, pick }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
