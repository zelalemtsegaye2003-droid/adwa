/**
 * Adwa Cyber — AD Attack Path dataset (demo topology, CBE.LOCAL).
 *
 * BloodHound-style Active Directory relationship graph used by the
 * VAPT Center "AD Attack Paths" tab (LOT4 §G: Identity, Active Directory
 * & Attack Path Analysis). Edges are directed in the *attack traversal*
 * direction — i.e. an attacker controlling `from` gains the leverage
 * described by the edge over `to`. Each edge carries the underlying AD
 * relation and an exploitation note.
 *
 * This is seeded reference topology for the pilot tenant; the enterprise
 * edition ingests live directory data through the identity connector.
 */

export type AdNodeType = "user" | "group" | "computer" | "domain";

export interface AdNodeFlags {
  /** Entry point — assumed compromised in the breach scenario (phish etc.). */
  entry?: boolean;
  /** Target — compromise equals domain dominance. */
  target?: boolean;
  /** Account has an SPN → Kerberoastable. */
  kerberoastable?: boolean;
  /** Account has no pre-auth required → AS-REP roastable. */
  asrepRoastable?: boolean;
  /** Days since password rotation. */
  passwordAgeDays?: number;
  /** Days since last logon (dormant account). */
  dormantDays?: number;
  /** Privileged beyond what the workload needs. */
  overPrivileged?: boolean;
  /** Unconstrained Kerberos delegation enabled (host). */
  unconstrainedDelegation?: boolean;
}

export interface AdNode {
  id: string;
  type: AdNodeType;
  /** Short display name. */
  name: string;
  /** Tiering model level: 0 = domain dominance, 1 = servers/privileged, 2 = standard. */
  tier: 0 | 1 | 2;
  /** Layout column (left→right attack flow). */
  col: number;
  flags: AdNodeFlags;
  /** Risk note (EN). */
  note: string;
  /** Risk note (AM). */
  noteAm: string;
}

export type AdEdgeType =
  | "MemberOf"
  | "HasSession"
  | "AdminCreds"
  | "ResetPassword"
  | "Kerberoast"
  | "AsRepRoast"
  | "CanRDP"
  | "AdminTo"
  | "UnconstrainedDeleg";

export interface AdEdge {
  from: string;
  to: string;
  type: AdEdgeType;
  /** Underlying AD relation (what the directory actually says). */
  relation: string;
  /** How an attacker abuses it (EN). */
  note: string;
  /** How an attacker abuses it (AM). */
  noteAm: string;
}

export const AD_DOMAIN = "CBE.LOCAL";

export const AD_NODES: AdNode[] = [
  // ── entry users ────────────────────────────────────────────────────────────
  {
    id: "u-intern-dawit", type: "user", name: "intern.dawit", tier: 2, col: 0,
    flags: { entry: true },
    note: "Breach entry: phished laptop of an intern (tier-2 user, Domain Users).",
    noteAm: "የመግቢያ ነጥብ፦ የተታለየ የኢንተርን ላፕቶፕ (የከፍታ-2 ተጠቃሚ፣ የ Domain Users አባል)።",
  },
  {
    id: "u-payroll-marta", type: "user", name: "payroll.marta", tier: 2, col: 0,
    flags: { entry: true },
    note: "Breach entry: payroll clerk phished via fake HR portal mail.",
    noteAm: "የመግቢያ ነጥብ፦ የደመወዝ ሰራተኛ በሐሰተ ኤችአር ፖርታል ወደቅታለች።",
  },
  // ── tier-2 objects ─────────────────────────────────────────────────────────
  {
    id: "g-domain-users", type: "group", name: "Domain Users", tier: 2, col: 1,
    flags: {},
    note: "Baseline authenticated-domain context — the foothold every domain user hands the attacker.",
    noteAm: "መነሻ የተረጋገጠ ዶሜይን አድራሻ — እያንዳንዱ ተጠቃሚ ለጠቃቱ የሚሰጠው ተደራሽነት።",
  },
  {
    id: "c-ws-42", type: "computer", name: "CBE-WS-42", tier: 2, col: 1,
    flags: {},
    note: "Shared branch workstation: both entry users have sessions here, and helpdesk admins log on — a credential marketplace.",
    noteAm: "የቅርንት ቅርንት ሥራ መስሪያ ቦታ፦ ሁለቱም መግቢያ ተጠቃሚዎች እና የሄልፕዴስክ አስተዳደር እዚህ ላይ ይገባሉ — የማረጋገጫ መሸጫ ቦታ።",
  },
  // ── tier-1 / privileged middle layer ───────────────────────────────────────
  {
    id: "g-it-helpdesk", type: "group", name: "IT Helpdesk", tier: 1, col: 2,
    flags: {},
    note: "Tier-1 support group with delegated password-reset rights over the service-account OU (overreach).",
    noteAm: "የከፍታ-1 የድጋፍ ቡድን በሰርቪስ-አካውንት OU ላይ የተሰጠው የይለፍ-ቃል መቀየር መብት አለው (በተጣራ)።",
  },
  {
    id: "u-svc-webapp", type: "user", name: "svc-webapp", tier: 2, col: 2,
    flags: { asrepRoastable: true, dormantDays: 45, overPrivileged: true, passwordAgeDays: 400 },
    note: "Web-farm service account: no Kerberos pre-auth (AS-REP roastable), dormant 45 days, 400-day-old password, yet admin on the web tier.",
    noteAm: "የዌብ-ፋርም ሰርቪስ አካውንት፦ ቅድመ-ማረጋገጥ የለም (AS-REP ተጥቃሚ)፣ 45 ቀን ያለተገባ፣ 400 ቀን የዋጋ ይለፍ ቃል፣ ነገር ግን በዌብ ደረጃ አስተዳዳሪ።",
  },
  {
    id: "u-svc-sql", type: "user", name: "svc-sql", tier: 1, col: 2,
    flags: { kerberoastable: true, passwordAgeDays: 900 },
    note: "SQL service account with SPN — Kerberoastable; password not rotated for 900 days.",
    noteAm: "ከ SPN ጋር የ SQL ሰርቪስ አካውንት — ለ Kerberoast የተጋለጠ፤ ይለፍ ቃሉ ለ900 ቀናት አልተቀየረም።",
  },
  {
    id: "g-sql-admins", type: "group", name: "SQL Admins", tier: 1, col: 2,
    flags: {},
    note: "SQL Server administrative group — controls the core-banking data tier host.",
    noteAm: "የ SQL ሰርቨር አስተዳደር ቡድን — የዋናው ባንክ ዳታ ደረጃ አስተናጋጅን ይቆጣጠራል።",
  },
  // ── hosts ──────────────────────────────────────────────────────────────────
  {
    id: "c-web01", type: "computer", name: "CBE-WEB01", tier: 2, col: 3,
    flags: {},
    note: "Internet-facing web-farm node — admin control via svc-webapp.",
    noteAm: "ወደ በይነመረብ ተጋላጭ ዌብ-ፋርም ኖድ — በ svc-webapp ተቆጣጠረ።",
  },
  {
    id: "c-web02", type: "computer", name: "CBE-WEB02", tier: 2, col: 3,
    flags: {},
    note: "Second web-farm node (same over-privileged service account).",
    noteAm: "ሁለተኛ ዌብ-ፋርም ኖድ (በተመሳሳይ በተጣራ ሰርቪስ አካውንት)።",
  },
  {
    id: "c-app01", type: "computer", name: "CBE-APP01", tier: 1, col: 3,
    flags: {},
    note: "Core-banking app server: svc-webapp can RDP in, and — critically — Domain Admins hold interactive sessions here (tiering violation).",
    noteAm: "የዋናው ባንክ መተግበሪያ ሰርቨር፦ svc-webapp በ RDP ይገባል፣ እና — በአስቸኳይ — Domain Admins እዚህ ትርፊክ አላቸው (የደረጃ ጥሰት)።",
  },
  {
    id: "c-sql01", type: "computer", name: "CBE-SQL01", tier: 1, col: 3,
    flags: { unconstrainedDelegation: true },
    note: "Database host with unconstrained Kerberos delegation — caches credentials of anyone who authenticates to it, including the DC machine account.",
    noteAm: "የዳታቤዝ አስተናጋጅ ያልተገደበ Kerberos ልውውጥ አለው — የሚረጋገጡ ሁሉንም ማረጋገጫ ያከማቻል፣ የ DC ማሽን አካውንትን ጨምሮ።",
  },
  // ── tier-0 crown jewels ─────────────────────────────────────────────────────
  {
    id: "g-domain-admins", type: "group", name: "Domain Admins", tier: 0, col: 4,
    flags: { target: true },
    note: "Crown jewel: membership equals full domain control (DA credentials are cached on CBE-APP01).",
    noteAm: "ዋና ዒላማ፦ አባልነት ሙሉ የዶሜይን ቁጥጥር ነው (የ DA ማረጋገጫ በ CBE-APP01 ላይ ተቀምጧል)።",
  },
  {
    id: "u-ad-admin", type: "user", name: "ad.admin", tier: 0, col: 4,
    flags: {},
    note: "Domain Admin account with interactive logons on tier-1 servers (tier-0 hygiene failure).",
    noteAm: "የ Domain Admin አካውንት በከፍታ-1 ሰርቨሮች ላይ ትርፊክ አለው (የደረጃ-0 የጽድቅ ስንክታ)።",
  },
  {
    id: "c-dc01", type: "computer", name: "CBE-DC01", tier: 0, col: 4,
    flags: { target: true },
    note: "Primary Domain Controller — compromise of the host (via delegation cache or DA membership) is domain dominance: DCSync, Golden Ticket.",
    noteAm: "ዋናው Domain Controller — የአስተናጋጁ ሙሉ ቁጥጥር (በልውውጥ መሸጫ ወይም በ DA አባልነት) የዶሜይን የበላይነት ነው፦ DCSync፣ Golden Ticket።",
  },
];

export const AD_EDGES: AdEdge[] = [
  {
    from: "u-intern-dawit", to: "g-domain-users", type: "MemberOf",
    relation: "intern.dawit ∈ Domain Users",
    note: "Standard membership — grants authenticated-domain foothold.",
    noteAm: "መደበኛ አባልነት — የተረጋገጠ ዶሜይን መደራረብ ይሰጣል።",
  },
  {
    from: "u-payroll-marta", to: "g-domain-users", type: "MemberOf",
    relation: "payroll.marta ∈ Domain Users",
    note: "Standard membership — grants authenticated-domain foothold.",
    noteAm: "መደበኛ አባልነት — የተረጋገጠ ዶሜይን መደራረብ ይሰጣል።",
  },
  {
    from: "u-svc-webapp", to: "g-domain-users", type: "MemberOf",
    relation: "svc-webapp ∈ Domain Users",
    note: "Service account lives in the baseline group (not a dedicated low-priv group).",
    noteAm: "ሰርቪስ አካውንቱ በመነሻ ቡድን ውስጥ ነው (በተለየ ዝቅተኛ-መብት ቡድን አይደለም)።",
  },
  {
    from: "u-intern-dawit", to: "c-ws-42", type: "HasSession",
    relation: "intern.dawit logged on to CBE-WS-42",
    note: "Attacker holding the account controls the host and harvests whatever else runs there.",
    noteAm: "አካውንቱን የያዘ ጠቃቂ አስተናጋጁን ይቆጣጠራል እና በዚያ የሚሠራውን ሁሉ ይሰበስባል።",
  },
  {
    from: "u-payroll-marta", to: "c-ws-42", type: "HasSession",
    relation: "payroll.marta logged on to CBE-WS-42",
    note: "Shared workstation session — second entry's credentials also live here.",
    noteAm: "የጋራ ሥራ መስሪያ ሰሽን — የሁለተኛው መግቢያ ማረጋገጫም እዚህ ነው።",
  },
  {
    from: "c-ws-42", to: "g-it-helpdesk", type: "AdminCreds",
    relation: "IT Helpdesk has AdminTo CBE-WS-42 (admin logons)",
    note: "Helpdesk staff administer workstations with domain accounts — their credentials are cached on WS-42 and stealable by anyone controlling the host.",
    noteAm: "የሄልፕዴስክ ሠራተኞች በዶሜይን አካውንቶች ሥራ መስሪያዎችን ያስተዳድራሉ — ማረጋገጫቸው በ WS-42 ላይ ተቀምጧልና አስተናጋጁን በቆጣጠረ ማንኛውም ሊሰርቀው ይችላል።",
  },
  {
    from: "g-it-helpdesk", to: "u-svc-webapp", type: "ResetPassword",
    relation: "IT Helpdesk delegated ForceChangePassword over the service-account OU",
    note: "Password-reset overreach: anyone running helpdesk privileges can silently take over the web-farm service account.",
    noteAm: "የመቀየር በተጣራ፦ የሄልፕዴስክ መብት ያለው ማንኛውም የዌብ-ፋርም ሰርቪስ አካውንትን በርግጠኝነት ሊቀይረው ይችላል።",
  },
  {
    from: "g-domain-users", to: "u-svc-sql", type: "Kerberoast",
    relation: "svc-sql has an SPN (MSSQLSvc/CBE-SQL01) — TGS requestable by any authenticated user",
    note: "Kerberoasting: request the account's service ticket offline and crack its 900-day-old password.",
    noteAm: "Kerberoasting፦ የአካውንቱን የሰርቪስ ቲኬት ወስደህ የ900 ቀን ይለፍ ቃሉን ማፍራት።",
  },
  {
    from: "g-domain-users", to: "u-svc-webapp", type: "AsRepRoast",
    relation: "svc-webapp has DONT_REQ_PREAUTH set",
    note: "AS-REP roasting: no pre-authentication — an offline-crackable AS-REP is handed to any requester.",
    noteAm: "AS-REP roasting፦ ቅድመ-ማረጋገጥ የለም — ለማንኛውም ጠያቂ የሚተርፍ በአፍ-መጣሪያ የሚፈራው AS-REP ይሰጣል።",
  },
  {
    from: "u-svc-sql", to: "g-sql-admins", type: "MemberOf",
    relation: "svc-sql ∈ SQL Admins",
    note: "The roasted account carries SQL-tier administration rights.",
    noteAm: "የተፈራው አካውንት የ SQL-ደረጃ አስተዳደር መብት ይዟል።",
  },
  {
    from: "g-sql-admins", to: "c-sql01", type: "AdminTo",
    relation: "SQL Admins administer CBE-SQL01",
    note: "Group admin rights on the database host — full system control once membership is obtained.",
    noteAm: "ቡድን በዳታቤዝ አስተናጋጁ ላይ የአስተዳደር መብት — አባልነት ሲገኝ ሙሉ የሥርዓት ቁጥጥር።",
  },
  {
    from: "c-sql01", to: "c-dc01", type: "UnconstrainedDeleg",
    relation: "CBE-SQL01: unconstrained Kerberos delegation (TRUSTED_FOR_DELEGATION)",
    note: "Delegation abuse: cached DC credentials on SQL01 allow DCSync-style directory compromise.",
    noteAm: "የልውውጥ ማጣበቅ፦ በ SQL01 ላይ የተቀመጡ የ DC ማረጋገጫዎች DCSync ዓይነት የማውጫ ጥቃት ይፈቅዳሉ።",
  },
  {
    from: "u-svc-webapp", to: "c-web01", type: "AdminTo",
    relation: "svc-webapp administers CBE-WEB01 / CBE-WEB02",
    note: "Over-privileged service account: full admin on the internet-facing tier.",
    noteAm: "በተጣራ ሰርቪስ አካውንት፦ በበይነመረብ ተጋላጭ ደረጃ ላይ ሙሉ አስተዳደር።",
  },
  {
    from: "u-svc-webapp", to: "c-web02", type: "AdminTo",
    relation: "svc-webapp administers CBE-WEB01 / CBE-WEB02",
    note: "Same over-privilege replicated on the second web node.",
    noteAm: "ተመሳሳይ በተጣራ መብት በሁለተኛው ዌብ ኖድ ተመልሷል።",
  },
  {
    from: "u-svc-webapp", to: "c-app01", type: "CanRDP",
    relation: "svc-webapp holds Remote-Desktop-User rights on CBE-APP01",
    note: "RDP into the core-banking app tier with a roastable, over-privileged account.",
    noteAm: "በሚፈራ በተጣራ አካውንት ወደ ዋናው ባንክ መተግበሪያ ደረጃ RDP።",
  },
  {
    from: "u-ad-admin", to: "g-domain-admins", type: "MemberOf",
    relation: "ad.admin ∈ Domain Admins",
    note: "Dominance membership — the account itself is a crown jewel.",
    noteAm: "የየበላይነት አባልነት — አካውንቱ ራሱ ዋና ዒላማ ነው።",
  },
  {
    from: "u-ad-admin", to: "c-app01", type: "HasSession",
    relation: "ad.admin logged on to CBE-APP01",
    note: "Tier-0 violation: Domain Admin interactive logons on a tier-1 app server leave DA credentials cached there.",
    noteAm: "የደረጃ-0 ጥሰት፦ የ Domain Admin ትርፊክ በከፍታ-1 መተግበሪያ ሰርቨር ላይ የ DA ማረጋገጫ ቆይታ ይተዋል።",
  },
  {
    from: "c-app01", to: "g-domain-admins", type: "AdminCreds",
    relation: "Domain Admins hold interactive sessions on CBE-APP01",
    note: "Anyone controlling APP01 (e.g. via svc-webapp RDP) steals cached DA credentials → Domain Admin.",
    noteAm: "APP01ን የቆጣጠረ ማንኛውም (ለምሳሌ በ svc-webapp RDP) የተቀመጡትን የ DA ማረጋገጫ ይሰርቃል → Domain Admin።",
  },
  {
    from: "g-domain-admins", to: "c-dc01", type: "AdminTo",
    relation: "Domain Admins administer CBE-DC01",
    note: "Final hop: DA membership controls the Domain Controller — full domain dominance.",
    noteAm: "የመጨረሻ ምዕራፍ፦ የ DA አባልነት Domain Controllerን ይቆጣጠራል — ሙሉ የዶሜይን የበላይነት።",
  },
];
