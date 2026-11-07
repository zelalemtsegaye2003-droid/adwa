/**
 * Adwa Cyber — Evidence Vault demo seed.
 * Creates realistic artefacts (txt / csv / pdf) with on-disk files, checksums,
 * one version chain and one archived document, so the Evidence Library has
 * meaningful content for the pilot demo.
 *
 * Idempotent: skips entirely if any evidence document already exists.
 *
 * Run: bun scripts/seed-evidence.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const db = new PrismaClient();
const STORAGE_ROOT = path.join(process.cwd(), ".data", "evidence");

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const storedName = (ext: string) => `${randomBytes(16).toString("hex")}.${ext}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Build a minimal but valid one-page PDF (correct xref offsets). */
function buildPdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = [
    "BT",
    "/F1 16 Tf",
    "56 786 Td",
    `(${esc(title)}) Tj`,
    "/F1 11 Tf",
    "0 -30 Td",
    "16 TL",
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

interface SeedDoc {
  title: string;
  description: string;
  category: string;
  tags: string;
  fileName: string;
  ext: "txt" | "csv" | "pdf";
  content: () => Buffer;
  uploaderEmail: string;
  orgName: string;
  createdAt: Date;
  downloads?: number;
  lastVerifiedAt?: Date | null;
  status?: string;
  version?: number;
  rootId?: string | null;
}

const DOCS: SeedDoc[] = [
  {
    title: "Information Security Policy v3.2",
    description:
      "Board-approved ISMS policy covering governance, access control, cryptography and incident management. Supporting evidence for NBE SBB/83/2022 Art. 12 and PD-1321 Art. 22.",
    category: "POLICY",
    tags: "NBE-15, Art. 12, board-approved",
    fileName: "CBE_Information_Security_Policy_v3.2.txt",
    ext: "txt",
    content: () =>
      Buffer.from(
        [
          "COMMERCIAL BANK OF ETHIOPIA (CBE)",
          "INFORMATION SECURITY POLICY — VERSION 3.2",
          "Classification: Internal — Approved by the Board ICT Committee, 12 March 2026",
          "",
          "1. SCOPE",
          "   This policy applies to all CBE employees, contractors, systems and",
          "   third parties processing bank information assets, in line with NBE",
          "   Directive SBB/83/2022 and the Personal Data Protection Proclamation",
          "   No. 1321/2024.",
          "",
          "2. GOVERNANCE",
          "   2.1 The Board ICT Committee owns this policy and reviews it annually.",
          "   2.2 The CISO reports posture quarterly to executive management.",
          "",
          "3. ACCESS CONTROL",
          "   3.1 Access is granted on least-privilege, need-to-know basis.",
          "   3.2 Privileged access requires documented approval and is reviewed",
          "       every 90 days.",
          "   3.3 Multi-factor authentication is mandatory for all remote and",
          "       administrative access.",
          "",
          "4. CRYPTOGRAPHY",
          "   4.1 Data in transit is protected with TLS 1.2 or higher.",
          "   4.2 Customer data at rest is encrypted using AES-256.",
          "",
          "5. INCIDENT MANAGEMENT",
          "   5.1 Suspected incidents must be reported to soc@cbe.com.et within",
          "       one hour of detection.",
          "   5.2 Ethio-CERT is notified for incidents meeting national",
          "       reporting thresholds.",
          "",
          "— End of policy extract (demo artefact, Adwa Cyber pilot) —",
          "",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "officer@cbe.com.et",
    orgName: "Commercial Bank of Ethiopia (CBE)",
    createdAt: daysAgo(120),
    downloads: 6,
    lastVerifiedAt: daysAgo(3),
  },
  {
    title: "Security Awareness Training Records — Q3 2026",
    description:
      "Attendance and assessment scores for the Q3-2026 phishing & data-protection awareness campaign across Retail Banking and IT directorates.",
    category: "TRAINING_RECORD",
    tags: "NBE-19, awareness, Q3-2026",
    fileName: "CBE_Training_Records_Q3_2026.csv",
    ext: "csv",
    content: () =>
      Buffer.from(
        [
          "EmployeeID,Name,Directorate,Session,Date,Score,Status",
          "CBE-1042,Abebe Kebede,Retail Banking,Phishing Awareness,2026-08-14,92,Passed",
          "CBE-1107,Tigist Alemu,Retail Banking,Phishing Awareness,2026-08-14,88,Passed",
          "CBE-1188,Dawit Haile,IT Operations,Data Protection (PD-1321),2026-08-21,95,Passed",
          "CBE-1203,Meron Tadesse,IT Operations,Data Protection (PD-1321),2026-08-21,79,Passed",
          "CBE-1264,Yonas Girma,Risk & Compliance,Executive Briefing,2026-09-02,90,Passed",
          "CBE-1310,Selam Bekele,Risk & Compliance,Executive Briefing,2026-09-02,86,Passed",
          "CBE-1355,Hanna Wolde,Branch Network,Phishing Awareness,2026-09-11,64,Retake",
          "CBE-1402,Bereket Assefa,Branch Network,Phishing Awareness,2026-09-11,81,Passed",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "officer@cbe.com.et",
    orgName: "Commercial Bank of Ethiopia (CBE)",
    createdAt: daysAgo(65),
    downloads: 4,
    lastVerifiedAt: daysAgo(9),
  },
  {
    title: "ICT Risk Appetite Statement v1.0",
    description:
      "First issue of the board risk-appetite statement for ICT and cyber risk (superseded by v2.0 after the annual review).",
    category: "POLICY",
    tags: "risk-appetite, superseded",
    fileName: "CBE_ICT_Risk_Appetite_Statement_v1.0.txt",
    ext: "txt",
    content: () =>
      Buffer.from(
        [
          "COMMERCIAL BANK OF ETHIOPIA",
          "ICT RISK APPETITE STATEMENT — VERSION 1.0 (SUPERSEDED)",
          "Approved 20 June 2025 · Superseded by v2.0",
          "",
          "The Board accepts a LOW appetite for ICT and cyber security risk.",
          "Key thresholds (v1.0):",
          " - Zero tolerance for unauthorized disclosure of customer data.",
          " - Maximum tolerable unplanned downtime for core banking: 4 hours/quarter.",
          " - Critical patch deployment window: 30 days from vendor release.",
          "",
          "— Superseded artefact retained for audit trail (Adwa Cyber pilot) —",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "admin@cbe.com.et",
    orgName: "Commercial Bank of Ethiopia (CBE)",
    createdAt: daysAgo(420),
    status: "SUPERSEDED",
    version: 1,
  },
  {
    title: "ICT Risk Appetite Statement v2.0",
    description:
      "Current board risk-appetite statement: tightened patch windows (14 days for critical) and added third-party risk thresholds after the 2026 annual review.",
    category: "POLICY",
    tags: "risk-appetite, board-approved, 2026-review",
    fileName: "CBE_ICT_Risk_Appetite_Statement_v2.0.txt",
    ext: "txt",
    content: () =>
      Buffer.from(
        [
          "COMMERCIAL BANK OF ETHIOPIA",
          "ICT RISK APPETITE STATEMENT — VERSION 2.0",
          "Approved by the Board Risk Committee, 18 September 2026",
          "",
          "The Board maintains a LOW appetite for ICT and cyber security risk.",
          "Key thresholds (v2.0):",
          " - Zero tolerance for unauthorized disclosure of customer data.",
          " - Maximum tolerable unplanned downtime for core banking: 2 hours/quarter.",
          " - Critical patch deployment window: 14 days from vendor release (was 30).",
          " - New: critical third-party providers must demonstrate ISO 27001 or",
          "   equivalent certification before onboarding.",
          "",
          "Change log v2.0: patch window tightened; third-party clause added.",
          "— End of statement (demo artefact, Adwa Cyber pilot) —",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "admin@cbe.com.et",
    orgName: "Commercial Bank of Ethiopia (CBE)",
    createdAt: daysAgo(48),
    downloads: 2,
    lastVerifiedAt: daysAgo(6),
    version: 2,
  },
  {
    title: "External Penetration Test Report 2026",
    description:
      "Independent penetration test of internet-facing services executed by an NBE-licensed assessment firm; includes executive summary and remediation tracker.",
    category: "ASSESSMENT",
    tags: "pentest, NBE-33, external-audit",
    fileName: "CBE_External_Pentest_Report_2026.txt",
    ext: "txt",
    content: () =>
      Buffer.from(
        [
          "EXTERNAL PENETRATION TEST REPORT 2026",
          "Client: Commercial Bank of Ethiopia (CBE)",
          "Assessment firm: [Licensed per NBE directive] — Report ID PT-2026-114",
          "Window: 05–16 October 2026 · Classification: Confidential",
          "",
          "EXECUTIVE SUMMARY",
          " 14 findings: 2 high, 7 medium, 5 low. No critical findings.",
          "",
          "KEY FINDINGS",
          " H-01 Internet-facing loan portal reflects verbose error messages (medium info-disclosure chain).",
          " H-02 Legacy FTP service permitted weak cipher negotiation.",
          "",
          "RETEST STATUS",
          " H-01 Remediated 24 Oct 2026 (verified).",
          " H-02 Remediated 21 Oct 2026 (verified).",
          "",
          "CONCLUSION",
          " Security posture of internet-facing services is SATISFACTORY with",
          " remediation of the two high findings verified.",
          "",
          "— Extract of full report (demo artefact, Adwa Cyber pilot) —",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "officer@cbe.com.et",
    orgName: "Commercial Bank of Ethiopia (CBE)",
    createdAt: daysAgo(24),
    downloads: 3,
    lastVerifiedAt: daysAgo(1),
  },
  {
    title: "Incident Response Tabletop Drill — Q2 2026",
    description:
      "Debrief of the ransomware tabletop exercise run with the crisis management team; includes response-time metrics and action items.",
    category: "INCIDENT_LOG",
    tags: "incident-response, drill, NBE-40",
    fileName: "Wasasa_IR_Tabletop_Drill_Q2_2026.txt",
    ext: "txt",
    content: () =>
      Buffer.from(
        [
          "WASASA MICROFINANCE INSTITUTION S.C.",
          "INCIDENT RESPONSE TABLETOP DRILL — Q2 2026 (Ransomware scenario)",
          "Date: 27 July 2026 · Facilitator: IT Security Officer",
          "",
          "SCENARIO",
          " Simulated ransomware encryption of the core microfinance system",
          " following a phishing-triggered credential compromise.",
          "",
          "RESPONSE METRICS",
          " - Time to detection:            22 minutes (target ≤ 30)",
          " - Time to containment:          1h 05m  (target ≤ 2h)",
          " - Time to Ethio-CERT notification: 48 minutes (regulatory: ≤ 24h)",
          " - Backup restore rehearsal:     successful (RPO 15 min verified)",
          "",
          "ACTION ITEMS",
          " 1. Add offline backup copy at the disaster-recovery site (due Q3).",
          " 2. Refresh playbooks with Amharic quick-reference cards (due Q3).",
          "",
          "— Drill debrief extract (demo artefact, Adwa Cyber pilot) —",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "admin@wasasa.et",
    orgName: "Wasasa MFI",
    createdAt: daysAgo(95),
    downloads: 1,
    lastVerifiedAt: daysAgo(20),
  },
  {
    title: "Branch Firewall Rules Export (Q1 2026)",
    description:
      "Rule-base export from the HO firewall cluster for the Q1 review. Archived after the Q2 review superseded it.",
    category: "CONFIG_EXPORT",
    tags: "firewall, config, archived",
    fileName: "Wasasa_Firewall_Rules_Q1_2026.csv",
    ext: "csv",
    content: () =>
      Buffer.from(
        [
          "RuleID,Source,Destination,Service,Action,LastHit,Comment",
          "FW-001,any,HO-Core,ssh,deny,,legacy admin",
          "FW-014,branch-subnets,HO-Core,banking-app,allow,2026-03-28,core access",
          "FW-022,any,DMZ-web,https,allow,2026-03-29,public services",
          "FW-031,internal,any,smtp,allow,2026-03-27,mail relay",
          "FW-045,any,any,telnet,deny,,blocked by policy",
        ].join("\n"),
        "utf8"
      ),
    uploaderEmail: "admin@wasasa.et",
    orgName: "Wasasa MFI",
    createdAt: daysAgo(200),
    downloads: 2,
    lastVerifiedAt: daysAgo(150),
    status: "ARCHIVED",
  },
  {
    title: "ISO/IEC 27001:2022 Certificate (HQ scope)",
    description:
      "Certification of the Wasasa MFI information security management system, HQ scope, valid until 14 February 2029.",
    category: "CERTIFICATE",
    tags: "ISO-27001, certificate",
    fileName: "Wasasa_ISO27001_Certificate.pdf",
    ext: "pdf",
    content: () =>
      buildPdf("CERTIFICATE OF REGISTRATION", [
        "This is to certify that",
        "Wasasa Microfinance Institution S.C.",
        "operates an Information Security Management System",
        "complying with the requirements of ISO/IEC 27001:2022",
        "",
        "Scope: Provision of microfinance services at head office,",
        "Addis Ababa, Ethiopia.",
        "",
        "Certificate No: EA-27001-2026-0447",
        "Issue date: 15 February 2026",
        "Expiry date: 14 February 2029",
        "",
        "Accredited certification body (demo artefact — Adwa Cyber pilot).",
      ]),
    uploaderEmail: "admin@wasasa.et",
    orgName: "Wasasa MFI",
    createdAt: daysAgo(150),
    downloads: 5,
    lastVerifiedAt: daysAgo(12),
  },
];

async function main() {
  const existing = await db.evidenceDocument.count();
  if (existing > 0) {
    console.log(`Evidence seed skipped — ${existing} document(s) already present.`);
    return;
  }

  // org + uploader lookup
  const orgs = await db.organization.findMany();
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const orgByName = new Map(orgs.map((o) => [o.name, o]));
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  // v1 of the risk-appetite chain defines the rootId for v2
  const chainRoots: Record<string, string> = {};
  let created = 0;

  for (const d of DOCS) {
    const org = orgByName.get(d.orgName);
    const uploader = userByEmail.get(d.uploaderEmail);
    if (!org || !uploader) {
      console.warn(`  ! Skipping "${d.title}" — missing org or uploader`);
      continue;
    }

    const buf = d.content();
    const sn = storedName(d.ext);
    const dir = path.join(STORAGE_ROOT, org.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, sn), buf, { mode: 0o600 });

    const doc = await db.evidenceDocument.create({
      data: {
        title: d.title,
        description: d.description,
        category: d.category,
        tags: d.tags,
        fileName: d.fileName,
        storedName: sn,
        mimeType:
          d.ext === "pdf"
            ? "application/pdf"
            : d.ext === "csv"
              ? "text/csv"
              : "text/plain",
        fileSize: buf.length,
        checksum: sha256(buf),
        status: d.status ?? "ACTIVE",
        version: d.version ?? 1,
        rootId:
          d.version === 2 && chainRoots["CBE-RISK"]
            ? chainRoots["CBE-RISK"]
            : null,
        downloads: d.downloads ?? 0,
        lastVerifiedAt: d.lastVerifiedAt ?? null,
        organizationId: org.id,
        uploadedById: uploader.id,
        createdAt: d.createdAt,
        updatedAt: d.createdAt,
      },
    });

    if (d.title.includes("Risk Appetite Statement v1")) {
      chainRoots["CBE-RISK"] = doc.id;
    }

    created++;
    console.log(`  ✓ ${d.orgName} — "${d.title}" (${d.ext}, ${buf.length} B, ${d.status ?? "ACTIVE"})`);
  }

  console.log(`Evidence seed complete — ${created} artefacts created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
