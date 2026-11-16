/**
 * Adwa Cyber — VAPT Center bundled reference catalogue.
 *
 * Serves the simulated half of the hybrid engine (decision D3 — every
 * dev/pilot substitute is honestly labelled, never silent):
 *  - Real, publicly documented CVEs (NVD/CISA references) with the CVSS v3.1
 *    base score, an indicative Exploit Prediction Scoring System (EPSS)
 *    probability and CISA KEV catalog membership as of the catalogue build.
 *    EPSS is a living score — the values here are point-in-time reference
 *    data for prioritisation demos, not a live feed.
 *  - Heuristic audit findings WITHOUT a CVE id (weak protocols, default
 *    credentials, misconfigurations) mirroring what an authenticated /
 *    credentialed infrastructure assessment reports (SBB/83 practice,
 *    CIS benchmark style checks).
 *
 * Pure data module — safe on both server and client.
 */

export type VaptAssetKind =
  | "SERVER" | "NETWORK" | "FIREWALL" | "DATABASE" | "AD_IDENTITY"
  | "WEBAPP" | "API" | "CLOUD" | "ENDPOINT" | "CONTAINER" | "K8S";

export type VaptCategory =
  | "OS" | "NETWORK" | "FIREWALL" | "DATABASE" | "SSL_TLS" | "AD_IDENTITY"
  | "WEB" | "API" | "CLOUD" | "CONTAINER" | "K8S" | "CONFIG";

export interface CatalogueEntry {
  cveId: string | null;
  title: string;
  titleAm?: string; // Amharic headline for the flagship risks
  description: string;
  remediation: string;
  category: VaptCategory;
  cvssScore: number;
  cvssVector?: string;
  /** EPSS probability 0..1 (point-in-time FIRST reference value). */
  epss: number;
  /** Listed in the CISA Known Exploited Vulnerabilities catalog. */
  kev: boolean;
  /** Asset kinds the finding applies to. */
  appliesTo: VaptAssetKind[];
}

export const VAPT_CATALOGUE: CatalogueEntry[] = [
  // ── Flagship exploited-in-the-wild CVEs (KEV) ─────────────────────────────
  {
    cveId: "CVE-2021-44228", title: "Log4Shell — Apache Log4j2 JNDI remote code execution",
    titleAm: "ሎግ4ሼል — በLog4j በኩል የርቀት ኮድ ማስፈጸም",
    description: "JNDI lookup feature of Log4j 2 allows an attacker to execute arbitrary code by crafting a malicious log string. Mass-exploited within hours of disclosure.",
    remediation: "Upgrade Log4j to 2.17.1+ (or remove the JndiLookup class), and rotate credentials on exposed hosts.",
    category: "OS", cvssScore: 10.0, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    epss: 0.97, kev: true, appliesTo: ["SERVER", "CLOUD", "CONTAINER"],
  },
  {
    cveId: "CVE-2021-45046", title: "Log4j2 follow-up denial-of-service / RCE (incomplete 44228 fix)",
    description: "The initial Log4Shell mitigation was incomplete on certain configurations, leaving a second JNDI injection path exploitable in async logging setups.",
    remediation: "Upgrade Log4j to 2.17.1 or later; verify no 2.15/2.16 interim builds remain.",
    category: "OS", cvssScore: 9.0, cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.94, kev: true, appliesTo: ["SERVER", "CLOUD", "CONTAINER"],
  },
  {
    cveId: "CVE-2022-22965", title: "Spring4Shell — Spring Framework data binding RCE",
    description: "Spring MVC data binding on JDK 9+ allowsClassLoader manipulation leading to remote code execution when running on a servlet container as WAR.",
    remediation: "Upgrade Spring Framework to 5.3.18+/5.2.20+; where not possible, disallow data binding for the class property.",
    category: "OS", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.94, kev: true, appliesTo: ["SERVER", "CLOUD", "CONTAINER"],
  },
  {
    cveId: "CVE-2020-1472", title: "Zerologon — Netlogon elevation of privilege to domain admin",
    titleAm: "ዜሮሎግኦን — እስከ ዶሜይን አስተዳዳሪ የሚያደርስ የልሃቀት ጉዳይ",
    description: "A cryptographic flaw in Netlogon's secure channel lets an attacker impersonate the domain controller and reset the machine account password — full domain takeover.",
    remediation: "Apply the August 2020 Windows Server cumulative update and enforce secure RPC; reset affected DC machine-account passwords.",
    category: "AD_IDENTITY", cvssScore: 10.0, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.92, kev: true, appliesTo: ["AD_IDENTITY"],
  },
  {
    cveId: "CVE-2021-42287", title: "sAMAccountName spoofing to domain admin (no pre-auth machine account)",
    description: "Combined with sAMAccountName stripping (CVE-2021-42278), a attacker can obtain Kerberos tickets as a domain controller machine account and escalate to domain admin.",
    remediation: "Install the November 2021 Windows updates and scan for machines whose sAMAccountName ends with a dollar sign.",
    category: "AD_IDENTITY", cvssScore: 8.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["AD_IDENTITY"],
  },
  {
    cveId: "CVE-2021-34527", title: "PrintNightmare — Windows Print Spooler remote code execution",
    description: "The Print Spooler service improperly validates printer drivers; authenticated users (or RPC relay) can load a malicious DLL as SYSTEM. Devastating on domain controllers.",
    remediation: "Disable the Print Spooler service on DCs, apply the July 2021+ cumulative updates, and restrict driver installation via Point-and-Print hardening.",
    category: "OS", cvssScore: 8.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["SERVER", "AD_IDENTITY", "ENDPOINT"],
  },
  {
    cveId: "CVE-2019-0708", title: "BlueKeep — Remote Desktop Services wormable RCE",
    description: "Pre-authentication RCE in the RDP channel; wormable like WannaCry's SMB vector. Any exposed 3389/TCP surface is at immediate risk.",
    remediation: "Enable NLA for RDP, patch Windows 7/Server 2008 (or enroll in extended updates), and never expose RDP directly to the internet.",
    category: "OS", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["SERVER", "ENDPOINT"],
  },
  {
    cveId: "CVE-2017-0144", title: "EternalBlue — SMBv1 remote code execution (WannaCry vector)",
    description: "Heap corruption in SMBv1 allows unauthenticated remote code execution. The ransomware wave that made unpatched Windows famous.",
    remediation: "Disable SMBv1, apply MS17-010, and segment legacy Windows estates off the production network.",
    category: "OS", cvssScore: 8.1, cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.96, kev: true, appliesTo: ["SERVER", "ENDPOINT"],
  },
  // ── Perimeter / VPN / firewall estate (KEV-heavy) ─────────────────────────
  {
    cveId: "CVE-2024-3400", title: "PAN-OS GlobalProtect command injection (arbitrary root)",
    description: "Unauthenticated command injection in the GlobalProtect feature of Palo Alto firewalls — full root execution on the perimeter device itself.",
    remediation: "Apply the vendor hotfix, disable GlobalProtect where unused, and hunt for active sessions on the management plane.",
    category: "FIREWALL", cvssScore: 10.0, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    epss: 0.93, kev: true, appliesTo: ["FIREWALL"],
  },
  {
    cveId: "CVE-2024-21762", title: "Fortinet FortiOS SSL-VPN out-of-bounds write (pre-auth RCE)",
    description: "A crafted HTTP request to the SSL-VPN endpoint triggers a heap overflow with unauthenticated remote code execution potential.",
    remediation: "Upgrade FortiOS to the vendor-fixed release and rotate SSL-VPN credentials.",
    category: "FIREWALL", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["FIREWALL"],
  },
  {
    cveId: "CVE-2023-49603", title: "Citrix Bleed — NetScaler session token leak (account takeover)",
    description: "Insufficient input validation in NetScaler ADC/Gateway leaks persistent session tokens; MFA is bypassed because the session itself is stolen.",
    remediation: "Patch NetScaler, kill all active and persisted sessions, and rotate credentials for accounts that used the VPN.",
    category: "FIREWALL", cvssScore: 9.4, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    epss: 0.9, kev: true, appliesTo: ["FIREWALL"],
  },
  {
    cveId: "CVE-2019-19781", title: "Citrix ADC/Gateway arbitrary code execution",
    description: "Directory traversal plus template injection in the Citrix ADC management portal allows unauthenticated remote code execution.",
    remediation: "Install the Citrix security fixes, remove residual hacktools, and rebuild appliances suspected of compromise.",
    category: "FIREWALL", cvssScore: 9.2, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.93, kev: true, appliesTo: ["FIREWALL"],
  },
  {
    cveId: "CVE-2020-5902", title: "F5 BIG-IP TMUI unauthenticated remote code execution",
    description: "The Traffic Management UI permits an unauthenticated attacker to execute arbitrary commands with root privileges via directory traversal.",
    remediation: "Patch BIG-IP TMOS, restrict management-plane access, and verify the appliance's integrity post-patch.",
    category: "FIREWALL", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.92, kev: true, appliesTo: ["FIREWALL"],
  },
  {
    cveId: "CVE-2023-20198", title: "Cisco IOS XE web UI privilege escalation with implant (ArcaneDoor-style)",
    description: "The HTTP/S server on IOS XE devices lets an attacker create an admin account and implant a backdoor — a full device takeover of core routing estate.",
    remediation: "Disable the HTTP/S management server or patch to the fixed train; remove the 'cisco_tac_admin' implant account if present.",
    category: "NETWORK", cvssScore: 10.0, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["NETWORK"],
  },
  // ── Mail / collaboration / enterprise applications ────────────────────────
  {
    cveId: "CVE-2021-26855", title: "ProxyLogon — Exchange Server unauthenticated SSRF",
    description: "Server-side request forgery in on-premises Exchange lets an unauthenticated attacker reach internal endpoints and chain to arbitrary code execution.",
    remediation: "Install the March 2021 Exchange SU, run the Microsoft mitigation tool, and hunt for webshells in frontend/backend paths.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.94, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2021-34473", title: "ProxyShell — Exchange autodiscover SSRF to RCE chain",
    description: "Autodiscover leaks credentials that chain with other Exchange flaws into authenticated RCE — exploited for ransomware staging.",
    remediation: "Patch Exchange to the July 2021 CU/SU and force credential rotation for service accounts.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.93, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2020-0688", title: "Exchange validation-key default — post-auth RCE",
    description: "A static validation key shipped with Exchange allows any authenticated user to serialize a malicious payload and execute code as SYSTEM.",
    remediation: "Apply the February 2020 patch and reset the validation key on every Exchange server.",
    category: "WEB", cvssScore: 8.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2023-34362", title: "MOVEit Transfer SQL injection — mass data exfiltration",
    description: "Unauthenticated SQL injection in Progress MOVEit's web interface enabled the year's largest file-transfer breach wave (Cl0p ransomware).",
    remediation: "Apply MOVEit service packs, rotate service credentials, and review file logs for exfiltration events.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2022-26134", title: "Atlassian Confluence OGNL injection (unauthenticated RCE)",
    description: "An attacker can inject OGNL expressions into Confluence URLs and execute arbitrary code without authentication.",
    remediation: "Apply Confluence Data Center hotfixes/patched versions and review for unexpected plugin installs.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2021-41773", title: "Apache HTTP Server path traversal & code disclosure",
    description: "Path normalization flaw in Apache 2.4.49 allows files outside the document root (and RCE with mod_cgi) to be read or executed.",
    remediation: "Upgrade Apache to 2.4.51+ and reject encoded path traversals at the WAF/CDN layer.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2021-42013", title: "Apache HTTP Server path traversal (41773 bypass)",
    description: "The initial 41773 fix was bypassable with double URL-encoding — same file-read/RCE primitive on Apache 2.4.50.",
    remediation: "Upgrade Apache to 2.4.51 or later.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  {
    cveId: "CVE-2020-14882", title: "Oracle WebLogic unauthenticated console RCE",
    description: "A path-traversal bypass in the WebLogic administration console exposes the console to unauthenticated attackers with full code execution.",
    remediation: "Apply Oracle CPU patches and restrict admin-console network reachability to jump hosts.",
    category: "WEB", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["SERVER", "WEBAPP"],
  },
  // ── Virtualization / cloud / container / orchestration ────────────────────
  {
    cveId: "CVE-2021-21972", title: "VMware vSphere vROps unauthenticated file upload RCE",
    description: "A vulnerable vRealize Operations plugin endpoint allows unauthenticated file upload leading to remote code execution on the vCenter estate.",
    remediation: "Patch vROps, remove the vulnerable plugin where unused, and audit vCenter for rogue appliances.",
    category: "CLOUD", cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.91, kev: true, appliesTo: ["CLOUD", "SERVER"],
  },
  {
    cveId: "CVE-2021-21985", title: "VMware vCenter Server vRealize Operations RCE",
    description: "Unauthenticated API access in a bundled vROps component exposes vCenter to remote code execution.",
    remediation: "Update vCenter/ESXi to the fixed builds and rotate the SSO administrator credentials.",
    category: "CLOUD", cvssScore: 8.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.9, kev: true, appliesTo: ["CLOUD", "SERVER"],
  },
  {
    cveId: "CVE-2023-44487", title: "HTTP/2 Rapid Reset — denial-of-service amplification",
    description: "Rapidly opening and cancelling HTTP/2 streams exhausts server worker capacity — the record-breaking 2023 DDoS vector against web/API front doors.",
    remediation: "Rate-limit stream resets at the edge, patch servers/app frontends with vendor guidance, and validate DDoS protection cover.",
    category: "WEB", cvssScore: 7.5, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
    epss: 0.87, kev: true, appliesTo: ["WEBAPP", "API", "FIREWALL"],
  },
  // ── Linux estate ──────────────────────────────────────────────────────────
  {
    cveId: "CVE-2021-3156", title: "sudo Baron Samedit — heap overflow local privilege escalation",
    description: "Heap corruption in sudo's argument parsing grants root to any local user, even without sudo rights.",
    remediation: "Update sudo to 1.9.5p2+ and audit for unexpected root-shell creation in auditd logs.",
    category: "OS", cvssScore: 7.8, cvssVector: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.88, kev: true, appliesTo: ["SERVER", "CONTAINER", "ENDPOINT"],
  },
  {
    cveId: "CVE-2016-5195", title: "Dirty COW — Linux kernel copy-on-write privilege escalation",
    description: "Race condition in the kernel's COW handling lets a local user write to read-only mappings — decade-old but still present on unpatched legacy servers.",
    remediation: "Patch the kernel; on legacy estates, isolate the affected servers and plan migration.",
    category: "OS", cvssScore: 7.8, cvssVector: "CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.83, kev: true, appliesTo: ["SERVER", "ENDPOINT"],
  },
  {
    cveId: "CVE-2022-0847", title: "Dirty Pipe — Linux kernel pipe buffer flag privilege escalation",
    description: "A stale pipe-buffer flag lets unprivileged processes overwrite file page-cache pages — including root-owned setuid files.",
    remediation: "Update to kernel 5.16.11/5.15.25/5.10.102 or later.",
    category: "OS", cvssScore: 7.8, cvssVector: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.82, kev: false, appliesTo: ["SERVER", "ENDPOINT"],
  },
  {
    cveId: "CVE-2024-6387", title: "regreSSHion — OpenSSH signal handler race condition RCE",
    description: "A return-oriented-programming remote code execution path in the OpenSSH server (unauthenticated, race-dependent) on glibc-based Linux.",
    remediation: "Update OpenSSH to 9.8p1; where not possible, mitigate by disabling PAM or setting LoginGraceTime to 0.",
    category: "OS", cvssScore: 8.1, cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.54, kev: false, appliesTo: ["SERVER", "ENDPOINT"],
  },
  // ── SSL / TLS ─────────────────────────────────────────────────────────────
  {
    cveId: "CVE-2014-0160", title: "Heartbleed — OpenSSL TLS heartbeat memory disclosure",
    description: "The TLS heartbeat flaw leaks up to 64KB of server memory per request: private keys, session tickets, and passwords.",
    remediation: "Upgrade OpenSSL, regenerate keys and certificates, and invalidate existing sessions.",
    category: "SSL_TLS", cvssScore: 7.5, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    epss: 0.92, kev: true, appliesTo: ["SERVER", "FIREWALL", "WEBAPP", "API"],
  },
  {
    cveId: "CVE-2016-2183", title: "SWEET32 — 3DES block cipher birthday attack on TLS sessions",
    description: "64-bit block ciphers in TLS allow birthday-bound collision attacks that can decrypt long-lived HTTPS sessions.",
    remediation: "Disable 3DES cipher suites; keep TLS 1.2/1.3 with AEAD ciphers only.",
    category: "SSL_TLS", cvssScore: 3.7, cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
    epss: 0.35, kev: false, appliesTo: ["SERVER", "FIREWALL", "WEBAPP", "API"],
  },
  // ── Databases ─────────────────────────────────────────────────────────────
  {
    cveId: "CVE-2012-2122", title: "MySQL authentication bypass (legacy MariaDB/MySQL builds)",
    description: "A memcmp edge case allowed repeated authentication attempts to succeed with a wrong password — illustrating the risk of unpatched legacy database builds.",
    remediation: "Upgrade legacy MySQL/MariaDB builds and enforce patch-level baselines on the database estate.",
    category: "DATABASE", cvssScore: 6.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    epss: 0.72, kev: false, appliesTo: ["DATABASE"],
  },
  {
    cveId: "CVE-2020-0618", title: "Microsoft SQL Server Reporting Services RCE",
    description: "Deserialization flaw in SSRS allows authenticated remote code execution on the reporting server — often reachable from the application tier.",
    remediation: "Apply the SQL Server reporting-services fixes and restrict data-source accounts.",
    category: "DATABASE", cvssScore: 8.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    epss: 0.62, kev: false, appliesTo: ["DATABASE"],
  },
  // ── Heuristic audit findings (no CVE — credentialed/CIS-style checks) ─────
  {
    cveId: null, title: "Kerberoastable service accounts with RC4 Kerberos encryption permitted",
    description: "Service accounts with SPNs can be requested in weak RC4-encrypted tickets and cracked offline; combined with long-lived service passwords this is a classic domain-compromise path.",
    remediation: "Enforce AES-only Kerberos, deploy gMSAs, rotate service-account passwords, and monitor RC4 ticket requests.",
    category: "AD_IDENTITY", cvssScore: 6.5, cvssVector: null as unknown as string,
    epss: 0.42, kev: false, appliesTo: ["AD_IDENTITY"],
  },
  {
    cveId: null, title: "AS-REP roastable accounts (Kerberos pre-authentication disabled)",
    description: "Accounts without pre-authentication expose offline-crackable hashes — a favourite first foothold for lateral movement.",
    remediation: "Enable pre-authentication on all accounts; monitor AS-REP requests for anomalies.",
    category: "AD_IDENTITY", cvssScore: 5.3, epss: 0.35, kev: false, appliesTo: ["AD_IDENTITY"],
  },
  {
    cveId: null, title: "Dormant and over-privileged service accounts in Active Directory",
    description: "Service accounts older than 90 days without logon, several holding domain-admin-equivalent rights — a dormant attack-path amplifier.",
    remediation: "Inventory service accounts, remove stale ones, and right-size privileges with tiered administration.",
    category: "AD_IDENTITY", cvssScore: 4.8, epss: 0.2, kev: false, appliesTo: ["AD_IDENTITY"],
  },
  {
    cveId: null, title: "SNMPv1 enabled with default community string 'public'",
    description: "The device answers read requests on the default community string — a full configuration disclosure to anyone on the management VLAN.",
    remediation: "Move to SNMPv3 with authentication and privacy, change community strings, and restrict manager IPs.",
    category: "NETWORK", cvssScore: 7.5, epss: 0.4, kev: false, appliesTo: ["NETWORK", "FIREWALL", "SERVER"],
  },
  {
    cveId: null, title: "Telnet management enabled on network device",
    description: "Interactive device management over cleartext Telnet exposes administrative credentials to anyone able to sniff the segment.",
    remediation: "Disable Telnet daemons; require SSH with key-based access via the management jump host.",
    category: "NETWORK", cvssScore: 5.3, epss: 0.3, kev: false, appliesTo: ["NETWORK", "FIREWALL"],
  },
  {
    cveId: null, title: "SMBv1 protocol still enabled on Windows estate",
    description: "The 2017-era SMBv1 protocol remains enabled — the EternalBlue/ WannaCry prerequisite and a CIS benchmark failure.",
    remediation: "Disable the SMBv1 feature on servers and endpoints; keep legacy exceptions isolated.",
    category: "CONFIG", cvssScore: 6.1, epss: 0.5, kev: false, appliesTo: ["SERVER", "ENDPOINT", "AD_IDENTITY"],
  },
  {
    cveId: null, title: "Local administrator password reuse across the estate (no LAPS)",
    description: "Identical local admin credentials across many hosts — one endpoint compromise becomes estate-wide movement.",
    remediation: "Deploy LAPS/ randomised local-admin credentials per host.",
    category: "CONFIG", cvssScore: 6.4, epss: 0.45, kev: false, appliesTo: ["ENDPOINT", "SERVER", "AD_IDENTITY"],
  },
  {
    cveId: null, title: "TLS 1.0/1.1 enabled on production service",
    description: "Deprecated TLS protocol versions remain negotiated — fails modern PCI-DSS/ NBE expectations and weakens client sessions.",
    remediation: "Disable TLS 1.0/1.1 and 3DES/RC4 suites; enforce TLS 1.2+ with AEAD ciphers.",
    category: "SSL_TLS", cvssScore: 5.3, epss: 0.3, kev: false, appliesTo: ["SERVER", "WEBAPP", "API", "FIREWALL", "DATABASE"],
  },
  {
    cveId: null, title: "Self-signed certificate presented in production",
    description: "The service presents a self-signed certificate — clients cannot verify server identity, enabling machine-in-the-middle positions on banking sessions.",
    remediation: "Issue a CA-signed certificate (internal PKI or public CA) and automate renewal.",
    category: "SSL_TLS", cvssScore: 5.9, epss: 0.28, kev: false, appliesTo: ["WEBAPP", "API", "FIREWALL", "SERVER", "DATABASE"],
  },
  {
    cveId: null, title: "MongoDB bound to all interfaces without authentication",
    description: "The database listens on 0.0.0.0 with authorization disabled — a default misconfiguration repeatedly behind mass-extortion databases.",
    remediation: "Enable access control, bind to the application VLAN, and require TLS with client certificates.",
    category: "DATABASE", cvssScore: 7.5, epss: 0.51, kev: false, appliesTo: ["DATABASE"],
  },
  {
    cveId: null, title: "PostgreSQL trust authentication in pg_hba.conf",
    description: "A trust-method line in the host-based authentication file lets any local/ network client connect as any user without a password.",
    remediation: "Replace trust with scram-sha-256 entries and reload the configuration.",
    category: "DATABASE", cvssScore: 7.5, epss: 0.44, kev: false, appliesTo: ["DATABASE"],
  },
  {
    cveId: null, title: "Kubernetes dashboard exposed without authentication",
    description: "The Kubernetes dashboard service is reachable without a token — full cluster takeover (secrets, workloads, exec into pods) from a single endpoint.",
    remediation: "Enable RBAC on the dashboard, require token login, and bind the service to localhost/VPN.",
    category: "K8S", cvssScore: 8.0, epss: 0.48, kev: false, appliesTo: ["K8S"],
  },
  {
    cveId: null, title: "Container images built on unpinned 'latest' base tags",
    description: "Builds pull whatever 'latest' resolves to — no reproducibility, no patch attestation, and silently-inherited upstream vulnerabilities.",
    remediation: "Pin base images by digest and scan images in CI before registry promotion.",
    category: "CONTAINER", cvssScore: 3.7, epss: 0.1, kev: false, appliesTo: ["CONTAINER", "K8S"],
  },
  {
    cveId: null, title: "GraphQL introspection enabled on production API",
    description: "Introspection hands attackers the full schema — field-level reconnaissance for authorisation gaps (IDOR probing).",
    remediation: "Disable introspection and query depth limits in production gateways.",
    category: "API", cvssScore: 5.3, epss: 0.2, kev: false, appliesTo: ["API"],
  },
  {
    cveId: null, title: "Cloud storage bucket with public-read access control",
    description: "A tenant storage bucket permits anonymous reads — client documents and backups exposed to the internet (CSPM-style finding).",
    remediation: "Remove public ACLs, enable encryption, and enforce block-public-access at the account level.",
    category: "CLOUD", cvssScore: 7.5, epss: 0.43, kev: false, appliesTo: ["CLOUD"],
  },
  {
    cveId: null, title: "Ephemeral VPN accounts not offboarded (remote-workforce gap)",
    description: "Contractor VPN accounts still active 90+ days past engagement end — unmanaged access into the corporate network from off-VPN devices.",
    remediation: "Reconcile HR offboarding with the VPN directory monthly; require MFA on all remote access.",
    category: "CONFIG", cvssScore: 4.3, epss: 0.12, kev: false, appliesTo: ["FIREWALL", "AD_IDENTITY"],
  },
];

/** Reference platform labels for the demo asset registry (seed realism). */
export const KIND_PLATFORMS: Record<VaptAssetKind, string[]> = {
  SERVER: ["Windows Server 2019", "Ubuntu Server 22.04", "RHEL 8.8", "Windows Server 2012 R2 (legacy)"],
  NETWORK: ["Cisco IOS-XE 17.6", "Cisco Nexus 9.3(7)", "Huawei VRP 8.180"],
  FIREWALL: ["Palo Alto PAN-OS 10.2.4", "Fortinet FortiOS 7.0.11", "Cisco ASA 9.16(3)"],
  DATABASE: ["Oracle Database 19c", "Microsoft SQL Server 2019", "MongoDB 5.0", "PostgreSQL 13"],
  AD_IDENTITY: ["Windows Server 2019 AD DS", "Windows Server 2012 R2 AD DS (legacy)"],
  WEBAPP: ["Next.js on Node 20", "Apache Tomcat 9 / Java 11", "IIS 10 on Windows Server 2019"],
  API: ["REST gateway (nginx 1.24)", "GraphQL gateway (Node 18)"],
  CLOUD: ["VMware vSphere 7.0u3", "AWS eu-central (read-only connector)"],
  ENDPOINT: ["Windows 11 23H2", "Windows 10 22H2"],
  CONTAINER: ["Harbor registry 2.9", "Docker Engine 24"],
  K8S: ["Kubernetes 1.27 (on-prem)"],
};

export const KIND_PORTS: Record<VaptAssetKind, string> = {
  SERVER: "445/tcp,3389/tcp", NETWORK: "22/tcp,161/udp", FIREWALL: "443/tcp,4433/tcp",
  DATABASE: "1521/tcp", AD_IDENTITY: "88/tcp,389/tcp,445/tcp", WEBAPP: "443/tcp", API: "443/tcp",
  CLOUD: "443/tcp", ENDPOINT: "—", CONTAINER: "443/tcp", K8S: "6443/tcp",
};
