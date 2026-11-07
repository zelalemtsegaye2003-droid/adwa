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
  // Scan lifecycle (drafts, resume, abandon)
  autoSaving: ["Saving…", "በማስቀመጥ ላይ…"],
  autoSaved: ["Draft saved", "ረቂቅ ተቀምጧል"],
  autoSaveOff: ["Autosave", "በራስ-ማስቀመጥ"],
  discardScan: ["Discard draft", "ረቂቁን ይጥሉ"],
  discardConfirm: ["Discard this draft assessment? All saved answers will be permanently deleted.", "ይህን ረቂቅ ግምገማ ይጥላሉ? የተቀመጡ መልሶች ሁሉ በቋሚነት ይጠፋሉ።"],
  resumeScan: ["Continue", "ቀጥል"],
  inProgressScans: ["In-progress assessments", "በሂደት ላይ ያሉ ግምገማዎች"],
  startedOn: ["Started", "የተጀመረው"],
  resumedDraft: ["Resumed saved draft — answers restored", "የተቀመጠ ረቂቅ ተመልሷል — መልሶች ተመልሰዋል"],
  completedRecord: ["This assessment is already complete.", "ይህ ግምገማ ተጠናቋል።"],
  // Findings — waiver justification
  waiveTitle: ["Waiver justification", "የውልቀት ማብራሪያ"],
  waiveDesc: ["Record why this finding is waived. The justification is written to the audit trail.", "ይህ ግኝት ለምን እንደተወገደ ይመዝጉ። ማብራሪያው ወደ ኦዲት ምዝገባ ይጻፋል።"],
  waiveLabel: ["Justification (required)", "ማብራሪያ (ያስፈልጋል)"],
  waivePh: ["e.g. Risk accepted by CISO until the Q3 budget cycle", "ለምሳሌ፡ እስከ ሦስተኛ ኩዋርተር በጀት ስጋቱ በCISO ተቀብሏል"],
  noteRequired: ["A waiver requires a justification note.", "ውልቀት ማብራሪያ ማስገባት አለብዎት።"],
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
  repDownloadPdf: ["Download PDF", "PDF አውርድ"],
  repPdfReady: ["Report PDF downloaded", "የሪፖርቱ PDF ተውሯል"],
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
  governance: ["Governance", "የአስተዳደር ሥርዓት"],
  automation: ["Automation", "ራስ-ሰርነት"],
  riskMgmt: ["Risk Management", "የስጋት አስተዳደር"],
  cyberSec: ["Cyber Security", "የሳይበር ደህንነት"],
  continuity: ["Continuity", "ቀጣይነትና መልሶ ማቋቋም"],
  loading: ["Loading…", "በመጫን ላይ…"],
  save: ["Save", "አስቀምጥ"],
  cancel: ["Cancel", "ተው"],
  // ── Frameworks ──────────────────────────────────────────────────────────
  framework: ["Framework", "ማዕቀፍ"],
  frameworks: ["Regulatory frameworks", "የሕግ ማዕቀፎች"],
  obligations: ["obligations", "ግዴታዎች"],
  issuer: ["Issuer", "አውጪ"],
  instrument: ["Instrument", "መሣሪያ"],
  selectFramework: ["Regulatory framework", "የሕግ ማዕቀፍ"],
  frameworkDesc: ["Select the regulatory instrument to assess against", "የሚገመገምበትን የሕግ መሣሪያ ይምረጡ"],
  avgScoreFw: ["Average score", "አማካይ ውጤት"],
  noScansYet: ["No scans yet", "እስካሁን ፍተሻ የለም"],
  // ── Auth ────────────────────────────────────────────────────────────────
  signIn: ["Sign in", "ግባ"],
  signOut: ["Sign out", "ውጣ"],
  signInTitle: ["Welcome back", "እንኳን ደህና መጡ"],
  signInSub: ["Sign in to your compliance workspace", "የቅጥ ሥራዎን ለመግባት ይግቡ"],
  email: ["Email", "ኢሜይል"],
  password: ["Password", "የመግቢያ ቃል"],
  captchaLabel: ["Security check", "የደህንነት ማረጓጊያ"],
  captchaPlaceholder: ["Type the characters", "ፊደላቱን ይጻፉ"],
  captchaRefresh: ["New challenge", "አዲስ ጥያቄ"],
  continueWithGoogle: ["Continue with Google", "በGoogle ይቀጥሉ"],
  googleNotConfigured: ["Google Sign-In is ready — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to activate.", "Google መግባት ተዘጋጅቷል — ለማንቃት GOOGLE_CLIENT_ID እና GOOGLE_CLIENT_SECRET ይጨምሩ።"],
  orEmail: ["or sign in with email", "ወይም በኢሜይል ይግቡ"],
  mfaTitle: ["Two-factor verification", "የሁለት-ደረጃ ማረጓጊያ"],
  mfaSub: ["Enter the 6-digit code from your authenticator app", "ከመተግበሪያዎ የ6-አሃዝ ኮድ ያስገቡ"],
  mfaVerify: ["Verify", "አረጋግጥ"],
  mfaBackupHint: ["Lost your device? Enter one of your backup codes instead.", "መሣሪያዎ ጠፍቷል? የኋላውን ኮድ ያስገቡ።"],
  backToLogin: ["Back to sign in", "ወደ መግቢያ ተመለስ"],
  demoAccounts: ["Demo accounts", "የሙከራ መለያዎች"],
  demoSub: ["Seeded for the pilot — password for all org accounts", "ለሙከራ ታስቀምጠዋል — የሁሉም መለያ የመግቢያ ቃል"],
  createOrgTitle: ["Create organization account", "የተቋም መለያ ይፍጠሩ"],
  createOrgSub: ["Onboard your organization and become its admin", "ተቋምዎን ያስገቡ አስተዳዳሪ ይሁኑ"],
  orgNameLabel: ["Organization name", "የተቋም ስም"],
  adminName: ["Your name", "የእርስዎ ስም"],
  adminEmail: ["Work email", "የሥራ ኢሜይል"],
  choosePassword: ["Password (min 10 chars, letters + numbers)", "የመግቢያ ቃል (ቢያንስ 10 ፊደል + ቁጥር)"],
  createAccount: ["Create account", "መለያ ይፍጠሩ"],
  authRequired: ["Authentication required", "ማረጓጊያ ያስፈልጋል"],
  security: ["Security", "ጥበቃ"],
  mfaSetupTitle: ["Protect your account", "መለያዎን ይጠብቁ"],
  mfaSetupSub: ["Scan with Google Authenticator, Authy or Aegis", "በGoogle Authenticator፣ Authy ወይም Aegis ይስኮን"],
  mfaScanStep: ["1. Scan the QR code", "1. QR ኮዱን ይስኮን"],
  mfaManualStep: ["or enter this key manually", "ወይም ቁልፉን በእጅ ያስገቡ"],
  mfaConfirmStep: ["2. Confirm with the current code", "2. በአሁኑ ኮድ ያረጋግጡ"],
  mfaEnable: ["Activate MFA", "MFA ያንቁ"],
  mfaActive: ["MFA active", "MFA እስከአሁን"],
  mfaOff: ["MFA off", "MFA ዝግ"],
  backupCodes: ["Backup codes", "የኋላ ኮዶች"],
  backupCodesSub: ["Each code works once if you lose your device. Store them safely — shown only now.", "እያንዳንዱ ኮድ አንድ ጊዜ ይሠራል። በደህና ያስቀምጡዋቸው — አሁን ብቻ ይታያሉ።"],
  copyCodes: ["Copy codes", "ኮዶችን ቅዳ"],
  copied: ["Copied!", "ተቀድቷል!"],
  disableMfa: ["Disable MFA", "MFA ያጥፉ"],
  disableMfaConfirm: ["Confirm with password + current code", "በየመግቢያ ቃል + አሁኑ ኮድ ያረጋግጥ"],
  team: ["Team & Roles", "ቡድን እና ሚናዎች"],
  // ── Evidence Vault ──────────────────────────────────────────────────────
  navEvidence: ["Evidence Library", "የማስረጃ ማኅደር"],
  evTitle: ["Evidence Library", "የማስረጃ ማኅደር"],
  evSub: ["Compliance artefacts with SHA-256 integrity evidence", "የSHA-256 ትክክለኛነት ያላቸው የቅጥ ማስረጃዎች"],
  evReadOnly: ["Read-only access", "የመንበብ ብቻ"],
  evUpload: ["Upload evidence", "ማስረጃ ይስቀሉ"],
  evUploadSub: ["Files are checksummed and stored in the tenant vault", "ፋይሎች ኮድ ተደርገው በተቋሙ ማኅደር ይቀመጣሉ"],
  evUploadBtn: ["Store in vault", "በማኅደር አስቀምጥ"],
  evUploading: ["Uploading…", "በማስቀለት ላይ…"],
  evDropzone: ["Drag & drop a file here, or click to browse", "ፋይሉን እዚህ ይጎትኑ ወይም ጠቅ ያድርጉ"],
  evBrowse: ["Choose file", "ፋይል ይምረጡ"],
  evTypes: ["PDF · DOCX · XLSX · CSV · PNG · JPG · TXT · ZIP — max 10 MB", "PDF · DOCX · XLSX · CSV · PNG · JPG · TXT · ZIP — እስከ 10 MB"],
  evTitleLabel: ["Title", "ርዕስ"],
  evCategory: ["Category", "ምድብ"],
  evDescription: ["Description", "መግለጫ"],
  evTags: ["Tags", "መለያዎች"],
  evTagsHint: ["Comma-separated — link to rule codes or articles", "በነጠላ ሰረዝ — ከደንብ ኮዶች ጋር ያገናኙ"],
  evDocument: ["Document", "ሰነድ"],
  evVersion: ["Version", "እትም"],
  evSize: ["Size", "መጠን"],
  evUploadedBy: ["Uploaded by", "ያስቀመጠ"],
  evVerified: ["Last verified", "መጨረሻ የተረጋገጠው"],
  evNotVerified: ["Not verified yet", "እስካሁን አልተረጋገጠም"],
  evActiveDocs: ["Active documents", "ንቁ ሰነዶች"],
  evTotalDocs: ["total", "ጠቅላላ"],
  evStorage: ["Storage used", "የተያዘ ቦታ"],
  evChains: ["Version chains", "የእትም ሰንሰለቶች"],
  evDownloads: ["Downloads", "ማውረዶች"],
  evDownloadBtn: ["Download", "አውርድ"],
  evPreview: ["Preview", "ቅድመ እይታ"],
  evDetails: ["Details", "ዝርዝር"],
  evEditMetadata: ["Edit metadata", "መረጃ አስተካክል"],
  evArchive: ["Archive", "መዝግብ"],
  evRestore: ["Restore", "መልሶ አስቀምጥ"],
  evDelete: ["Delete", "ሰርዝ"],
  evDeleteConfirm: ["Delete this document?", "ይህ ሰነድ ይሰረዝ?"],
  evDeleteHint: ["Soft-delete: hidden from the library, file retained for forensic review.", "ከማኅደሩ ይሰወራል — ለፍርዳዊ ክለሳ ፋይሉ ተጠብቆ ይቀመጣል።"],
  evArchived: ["Archived", "ተመዝግቧል"],
  evSuperseded: ["Superseded", "ተተካቷል"],
  evAllStatuses: ["All statuses", "ሁሉም ሁኔታዎች"],
  evAllCategories: ["All categories", "ሁሉም ምድቦች"],
  evAllOrgs: ["All organizations", "ሁሉም ተቋማት"],
  evSearch: ["Search documents…", "ሰነዶችን ይፈልጉ…"],
  // ── Rules Engine (evidence ↔ obligation coverage) ──────────────────────
  evCoverage: ["Evidence coverage", "የማስረጃ ሽፋን"],
  evSatisfiedShort: ["satisfied", "የተሟሉ"],
  evStaleShort: ["stale", "አረመን"],
  evGapShort: ["gaps", "ክፍተቶች"],
  evSatisfiedFull: ["Fresh evidence on file for this obligation", "ለዚህ ግዴታ ትኩስ ማስረጃ አለ"],
  evStaleFull: ["Evidence exists but every document is past its freshness window", "ማስረጃ አለ ግን ሁሉም ሰነድ ጊዜውን አልፏል"],
  evEvidenceOnFile: ["Evidence on file", "ማስረጃ አለ"],
  evStaleEvidence: ["Stale evidence", "አረመን ማስረጃ"],
  evNoEvidence: ["No evidence", "ማስረጃ የለም"],
  evFresh: ["fresh", "ትኩስ"],
  evSuggestYes: ["Evidence suggests Yes", "ማስረጃ አዎ ይመልሳል"],
  evSuggestYesFull: ["Fresh evidence is on file — click to answer Yes", "ትኩስ ማስረጃ አለ — አዎ ለመመለስ ይጫኑ"],
  evAttachHint: ["Click to attach this evidence to the note", "ይህን ማስረጃ በማስታወሻው ላይ ለማከል ይጫኑ"],
  evLinkedRules: ["Linked obligations", "የተያያዙ ግዴታዎች"],
  evNoLinks: ["No obligations linked yet — link this document to rule codes so scans can find it.", "እስካሁን ግዴታ አልተያያዘም — ፍተሻዎች እንዲያገኙት ይህን ሰነድ ከደንብ ኮዶች ጋር ያገናኙ።"],
  evAutoTag: ["auto", "ራስ-ሰር"],
  evAutoTagFull: ["Linked automatically from document tags", "ከሰነዱ መለያዎች በራስ-ሰር ተያይዟል"],
  evUnlink: ["Unlink", "አገናኙን አስወግድ"],
  evLinkRule: ["Link obligation", "ግዴታ አገናኝ"],
  evLinkSearchPh: ["Link to obligation — search by code or title…", "ግዴታ አገናኝ — በኮድ ወይም ርዕስ ይፈልጉ…"],
  evNoRuleMatches: ["No matching obligations.", "ተዛማጅ ግዴታዎች አልተገኙም።"],
  evEmpty: ["No documents in the vault yet", "እስካሁን ሰነድ አልተቀመጠም"],
  evEmptySub: ["Upload policies, audit reports, certificates or training records to support your compliance answers.", "የቅጥ መልሶችዎን ለማገዝ ፖሊሲዎችን፣ የኦዲት ሪፖርቶችን ወይም ማረጋገጫዎችን ይስቀሉ።"],
  evNewVersion: ["Upload new version", "አዲስ እትም ይስቀሉ"],
  evNewVersionOf: ["New version of", "አዲስ እትም ለ"],
  evHistory: ["Version history", "የእትም ታሪክ"],
  evCurrent: ["Current", "የአሁኑ"],
  teamSub: ["Users and their access level in your organization", "በተቋምዎ ውስጥ ተጠቃሚዎች እና ደረጃቸው"],
  addUser: ["Add user", "ተጠቃሚ ያክሉ"],
  role: ["Role", "ሚና"],
  lastLogin: ["Last sign-in", "የመጨረሻ ግባት"],
  never: ["Never", "በጭራሽ"],
  active: ["Active", "ንቁ"],
  disabled: ["Disabled", "ተጥፏል"],
  resetPassword: ["Reset password", "የመግቢያ ቃል ይቀይሩ"],
  auditLog: ["Audit Log", "የምስክር መዝገብ"],
  auditSub: ["Every sign-in, MFA and administrative event", "እያንዳንዱ መግባት፣ MFA እና የአስተዳደር ክስተት"],
  event: ["Event", "ክስተት"],
  when: ["When", "መቼ"],
  detail: ["Detail", "ዝርዝር"],
  page: ["Page", "ገጽ"],
  you: ["You", "እርስዎ"],
  crossTenant: ["cross-tenant", "በርካታ-ተቋም"],
  platform: ["Platform", "መድረክ"],
  // Remediation SLA (Procl. 1426/2026 corrective-action timelines)
  slaTitle: ["Remediation SLA", "የማስተካከያ ጊዜ ገደብ"],
  slaSub: ["Corrective-action deadlines by severity — critical 30d · high 60d · medium 90d", "በአደጋ ሁኔታ ደረጃ የማስተካከያ ጊዜ ገደቦች — ወሳኝ 30 ቀን · ከፍተኛ 60 ቀን · መካከለኛ 90 ቀን"],
  slaPolicy: ["SLA policy", "የጊዜ ገደብ ፖሊሲ"],
  slaOnTrack: ["On track", "በጊዜው ላይ"],
  slaDueSoon: ["Due soon", "ቀርቧል"],
  slaOverdue: ["Overdue", "ዘግያል"],
  slaClosedOnTime: ["Closed on time", "በወቅቱ ተዘግቷል"],
  slaClosedLate: ["Closed late", "ዘግዶ ተዘግቷል"],
  slaWaived: ["SLA waived", "ጊዜ ገደቡ ተቋርጧል"],
  slaNotTracked: ["No deadline", "ጊዜ ገደብ የለም"],
  slaDaysLeft: ["{0}d left", "ቀሪ {0} ቀን"],
  slaDaysOver: ["{0}d over", "{0} ቀን ዘግዯል"],
  slaDue: ["Due", "የሚያበቃው"],
  slaAllStates: ["All deadlines", "ሁሉም ጊዜ ገደቦች"],
  slaFilterOverdue: ["Overdue only", "ዘግያውች ብቻ"],
  slaOpenItems: ["{0} open remediations tracked", "{0} ክፍት ማስተካከያዎች ተከታታይ ናቸው"],
  slaOverdueCard: ["overdue remediations", "ዘግያውች ማስተካከያዎች"],
  slaDueSoonCard: ["due within 7 days", "በ7 ቀናት ውስጥ የሚያበቁ"],
  slaClosedLateCard: ["closed late", "ዘግዶ የተዘጉ"],
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a key; optional args substitute {0}, {1}, … placeholders. */
  t: (key: keyof typeof DICT | string, ...args: string[]) => string;
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

  const t = (key: string, ...args: string[]) => {
    const e = DICT[key];
    if (!e) return key;
    let s = lang === "en" ? e[0] : e[1];
    args.forEach((a, i) => { s = s.split(`{${i}}`).join(a); });
    return s;
  };
  const pick = (en: string, am: string) => (lang === "en" ? en : am);

  return <Ctx.Provider value={{ lang, setLang, t, pick }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
