/**
 * Adwa Cyber — AI Enhancement Lab (proposal Phase 3, Table 23).
 *
 * Six interactive tools that give the multilingual awareness platform its
 * "AI-enhanced" layer, each mapped to a curriculum unit and an audience
 * track (Table 22):
 *
 *   1. password      — AI password-strength checker with personalised
 *                      recommendations in Amharic (Table 23 #1)
 *   2. phishing      — AI classifier scored on real Ethiopian phishing
 *                      patterns for contextual training (Table 23 #2)
 *   3. sextortion    — scenario trainer built on INTERPOL's documented
 *                      East-Africa threat patterns (Table 23 #3)
 *   4. footprint     — data-exposure risk visualiser (Table 23 #4)
 *   5. flagging      — simulated content-moderation exercises using
 *                      real-world scenarios (Table 23 #5)
 *   6. report-guide  — interactive guide to reporting cybercrime with
 *                      Ethio-CERT and the police (Table 23 #6)
 *
 * Privacy-by-design: every engine in this file runs entirely on the
 * learner's device. Nothing typed into a tool is ever transmitted or
 * stored — the only network call the portal makes is an anonymous usage
 * ping (tool id + interface language, no personal data; see
 * AwarenessToolPing). Tool verdicts are instructional feedback, not graded
 * assessments, so unlike the RQ2 knowledge instrument there are no answer
 * keys to protect server-side.
 */

export type ToolId =
  | "password"
  | "phishing"
  | "sextortion"
  | "footprint"
  | "flagging"
  | "report-guide";

export type Audience = "KIDS" | "TEENS" | "PRO" | "AWARE";

export const AUDIENCE_LABELS: Record<Audience, { en: string; am: string }> = {
  KIDS: { en: "CyberSafe Kids · Grades 5–8", am: "የልጆች ደህንነት · ክፍል 5–8" },
  TEENS: { en: "CyberSmart Teens · Grades 9–12", am: "የወጣቶች ደህንነት · ክፍል 9–12" },
  PRO: { en: "CyberPro · University & College", am: "ሳይበርፕሮ · ዩኒቨርሲቲና ኮሌጅ" },
  AWARE: { en: "CyberAware · SME & Government staff", am: "ሳይበርአዌር · የግል ድርጅትና የመንግሥት ሠራተኞች" },
};

export interface ToolMeta {
  id: ToolId;
  nameEn: string;
  nameAm: string;
  descEn: string;
  descAm: string;
  icon: "key" | "radar" | "shield-alert" | "footprints" | "flag" | "siren";
  moduleCode: string | null; // mapped curriculum unit
  audiences: Audience[];
}

export const AWARENESS_TOOLS: ToolMeta[] = [
  {
    id: "password",
    nameEn: "Password Strength Checker",
    nameAm: "የይለፍ ቃል ጥንካሬ መለኪያ",
    descEn: "The AI analyser scores your password, finds weak patterns, and gives personalised advice in Amharic.",
    descAm: "የአርትፊሻል ኢንተለጀንስ ተንታኩ የይለፍ ቃልዎን ይመዝናል፣ ደካማ ንድፎችን ያገኛል፣ በአማርኛ ግላዊ ምክር ይሰጣል።",
    icon: "key",
    moduleCode: "AW-01",
    audiences: ["KIDS", "TEENS", "PRO", "AWARE"],
  },
  {
    id: "phishing",
    nameEn: "Phishing Radar",
    nameAm: "የፊሺንግ ራዳር",
    descEn: "Judge ten real-style Ethiopian messages, then see how the AI classifier reached its own verdict.",
    descAm: "አሥር የኢትዮጵያ ሁኔታ መልዕክቶችን ይፈርጁ፣ ከዚያ የአርትፊሻል ኢንተለጀንስ ክላሲፋየሩ የደረሰበትን ውሳኔ ይመልከቱ።",
    icon: "radar",
    moduleCode: "AW-02",
    audiences: ["KIDS", "TEENS", "PRO", "AWARE"],
  },
  {
    id: "sextortion",
    nameEn: "Sextortion Response Trainer",
    nameAm: "የስክስቶርሽን ምላሽ ልምምድ",
    descEn: "Walk through a safe, fictional scenario and practise the response steps INTERPOL recommends for East Africa.",
    descAm: "አደጋን የማያስከትል ምናባዊ ሁኔታ ተራርመው ኢንተርፖል ለምሥራቅ አፍሪካ የሚመክረውን የምላሽ እርምጃ ይለማመዱ።",
    icon: "shield-alert",
    moduleCode: "AW-09",
    audiences: ["TEENS", "AWARE"],
  },
  {
    id: "footprint",
    nameEn: "Digital Footprint Visualiser",
    nameAm: "የዲጂታል ዱካ መታያ",
    descEn: "Answer ten private questions and watch the AI tool visualise your own data-exposure risk.",
    descAm: "አሥር የግል ጥያቄዎችን መልሰው የመሣሪያው ተንታኝ የመረጃ ተጋላጭነትዎን ይመልከቱ።",
    icon: "footprints",
    moduleCode: "AW-10",
    audiences: ["TEENS", "PRO", "AWARE"],
  },
  {
    id: "flagging",
    nameEn: "Content Flagging Exercise",
    nameAm: "የይዘት ምልክት ልምምድ",
    descEn: "Simulated moderation feed: which posts are protected speech and which must be reported? Free speech vs harm.",
    descAm: "የተመሰረተ የመቆጣጠሪያ ልምምድ፦ የትኞቹ ልጥፎች የተጠበቀ ንግግር ናቸው? የትኞቹ ሪፖርት ይደረግላቸዋል?",
    icon: "flag",
    moduleCode: "AW-11",
    audiences: ["TEENS", "PRO", "AWARE"],
  },
  {
    id: "report-guide",
    nameEn: "Cybercrime Reporting Guide",
    nameAm: "የሳይበር ወንጀል ሪፖርት መመሪያ",
    descEn: "The AI guide triages what happened to you and builds a personalised reporting checklist for Ethiopia.",
    descAm: "መመሪያው የተከሰተውን ነገር ይመረምራልና ለኢትዮጵያ የተዘጋጀ ግላዊ የሪፖርት ዝርዝር ይሠራል።",
    icon: "siren",
    moduleCode: "AW-08",
    audiences: ["TEENS", "PRO", "AWARE"],
  },
];

export function toolById(id: string): ToolMeta | null {
  return AWARENESS_TOOLS.find((t) => t.id === id) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 — Password strength checker (Table 23 #1)
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordFinding {
  code: string;
  severity: "critical" | "warn" | "info" | "good";
  textEn: string;
  textAm: string;
}

export interface PasswordReport {
  score: number; // 0–100
  band: "very_weak" | "weak" | "fair" | "strong" | "very_strong";
  bandEn: string;
  bandAm: string;
  entropyBits: number;
  crackTimeEn: string;
  crackTimeAm: string;
  findings: PasswordFinding[];
  tipsEn: string[];
  tipsAm: string[];
}

/** Small high-frequency list (a sample of the most-broken passwords in
 * Ethiopian account-takeover cases; the full list lives server-side in the
 * compliance engine — this client copy is only for awareness feedback). */
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "123456789", "qwerty", "abc123", "letmein",
  "admin", "welcome", "iloveyou", "monkey", "dragon", "sunshine", "football",
  "ethiopia", "addis", "abebe", "kebede", "tesfaye", "selam", "habesha",
  "lili123", "hello123", "pass123", "1234qwer", "qazwsx", "1q2w3e4r",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

function hasSequentialRun(pw: string, minLen = 4): boolean {
  const s = pw.toLowerCase();
  for (let i = 0; i + minLen <= s.length; i++) {
    const run = s.slice(i, i + minLen);
    let asc = true;
    let desc = true;
    let kb = false;
    for (let j = 1; j < run.length; j++) {
      const d = run.charCodeAt(j) - run.charCodeAt(j - 1);
      if (d !== 1) asc = false;
      if (d !== -1) desc = false;
    }
    for (const row of KEYBOARD_ROWS) if (row.includes(run)) kb = true;
    if (asc || desc || kb) return true;
  }
  return false;
}

function hasRepeatRun(pw: string, minLen = 3): boolean {
  for (let i = 0; i + minLen <= pw.length; i++) {
    const seg = pw.slice(i, i + minLen);
    if ([...seg].every((c) => c === seg[0])) return true;
  }
  return false;
}

function crackTime(bits: number): { en: string; am: string } {
  // Offline attack assumption: 100 million guesses per second.
  const seconds = Math.pow(2, bits - 1) / 1e8;
  if (seconds < 1) return { en: "less than a second", am: "ከአንድ ሰከንድ ባነሰ ጊዜ" };
  const units: [number, string, string][] = [
    [60, "seconds", "ሰከንዶች"],
    [60, "minutes", "ደቂቃዎች"],
    [24, "hours", "ሰዓታት"],
    [365, "days", "ቀናት"],
    [100, "years", "ዓመታት"],
  ];
  let v = seconds;
  let labelEn = "years";
  let labelAm = "ዓመታት";
  for (const [div, en, am] of units) {
    labelEn = en;
    labelAm = am;
    if (v < div * 10) break;
    v = v / div;
  }
  const n = v >= 100 ? Math.round(v).toLocaleString("en-US") : Math.round(v).toString();
  if (labelEn === "years" && v >= 1_000_000) {
    return {
      en: "over a million years — practically unbreakable",
      am: "ከሚሊዮን ዓመት በላይ — በተግባር ሊሰበር አይችልም",
    };
  }
  return { en: `about ${n} ${labelEn}`, am: `ወደ ${n} ${labelAm} ገደማ` };
}

export function scorePassword(pwRaw: string): PasswordReport {
  const pw = pwRaw ?? "";
  const findings: PasswordFinding[] = [];
  if (!pw) {
    return {
      score: 0, band: "very_weak", bandEn: "Empty", bandAm: "ባዶ",
      entropyBits: 0, crackTimeEn: "—", crackTimeAm: "—",
      findings: [], tipsEn: ["Type a password to analyse."], tipsAm: ["ለመተንተን የይለፍ ቃል ይጻፉ።"],
    };
  }

  // Charset entropy (Shannon-style pool estimate)
  let pool = 0;
  const hasLower = /[a-z]/.test(pw), hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw), hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const hasAmharic = /[\u1200-\u137F]/.test(pw);
  if (hasLower) pool += 26;
  if (hasUpper) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSymbol) pool += 33;
  if (hasAmharic) pool += 345;
  let bits = pw.length * Math.log2(pool || 1);

  // Pattern penalties — the "AI" layer: recognise real-world weak patterns.
  let penalty = 0;
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    penalty += 55;
    findings.push({
      code: "common", severity: "critical",
      textEn: "This is one of the most frequently stolen passwords — attackers try it first.",
      textAm: "ይህ ከበይነገን በጣም የሚሰረቁ የይለፍ ቃላት አንዱ ነው — ጠላቾች መጀመሪያ እዚህ ላይ ይሞክራሉ።",
    });
  }
  const nameLike = /^(abebe|kebede|tesfaye|selam|habesha|ethiopia|addis|abraha|tigist|abebech)/i.test(pw);
  if (nameLike && pw.length <= 12) {
    penalty += 25;
    findings.push({
      code: "name", severity: "warn",
      textEn: "Contains an Ethiopian name or place — attackers guess names first. Add unrelated words.",
      textAm: "የኢትዮጵያ ስም ወይም ቦታ ይዟል — ጠላቾች መጀመሪያ ስሞችን ይሞክራሉ። ያልተዛመዱ ቃላትን ይጨምሩ።",
    });
  }
  if (hasSequentialRun(pw)) {
    penalty += 20;
    findings.push({
      code: "sequence", severity: "warn",
      textEn: "Contains a keyboard or alphabet run (like abcd or 1234) — easy to automate.",
      textAm: "የቁልፍ ሰሌዳ ወይም የፊደል ተከታይ ይዟል (እንደ abcd ወይም 1234) — በቀላሉ ሊገመት ይችላል።",
    });
  }
  if (hasRepeatRun(pw)) {
    penalty += 15;
    findings.push({
      code: "repeat", severity: "warn",
      textEn: "Repeats the same character (like aaa) — adds length but almost no strength.",
      textAm: "ተመሳሳይ ፊደል ይደግማል (እንደ aaa) — ርዝመት ይጨምራል ጥንካሬ ግን አይጨምርም።",
    });
  }
  const years = pw.match(/(19[6-9]\d|20[0-2]\d)/g);
  if (years) {
    penalty += 12;
    findings.push({
      code: "year", severity: "warn",
      textEn: "Contains a year — usually a birth year, and attackers know that.",
      textAm: "ዓመት ይዟል — ብዙውን ጊዜ የልደት ዓመት ነው፤ ጠላቮችም ይህን ያውቃሉ።",
    });
  }
  const phone = /(^|\D)(09\d{8}|9\d{8}|(\+251)?9\d{8})(\D|$)/.test(pw);
  if (phone) {
    penalty += 18;
    findings.push({
      code: "phone", severity: "warn",
      textEn: "Looks like a phone number — among the first things an attacker tries on Ethiopian accounts.",
      textAm: "የስልክ ቁጥር ይመስላል — ጠላቮች በኢትዮጵያ መለያዎች ላይ ከሚሞክሯቸው የመጀመሪያ ነገሮች አንዱ ነው።",
    });
  }
  if (pw.length < 8) {
    penalty += 25;
    findings.push({
      code: "short", severity: "critical",
      textEn: "Shorter than 8 characters — too small a space to search.",
      textAm: "ከ8 ፊደላት ያነሰ ነው — ለመፈለግ በጣም ትንሽ ቦታ ነው።",
    });
  }

  const classes = [hasLower, hasUpper, hasDigit, hasSymbol, hasAmharic].filter(Boolean).length;
  if (classes <= 1 && pw.length < 16) {
    penalty += 10;
    findings.push({
      code: "mono", severity: "info",
      textEn: "Only one kind of character — mix letters, numbers and symbols.",
      textAm: "አንድ ዓይነት ፊደል ብቻ ነው — ፊደላትን፣ ቁጥሮችንና ምልክቶችን ደባልቁ።",
    });
  }

  if (!findings.some((f) => f.code === "short") && pw.length >= 12) {
    findings.push({
      code: "len", severity: "good",
      textEn: "12+ characters — length is the single strongest thing you can add.",
      textAm: "12+ ፊደላት — ርዝመት ብቻውን ከሚጨምሩት ጥንካሬዎች ዋነኛው ነው።",
    });
  }
  if (classes >= 3) {
    findings.push({
      code: "mix", severity: "good",
      textEn: "Good mix of character types.",
      textAm: "የፊደል ዓይነቶች በሚገባ ተደባልቀዋል።",
    });
  }
  if (hasAmharic) {
    findings.push({
      code: "am", severity: "good",
      textEn: "Amharic characters greatly enlarge the search space — just do not use a famous phrase.",
      textAm: "የአማርኛ ፊደላት የፍለጋውን ቦታ በእጅጉ ያስተሏቸዋል — ነገር ግን ታዋቂ ሐረግ አይጠቀሙ።",
    });
  }

  const effBits = Math.max(0, bits - penalty);
  const score = Math.max(0, Math.min(100, Math.round((effBits / 80) * 100)));
  const band: PasswordReport["band"] =
    score < 25 ? "very_weak" : score < 50 ? "weak" : score < 70 ? "fair" : score < 85 ? "strong" : "very_strong";
  const bandNames: Record<PasswordReport["band"], [string, string]> = {
    very_weak: ["Very weak", "በጣም ደካማ"],
    weak: ["Weak", "ደካማ"],
    fair: ["Fair", "መካከለኛ"],
    strong: ["Strong", "ጠንካራ"],
    very_strong: ["Very strong", "በጣም ጠንካራ"],
  };
  const ct = crackTime(effBits);

  const tipsEn: string[] = [];
  const tipsAm: string[] = [];
  if (pw.length < 12) {
    tipsEn.push("Make it a passphrase of 4 unrelated words, e.g. Blue-Donkey-7-Coffee! — long and memorable.");
    tipsAm.push("አራት ያልተዛመዱ ቃላት ያድርጉት፣ ለምሳሌ Blue-Donkey-7-Coffee! — ረጅም ነገር ግን ቀላል ለማስታወስ።");
  }
  if (nameLike || years || phone || COMMON_PASSWORDS.has(pw.toLowerCase())) {
    tipsEn.push("Remove names, years and phone numbers — anything a stranger can learn about you.");
    tipsAm.push("ስሞችን፣ ዓመታትንና የስልክ ቁጥሮችን ያስወግዱ — ማንኛውም ሰው ስለዎ የሚያውቀውን ነገር።");
  }
  tipsEn.push("Use a different password for each important account — one leak must not open every door.");
  tipsAm.push("ለእያንዳንዱ አስፈላጊ መለያ የተለየ የይለፍ ቃል ይጠቀሙ — አንድ ግልጽነት ሁሉንም በሮች መክፈት የለበትም።");
  tipsEn.push("Turn on two-factor authentication (2FA) wherever it is offered — it protects you even if this password leaks.");
  tipsAm.push("የሁለት ደረጃ ማረጋገጫ (2FA) ቢሰጥ ያንብቡት — ይህ የይለፍ ቃል ቢወጣም ይጠብቃችኋል።");

  return {
    score, band,
    bandEn: bandNames[band][0], bandAm: bandNames[band][1],
    entropyBits: Math.round(effBits),
    crackTimeEn: ct.en, crackTimeAm: ct.am,
    findings, tipsEn, tipsAm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 — Phishing Radar (Table 23 #2)
// ─────────────────────────────────────────────────────────────────────────────

export const PHISH_FEATURES = [
  { code: "link_mismatch", weight: 30, en: "Displayed link hides a different real address", am: "የታየው አገናኝ የተለየ እውነተኛ አድራሻ ይደብቃል" },
  { code: "sender_mismatch", weight: 18, en: "Sender address does not match the brand it claims", am: "የመልኪያው አድራሻ ከሚል ብሎ የሚጠራው ድርጅት ጋር አይመሳሰልም" },
  { code: "otp_request", weight: 22, en: "Asks for an OTP / verification code", am: "የማረጋገጫ ኮድ (OTP) ይጠይቃል" },
  { code: "urgency", weight: 12, en: "Artificial urgency — act now or lose something", am: "ውሸታማ ፍጥነት — ወዲያውኑ አለመሆን ካጣህ" },
  { code: "money_lure", weight: 14, en: "Money lure — prize, refund or lottery in birr", am: "የገንዘብ ገሚሽ — በብር የሚሰጥ ሽልማት፣ ገንዘብ መመለስ ወይም ሎቶ" },
  { code: "generic_greeting", weight: 6, en: "Generic greeting instead of your name", am: "በስምዎ ፈንታ አጠቃላይ ሰላምታ" },
  { code: "info_request", weight: 18, en: "Requests password, PIN or national ID (Fayda) details", am: "የይለፍ ቃል፣ PIN ወይም የፋይዳ መለያ ቁጥር ይጠይቃል" },
  { code: "short_link", weight: 12, en: "Shortened link hides its destination", am: "አጭር አገናኝ መድረሻውን ይደብቃል" },
] as const;

export interface PhishSpecimen {
  id: number;
  channel: "SMS" | "EMAIL" | "CHAT";
  sender: string;
  subject: string;
  body: string;
  linkDisplay?: string;
  linkActual?: string;
  verdict: "PHISHING" | "LEGIT";
  hits: string[]; // feature codes present
  whyEn: string;
  whyAm: string;
}

/** Ten specimens modelled on documented Ethiopian campaigns (CBE telebirr
 * transfer scam pages, Ethio Telecom prize SMS, Fayda verification lures,
 * Dashen/telebirr OTP theft) and genuine service messages for contrast. */
export const PHISH_SPECIMENS: PhishSpecimen[] = [
  {
    id: 1,
    channel: "SMS",
    sender: "+251 91 234 5678",
    subject: "SMS",
    body: "Dear customer, your CBE account will be BLOCKED today. Verify now: cbe.com.et-verify.net/login",
    linkDisplay: "cbe.com.et-verify.net/login",
    linkActual: "cbe.com.et-verify.net/login",
    verdict: "PHISHING",
    hits: ["sender_mismatch", "urgency", "generic_greeting", "link_mismatch"],
    whyEn: "The real domain is cbe.com.et — anything bolted on (com.et-verify.net) is a lookalike. Banks never warn of blocking by SMS with a link.",
    whyAm: "እውነተኛው ገጽታ cbe.com.et ነው — የተጣበቀው ማንኛውም (com.et-verify.net) ተመሳሳይ ማስመሰያ ነው። ባንኮች በኤስኤምኤስ አገናኝ ሰጥተው ስለ መታገድ አይመልምምም።",
  },
  {
    id: 2,
    channel: "SMS",
    sender: "CBE",
    subject: "SMS",
    body: "You received 2,500.00 ETB from TIGIST BEKELE on account 1**33. Bal: 8,120.55 ETB. Ref: PP23110488.",
    verdict: "LEGIT",
    hits: [],
    whyEn: "A transaction notification states facts, uses no urgency, and asks nothing from you. Genuine bank SMS style has no link to click.",
    whyAm: "የግብይት ማሳወቂያ እውነታን ይናገራል፣ ፍጥነት አይጠቀምም፣ ምንም አይጠይቅም። እውነተኛ የባንክ ኤስኤምኤስ ለመጫን አገናኝ አይዟል።",
  },
  {
    id: 3,
    channel: "EMAIL",
    sender: "no-reply@ethiotelecom-promo.info",
    subject: "Congratulations! You won 25,000 Birr",
    body: "Dear customer, Ethio Telecom selected your number in the monthly draw. Send 300 Birr telebirr fee to 09xxxxxxx to claim within 24 hours.",
    verdict: "PHISHING",
    hits: ["sender_mismatch", "money_lure", "urgency", "generic_greeting"],
    whyEn: "Prize plus advance fee plus deadline — the classic advance-fee shape. The sender domain (ethiotelecom-promo.info) is not ethiotelecom.et.",
    whyAm: "ሽልማት፣ የቅድሚያ ክፍያና ጊዜያዊ ገደብ — የተለመደው የቅድሚያ ክፍያ ማታለል ነው። የመልኪያው ገጽታ ethiotelecom.et አይደለም።",
  },
  {
    id: 4,
    channel: "EMAIL",
    sender: "security@dashenbank.et",
    subject: "New login to your Dashen mobile app",
    body: "A new device signed in to your account from Addis Ababa. If this was you, no action is needed. To review devices, open the app: Menu → Security → Devices.",
    verdict: "LEGIT",
    hits: [],
    whyEn: "It states a fact, asks nothing, and sends you into the official app you already have instead of a link.",
    whyAm: "እውነታን ይናገራል፣ ምንም አይጠይቅም፣ ወደ አገናኝ ፈንታ ቀድሞ ወዳለው ይፋዊ መተግበሪያ ይመራዎታል።",
  },
  {
    id: 5,
    channel: "CHAT",
    sender: "tel:+251911223344 (saved as 'telebirr Support')",
    subject: "Chat message",
    body: "Hello! telebirr here. We are upgrading your wallet. What is the OTP we just sent you? Reply quickly so your money is not frozen.",
    verdict: "PHISHING",
    hits: ["otp_request", "urgency", "sender_mismatch"],
    whyEn: "No real service will ever ask for your OTP. The threat of freezing is pressure to make you send the code that empties your wallet.",
    whyAm: "እውነተኛ አገልግሎት በጭራሽ የማረጋገጫ ኮድዎን አይጠይቅም። የመቀዠቅዠት ማስፈራራት የውሂብ ዋሌትዎን ለማስወጣት የሚያሳድደው ጫና ነው።",
  },
  {
    id: 6,
    channel: "EMAIL",
    sender: "hr@yourcompany.com.et",
    subject: "Salary adjustment — action required",
    body: "Dear staff, please confirm your bank details for the new salary system before Friday. Log in with your employee ID and password here: http://bit.ly/hr-verify-et",
    verdict: "PHISHING",
    hits: ["short_link", "info_request", "urgency"],
    whyEn: "The short link hides its destination and the page wants your password. Real HR uses the internal portal, never a bit.ly.",
    whyAm: "አጭሩ አገናኝ መድረሻውን ይደብቃል፤ ገጹም የይለፍ ቃልዎን ይፈልጋል። እውነተኛ HR የውስጥ መድረክ ይጠቀማል፣ bit.ly በጭራሽ አይደለም።",
  },
  {
    id: 7,
    channel: "SMS",
    sender: "Fayda",
    subject: "SMS",
    body: "Your Fayda ID verification expires in 3 days. Use the official Fayda app or visit https://id.gov.et to update.",
    verdict: "LEGIT",
    hits: [],
    whyEn: "The domain is the genuine government domain and the message directs you to official channels — no code or PIN is requested.",
    whyAm: "ገጽታው እውነተኛ የመንግሥት ገጽታ ነው፤ መልዕክቱም ወደ ይፋዊ ቦታ ይመራዎታል — ኮድ ወይም PIN አይጠየቅም።",
  },
  {
    id: 8,
    channel: "EMAIL",
    sender: "billing@ethio-telecom-bill.com",
    subject: "Unpaid internet bill — disconnection today 6 PM",
    body: "Dear Valued Customer, your internet will be disconnected today at 6 PM due to unpaid 1,240 Birr. Pay now: https://pay.ethio-telecom-bill.com/et",
    verdict: "PHISHING",
    hits: ["sender_mismatch", "urgency", "generic_greeting", "money_lure", "link_mismatch"],
    whyEn: "ethio-telecom-bill.com is not Ethio Telecom's domain (ethiotelecom.et). Real disconnection notices come with your account details and never demand same-day click-payment.",
    whyAm: "ethio-telecom-bill.com የኢትዮ ቴሌኮም ገጽታ (ethiotelecom.et) አይደለም። እውነተኛ የመቁረጥ ማሳወቂያ የሂሳብዎን ዝርዝር ይዟል፤ በዚያው ቀን እንዲከፍሉ አይገፋፋም።",
  },
  {
    id: 9,
    channel: "CHAT",
    sender: "Facebook friend 'Meron T.' (account created last week)",
    subject: "Chat message",
    body: "Hi! I am stranded in Adama — my phone is lost. Please send me 3,000 birr via telebirr to this number until I get home. I will pay you back tomorrow!",
    verdict: "PHISHING",
    hits: ["urgency", "money_lure", "sender_mismatch"],
    whyEn: "Account-takeover of a friend's account. Verify by calling your friend on a number you already have before any money moves.",
    whyAm: "የጓደኛዎ መለያ ተወርዶበታል። ገንዘብ ከመላክዎ በፊት ቀድሞ ባለው ቁጥር ደውለው ያረጋግጡ።",
  },
  {
    id: 10,
    channel: "EMAIL",
    sender: "noreply@adwacyber.et",
    subject: "Your monthly security digest",
    body: "Hello, your platform digest is ready. Summary: 3 overdue findings, 1 SLA breach. Sign in from the login page you always use — we never include a direct sign-in link in digest mail.",
    verdict: "LEGIT",
    hits: [],
    whyEn: "Facts, no urgency, no link, and an explicit policy that security mail carries no sign-in links.",
    whyAm: "እውነታዎች፣ ያለ ፍጥነት፣ ያለ አገናኝ — ደህንነት መልዕክት የመግቢያ አገናኝ እንደማይይዝ በግልጽ የተጻፈ ፖሊሲ።",
  },
];

export function phishiness(specimen: PhishSpecimen): number {
  const total = specimen.hits.reduce((s, code) => {
    const f = PHISH_FEATURES.find((x) => x.code === code);
    return s + (f ? f.weight : 0);
  }, 0);
  return Math.min(100, total);
}

export const PHISH_DECISION_THRESHOLD = 40;

/** The transparent classifier: phishiness score ≥ threshold → PHISHING. */
export function classifySpecimen(specimen: PhishSpecimen): "PHISHING" | "LEGIT" {
  return phishiness(specimen) >= PHISH_DECISION_THRESHOLD ? "PHISHING" : "LEGIT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — Sextortion response trainer (Table 23 #3)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScenarioChoice {
  textEn: string;
  textAm: string;
  outcome: "safe" | "risky" | "unsafe";
  feedbackEn: string;
  feedbackAm: string;
}

export interface ScenarioStep {
  id: string;
  narrativeEn: string;
  narrativeAm: string;
  choices: ScenarioChoice[];
}

export interface ScenarioData {
  introEn: string;
  introAm: string;
  steps: ScenarioStep[];
  protocolEn: string[];
  protocolAm: string[];
}

/** Built on INTERPOL's East-Africa pattern documentation: an online
 * "friend" moves fast to private channels, requests an intimate image,
 * then demands money — and victims who pay are extorted again. The story
 * is deliberately third-person ("Tigist", a fictional 15-year-old) so no
 * learner is asked to imagine themselves in the situation. */
export const SEXTORTION_SCENARIO: ScenarioData = {
  introEn:
    "This is a training story about Tigist, a fictional 15-year-old student in Addis Ababa. You will choose what she does at three moments. Nothing you type is saved. The pattern you will recognise is documented by INTERPOL across East Africa.",
  introAm:
    "ይህ ስለ ጥቅልል ተብሎ ስም የተሰየመች በአዲስ አበባ አንድ 15 ዓመት ተማሪት የሆነች ጥግስት የልምምድ ታሪክ ነው። በሦስት ወቅቶች ምትሠራውን ትመርጣላችሁ። የጻፋችሁት ምንም አይቀመጥም። የምታዩት ንድፍ በምሥራቅ አፍሪካ በኢንተርፖል ተመዝግቦ የተገኘ ነው።",
  steps: [
    {
      id: "s1",
      narrativeEn:
        "A profile called 'Nati·addis❤️' follows Tigist. He says he is 16, loves the same music, and quickly writes: 'You seem different. Let's chat privately — send me your number?'",
      narrativeAm:
        "የሚባል 'ናቲ·አዲስ❤️' የመለያ ባለቤት ጥግስትን ይከተላል። 16 ዓመት እንደሆነ፣ ተመሳሳይ ሙዚቃ እንደሚወድ እና በፍጥነት፦ 'ከሌሎች የተለየች ትመስላለች። በግል እንነጋገር — ቁጥርሽን ልውውጥ?' ይላል።",
      choices: [
        {
          textEn: "Stay in the app chat and keep it light; no phone number.",
          textAm: "በመተግበሪያው ውስጥ ቆይታ መያዝን ቀጥል፤ የስልክ ቁጥር አትስጠው።",
          outcome: "safe",
          feedbackEn:
            "Strong move. A stranger pushing to move to private channels within hours is following a script. Staying on-platform keeps chat history inside a service Tigist can report to.",
          feedbackAm:
            "ጠንካራ ምርጫ። ያልታወቀ ሰው በሰዓታት ውስጥ ወደ ግል ውይይት የሚገፋፋ ቅድመ-ዝግጅት አለው። በመድረኩ ላይ መቆየት የውይይት ታሪኩን ለሪፖርት በሚቻልበት አገልግሎት ይቆያል።",
        },
        {
          textEn: "Share the number — he is just being friendly.",
          textAm: "ቁጥሩን ስጠው — ወዳጅነት እየሠራ ነውና።",
          outcome: "risky",
          feedbackEn:
            "Slower, please. Groomers build trust fast then use private channels where nobody can see the pressure. Tigist cannot yet know who is really behind the profile.",
          feedbackAm:
            "በዘመዱ ሂድ። የሚያሳምኑ ሰዎች በፍጥነት እምነት ይገነባሉ፣ ከዚያ ማንም ባይታይበት ግል ገበታ ላይ ጫና ያሳድራሉ። ጥግስት መለያው ጀርባ ማን እንዳለ ገና ማወቅ አትችልም።",
        },
        {
          textEn: "Send the number plus her full name and school so he can find her.",
          textAm: "ቁጥሩን ከሙሉ ስሟና ትምህርት ቤታቸው ጋር ስጠው።",
          outcome: "unsafe",
          feedbackEn:
            "Stop. A stranger now holds her number, name and school — everything needed to appear credible to her friends and to pressure her later. Identity details never go to new online contacts.",
          feedbackAm:
            "አቁም። አሁን እንግዳው ቁጥሯን፣ ስሟንና ትምህርት ቤታን ያዘ — ለጓደኞቿ ታማኝ ብሎ ለመታየትና በኋላ ለማፈራት የሚያስፈልግ ሁሉ። የማንነት ዝርዝር ለአዲስ የመስመር ላይ እውቂያዎች በጭራሽ አይሄድም።",
        },
      ],
    },
    {
      id: "s2",
      narrativeEn:
        "Weeks of compliments, then suddenly: 'Send me one private photo. I sent you mine (he did not). If you really trust me, you would.'",
      narrativeAm:
        "ሳምንታት የእንክብካቤ ቃላት፣ ከዚያ በድንት፦ 'አንድ የግል ፎቶ ስጬኝ። እኔ የኔን ልልክልሽ (አልላከም)። እውነተኛ እምነት ብታሳይሽ ታደርጊው ነበር።'",
      choices: [
        {
          textEn: "Refuse clearly and say she is not comfortable; keep evidence of the request.",
          textAm: "በግልጽ አትቀበልም ብላ ትናገራለች፤ የጥያቄውን ማስረጃ ትይዛለች።",
          outcome: "safe",
          feedbackEn:
            "Exactly right. No real friend trades trust for images. Keeping screenshots (with date and username visible) means that if pressure continues, she can show adults and the platform exactly what happened.",
          feedbackAm:
            "በትክክል። እውነተኛ ጓደኛ እምነትን በምስል አይለያይም። (ቀንና የተጠቃሚ ስም በሚታይበት) ቅጽበታዊ ምስሎችን ማቆየት ጫና ቢቀጥል ለአዋቂዎችና ለመድረኩ በትክክል ማሳየት እንደምትችል ያደርጋታል።",
        },
        {
          textEn: "Refuse but delete the whole conversation immediately.",
          textAm: "ታትቀበልም፣ ግን መላውን ውይይት ወዲያውኑ ትሰርዛለች።",
          outcome: "risky",
          feedbackEn:
            "Refusing is right; deleting is not. Evidence is what lets adults, the platform and the police act. Delete nothing until a trusted adult says so.",
          feedbackAm:
            "አለመቀበል ትክክል ነው፤ መሰረዝ ግን አይደለም። ማስረጃ ነው አዋቂዎችን፣ መድረኩንና ፖሊስን እንዲሠሩ የሚያስችለው። አዋቂ እስኪልህ ድረስ ምንም አትሰርዝ።",
        },
        {
          textEn: "Send the photo — he seems kind and she does not want to lose the friendship.",
          textAm: "ፎቶውን ትልከለታለች — ወዳጅነቱን ስትረብሽ አትፈልግምና።",
          outcome: "unsafe",
          feedbackEn:
            "This is the moment INTERPOL's warning is about: after receiving an image, extortionists immediately demand money and threaten to send it to family and classmates — and victims who pay are demanded from again. No image should ever leave her phone.",
          feedbackAm:
            "የኢንተርፖል ማስጠንቀቂያ የሚመለከተው ይህን ጊዜ ነው፦ ምስል ከተላከ በኋላ ጠባቂዎች ወዲያውኑ ገንዘብ ይጠይቃሉ፣ ለቤተሰብና ለክፍል ተማሪዎች ልኮ እንደሚያስፈራሩ ያስፈራሉ — የከፈሉም ተማሪዎች ደግሞ ይጠየቃሉ። ምስል ከስልኳ በፍጹም አይወጣም።",
        },
      ],
    },
    {
      id: "s3",
      narrativeEn:
        "The account writes: 'I have your photo. Send 15,000 birr by telebirr tonight or I send it to your school group.' Tigist is frozen with fear. What should she do FIRST?",
      narrativeAm:
        "መለያው ይጻፋል፦ 'ፎቶሽ አለኝ። ዛሬ ማታ 15,000 ብር በቴሌብር ስይዪ ወይም ለትምህርት ቤት ቡድን እልካለሁ።' ጥግስት በፍርሃት ተስተናግዳለች። በመጀመሪያ ምትሠራው ምንድን ነው?",
      choices: [
        {
          textEn: "Pay quietly — then he will delete it and this ends.",
          textAm: "በስብዓት ትከፍላለች — ከዚያ ይሰርዘዋል፣ ጉዳዩም ያበቃል።",
          outcome: "unsafe",
          feedbackEn:
            "INTERPOL's documented pattern: paying never ends it. Extortionists keep the image and demand more — often escalating amounts — because payment proves the threat works.",
          feedbackAm:
            "የኢንተርፖል መዝገብ፦ መክፈል በጭራሽ አያበቃውም። ጠባቂዎች ምስሉን ይዘው ደግሞ ይጠይቃሉ — እየጨመረ የሚሄድ መጠን — ክፍያው ማስፈራቱ እንደሚሠራ ማረጋገጫ ስለሆነ።",
        },
        {
          textEn: "Block him first, then decide alone what to do.",
          textAm: "መጀመሪያ ትከለክለዋለች፣ ከዚያ ብቻዋን ምትሠራ ትወስናለች።",
          outcome: "risky",
          feedbackEn:
            "Blocking stops the pressure for a moment but destroys the evidence trail and leaves her alone. This is too heavy to carry alone — adults must be brought in immediately.",
          feedbackAm:
            "መከልከል ጫናውን ለአፍታ ያቆማል፣ ግን ማስረጃውን ያጠፋልና ብቻዋን ትተታለች። ይህ ብቻዋን የሚተወው አይደለም — አዋቂዎች ወዲያውኑ መሳተፍ አለባቸው።",
        },
        {
          textEn: "Stop replying, keep every message and the account name, tell a trusted adult today, and report to the platform, police and Ethio-CERT.",
          textAm: "መመለስን አቁም፣ ሁሉንም መልዕክትና የመለያ ስም ያዝ፣ ዛሬ ለሚታመን አዋቂ ንገር፣ ወደ መድረኩ፣ ፖሊስና ኢትዮ-ሴርት ሪፖርት አድርግ።",
          outcome: "safe",
          feedbackEn:
            "This is the protocol. Silence (not negotiation), evidence, a trusted adult, then formal reports — the platform can suspend the account, the police can trace the telebirr number, and Ethio-CERT coordinates cases like this nationally. Tigist is a victim of a crime, never the one at fault.",
          feedbackAm:
            "ይህ ስምምነታዊ እርምጃ ነው። ጸጥታ (ያለ ድርድር)፣ ማስረጃ፣ የሚታመን አዋቂ፣ ከዚያ መደበኛ ሪፖርት — መድረኩ መለያውን ማገድ ይችላል፣ ፖሊስ የቴሌብር ቁጥሩን መከታተል ይችላል፣ ኢትዮ-ሴርትም እንዲህ ያሉ ጉዳዮችን በብሔር ደረጃ ያስተባብራል። ጥግስት የወንጀል መሳዋ ናት፣ በድል የሚደረግበት ግን በፍጹም አይደለም።",
        },
      ],
    },
  ],
  protocolEn: [
    "STOP — stop replying. Never negotiate and never pay; payment invites the next demand.",
    "PRESERVE — keep messages, the account name, numbers and payment details. Do not delete anything.",
    "TELL — tell a trusted adult today. Being a victim of a crime is never your fault.",
    "REPORT — report the account inside the app, then to the police (cybercrime desk) and to Ethio-CERT.",
    "SECURE — change passwords, enable 2FA, and tighten privacy settings on every account.",
  ],
  protocolAm: [
    "አቁም — መመለስን አቁም። በጭራሽ አትድረድርና አትክፈል፤ ክፍያ ቀጣይን ጥያቄ ይጋብዛል።",
    "ጠብቅ — መልዕክቶችን፣ የመለያ ስምን፣ ቁጥሮችንና የክፍያ ዝርዝርን ያዝ። ምንም አትሰርዝ።",
    "ንገር — ዛሬ ለሚታመን አዋቂ ንገር። የወንጀል መሳዋ መሆን በፍጹም የአንተ ስህተት አይደለም።",
    "ሪፖርት አድርግ — መለያውን በመተግበሪያው ውስጥ ሪፖርት አድርግ፣ ከዚያ ለፖሊስ (የሳይበር ወንጀል ክፍል) እና ለኢትዮ-ሴርት።",
    "አስተናግድ — የይለፍ ቃላትን ቀይር፣ 2FA አንቃ፣ በሁሉም መለያዎች የግላዊነት ማስተካከያዎችን ጠብቅ።",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4 — Digital footprint visualiser (Table 23 #4)
// ─────────────────────────────────────────────────────────────────────────────

export type FootprintCategory = "exposure" | "accounts" | "sharing" | "network";

export const FOOTPRINT_CATEGORIES: Record<FootprintCategory, { en: string; am: string }> = {
  exposure: { en: "Public exposure", am: "ይፋዊ ተጋላጭነት" },
  accounts: { en: "Account safety", am: "የመለያ ደህንነት" },
  sharing: { en: "Sharing habits", am: "የማጋራት ልማዶች" },
  network: { en: "Network & devices", am: "ኔትወርክና መሣሪያዎች" },
};

export interface FootprintQuestion {
  id: string;
  category: FootprintCategory;
  qEn: string;
  qAm: string;
  options: { textEn: string; textAm: string; points: number }[]; // 0 = safest … 3 = riskiest
}

export const FOOTPRINT_QUESTIONS: FootprintQuestion[] = [
  {
    id: "f1", category: "exposure",
    qEn: "Who can see your social media profiles?",
    qAm: "የማህበራዊ ሚዲያ መገለጫዎን ማየት የሚችለው ማን ነው?",
    options: [
      { textEn: "Only people I approve", textAm: "የገለጹት ሰዎች ብቻ", points: 0 },
      { textEn: "Friends of friends", textAm: "የጓደኞቼ ጓደኞች", points: 2 },
      { textEn: "Everyone / public", textAm: "ሁሉም ሰው / ይፋዊ", points: 3 },
      { textEn: "I am not sure", textAm: "አልአውቅም", points: 2 },
    ],
  },
  {
    id: "f2", category: "exposure",
    qEn: "Is your phone number or birth date visible anywhere public (bio, posts, directory)?",
    qAm: "የስልክ ቁጥርዎ ወይም የልደት ቀንዎ በየትም ይፋዊ ቦታ ታይቷል?",
    options: [
      { textEn: "No, neither", textAm: "አይ፣ ሁለቱም አይደሉም", points: 0 },
      { textEn: "Only the birth date", textAm: "የልደት ቀኑ ብቻ", points: 1 },
      { textEn: "Only the phone number", textAm: "የስልክ ቁጥሩ ብቻ", points: 2 },
      { textEn: "Both are public", textAm: "ሁለቱም ይፋዊ ናቸው", points: 3 },
    ],
  },
  {
    id: "f3", category: "exposure",
    qEn: "Do your posts reveal where you live or study (school name, compound, street)?",
    qAm: "ልጥፎችዎ የሚኖሩበትን ወይም የሚማሩበትን ቦታ ይገልጻሉ (የትምህርት ቤት ስም፣ የመኖሪያ አካባቢ)?",
    options: [
      { textEn: "Never", textAm: "በጭራሽ", points: 0 },
      { textEn: "Rarely, and I remove tags", textAm: "በጣም በአልፎ አልፎ፣ ማስታወሻዎችንም አጠፋለሁ", points: 1 },
      { textEn: "Sometimes", textAm: "አንዳንዴ", points: 2 },
      { textEn: "Often — my school uniform/posts make it obvious", textAm: "ብዙ ጊዜ — የትምህርት ቤት ልብሴ/ልጥፎቼ ግልጽ ያደርጉታል", points: 3 },
    ],
  },
  {
    id: "f4", category: "accounts",
    qEn: "Do you use the same password on more than one important account?",
    qAm: "ከአንድ በላይ አስፈላጊ መለያዎች ላይ ተመሳሳይ የይለፍ ቃል ይጠቀማሉ?",
    options: [
      { textEn: "No — every important account is unique", textAm: "አይ — እያንዳንዱ አስፈላጊ መለያ የተለየ ነው", points: 0 },
      { textEn: "Two or three share one", textAm: "ሁለት ወይም ሦስት አንድ ይጋራሉ", points: 2 },
      { textEn: "One password everywhere", textAm: "በሁሉም ቦታ አንድ የይለፍ ቃል", points: 3 },
      { textEn: "I am not sure", textAm: "አልአውቅም", points: 2 },
    ],
  },
  {
    id: "f5", category: "accounts",
    qEn: "Is two-factor authentication (2FA) turned on for your main email and social accounts?",
    qAm: "ለዋና ኢሜይልዎና ማህበራዊ መለያዎች የሁለት ደረጃ ማረጋገጫ (2FA) አብራታል?",
    options: [
      { textEn: "Yes, on all of them", textAm: "አዎ፣ በሁሉም ላይ", points: 0 },
      { textEn: "On email only", textAm: "በኢሜይል ብቻ", points: 1 },
      { textEn: "No", textAm: "አይ", points: 3 },
      { textEn: "I do not know what 2FA is", textAm: "2FA ምን እንደሆነ አልአውቅም", points: 3 },
    ],
  },
  {
    id: "f6", category: "accounts",
    qEn: "Can you list which apps and sites currently have access to your social accounts?",
    qAm: "አሁን የትኞቹ መተግበሪያዎችና ጣቢያዎች ለማህበራዊ መለያዎ መዳረሻ እንዳላቸው መዘርዘር ይችላሉ?",
    options: [
      { textEn: "Yes, I reviewed them recently", textAm: "አዎ፣ በቅርብ ጊዜ ገምግሜያለሁ", points: 0 },
      { textEn: "Roughly", textAm: "በግምት", points: 1 },
      { textEn: "No idea", textAm: "ምንም ሃሳብ የለኝም", points: 3 },
      { textEn: "I never connect apps to my accounts", textAm: "መተግበሪያዎችን ከመለያዬ ጋር በጭራሽ አያጥምም", points: 0 },
    ],
  },
  {
    id: "f7", category: "sharing",
    qEn: "When you post a photo, is location tagging on?",
    qAm: "ፎቶ ሲያስቀምጡ የቦታ ምልክት (location tag) የብራታ ነው?",
    options: [
      { textEn: "I turn it off every time", textAm: "እያንዳንድ ጊዜ አጠፋዋለሁ", points: 0 },
      { textEn: "Off for home/school, on elsewhere", textAm: "ለቤት/ትምህርት ቤት ዝግቶ፣ ሌላ ቦታ በራታል", points: 1 },
      { textEn: "Usually on", textAm: "ብዙ ጊዜ በራታል", points: 3 },
      { textEn: "I do not know how to check", textAm: "እንዴት መመልከት እንደምችል አልአውቅም", points: 2 },
    ],
  },
  {
    id: "f8", category: "sharing",
    qEn: "A stranger with a nice profile asks to be your friend. You…",
    qAm: "ቆንጆ መገለጫ ያለው እንግዳ ጓደኛ እንዲሆን ይጠይቅዎታል። እርስዎ…",
    options: [
      { textEn: "Ignore or decline — I only accept people I know", textAm: "ችላ እለዋለሁ ወይም አልቀበለውም — የምወዳቸውን ብቻ እቀበላለሁ", points: 0 },
      { textEn: "Accept after checking mutual friends", textAm: "የጋራ ጓደኞችን ከመረመርኩ በኋላ እቀበላለሁ", points: 1 },
      { textEn: "Accept — more friends is fine", textAm: "እቀበላለሁ — ብዙ ጓደኛ መሆን ጥሩ ነው", points: 3 },
      { textEn: "Accept and share my number in chat", textAm: "እቀበላለሁና ቁጥሬን በውይይት እለጣለሁ", points: 3 },
    ],
  },
  {
    id: "f9", category: "network",
    qEn: "On public Wi-Fi (café, airport, campus), what do you do?",
    qAm: "በይፋዊ ዋይፋይ (ካፌ፣ አውሮፕላን ማረፊያ፣ ካምፓስ) ላይ ምን ያደርጋሉ?",
    options: [
      { textEn: "Avoid sensitive logins; use mobile data for banking", textAm: "አስፈላጊ መግቢያዎችን አስወግዳለሁ፤ ለባንክ የሞባይል ዳታ እጠቀማለሁ", points: 0 },
      { textEn: "Browse but never log in", textAm: "አስተናግዳለሁ ግን አልገባም", points: 1 },
      { textEn: "Log in to everything — it is free internet", textAm: "ወደ ሁሉም እገባለሁ — ነፃ ኢንተርኔት ነውና", points: 3 },
      { textEn: "I do not use public Wi-Fi at all", textAm: "ይፋዊ ዋይፋይ በፍጹም አይጠቀምም", points: 0 },
    ],
  },
  {
    id: "f10", category: "network",
    qEn: "Your phone's screen lock and updates:",
    qAm: "የስልክዎ የስክሪን ቁልፍና ዝማኔዎች፦",
    options: [
      { textEn: "Fingerprint/PIN + auto updates on", textAm: "የአሻራ/PIN + ራስ-ሰር ዝማኔ በራታል", points: 0 },
      { textEn: "PIN only, updates manual", textAm: "PIN ብቻ፣ ዝማኔ በእጅ", points: 1 },
      { textEn: "No lock screen", textAm: "የስክሪን ቁልፍ የለም", points: 3 },
      { textEn: "Swipe pattern visible from screen smudges", textAm: "የመንሸራተት ስርዓቱ ከስክሪን አፈር ይታያል", points: 2 },
    ],
  },
];

export interface FootprintResult {
  risk: number; // 0–100 overall (higher = riskier)
  band: "low" | "moderate" | "elevated" | "high";
  bandEn: string;
  bandAm: string;
  categories: { category: FootprintCategory; score: number }[];
  tipsEn: string[];
  tipsAm: string[];
}

export function scoreFootprint(answers: Record<string, number>): FootprintResult {
  const catScores: Record<FootprintCategory, { sum: number; n: number }> = {
    exposure: { sum: 0, n: 0 }, accounts: { sum: 0, n: 0 }, sharing: { sum: 0, n: 0 }, network: { sum: 0, n: 0 },
  };
  for (const q of FOOTPRINT_QUESTIONS) {
    const idx = answers[q.id];
    if (idx === undefined || idx < 0 || idx >= q.options.length) continue;
    catScores[q.category].sum += q.options[idx].points;
    catScores[q.category].n += 1;
  }
  const categories = (Object.keys(catScores) as FootprintCategory[]).map((c) => ({
    category: c,
    score: catScores[c].n > 0 ? Math.round((catScores[c].sum / (catScores[c].n * 3)) * 100) : 0,
  }));
  const answered = Object.values(catScores).reduce((s, c) => s + c.n, 0);
  const risk = answered === 0 ? 0 : Math.round((categories.reduce((s, c) => s + c.score, 0) / categories.length));

  const band: FootprintResult["band"] =
    risk < 25 ? "low" : risk < 50 ? "moderate" : risk < 75 ? "elevated" : "high";
  const bandNames: Record<FootprintResult["band"], [string, string]> = {
    low: ["Low exposure", "ዝቅተኛ ተጋላጭነት"],
    moderate: ["Moderate exposure", "መካከለኛ ተጋላጭነት"],
    elevated: ["Elevated exposure", "ከፍተኛ ተጋላጭነት"],
    high: ["High exposure", "በጣም ከፍተኛ ተጋላጭነት"],
  };

  const tipsEn: string[] = [];
  const tipsAm: string[] = [];
  const worst = [...categories].sort((a, b) => b.score - a.score).slice(0, 2);
  const tipBank: Record<FootprintCategory, [string, string]> = {
    exposure: [
      "Set every profile to private and remove your phone number and birth date from bios — strangers do not need them.",
      "እያንዳንዱን መገለጫ ወደ ግል ቀይሩ፤ የስልክ ቁጥርዎንና የልደት ቀንዎን ከመገለጫ ውስጥ ያስወግዱ — እንግዶች አያስፈልጓቸውም።",
    ],
    accounts: [
      "Give each important account its own long passphrase and switch on 2FA — start with your email, it resets everything else.",
      "ለእያንዳንዱ አስፈላጊ መለያ የራሱን ረጅም ሐረግ ይስጡትና 2FA ያንብሩት — ከኢሜይልዎ ጀምሩ፣ ሌላውን ሁሉ እሱ ይቀይረዋልና።",
    ],
    sharing: [
      "Turn off location tagging in your camera and app settings, and accept friend requests only from people you have met.",
      "በካሜራዎና በመተግበሪያ ማስተካከያዎች ውስጥ የቦታ ምልክትን ዝግተው፣ የጓደኛ ጥያቄዎችን ከተገናኙት ሰዎች ብቻ ይቀበሉ።",
    ],
    network: [
      "Add a fingerprint or PIN screen lock, keep phone updates automatic, and never log in to sensitive accounts on public Wi-Fi.",
      "የአሻራ ወይም PIN የስክሪን ቁልፍ ይጨምሩ፣ የስልክ ዝማኔዎችን ራስ-ሰር ያድርጉ፣ በይፋዊ ዋይፋይ ላይ ግን በጭራሽ አስፈላጊ መለያ አይግቡ።",
    ],
  };
  for (const c of worst) {
    if (c.score >= 34) {
      tipsEn.push(tipBank[c.category][0]);
      tipsAm.push(tipBank[c.category][1]);
    }
  }
  if (tipsEn.length === 0) {
    tipsEn.push("Your habits are already strong — keep reviewing privacy settings after every app update.");
    tipsAm.push("ልማዶችዎ ቀድሞ ጠንካራ ናቸው — ከእያንዳንድ መተግበሪያ ዝማኔ በኋላ የግላዊነት ማስተካከያዎችን መገምገምዎን ይቀጥሉ።");
  }

  return {
    risk, band, bandEn: bandNames[band][0], bandAm: bandNames[band][1],
    categories, tipsEn, tipsAm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5 — Content flagging exercise (Table 23 #5)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlagPost {
  id: number;
  author: string;
  text: string;
  correct: "KEEP" | "REPORT";
  basis:
    | "protected_speech"
    | "scam"
    | "harassment"
    | "hate_speech"
    | "privacy"
    | "misinformation";
  basisEn: string;
  basisAm: string;
  whyEn: string;
  whyAm: string;
}

export const FLAG_POSTS: FlagPost[] = [
  {
    id: 1,
    author: "@roadwatcher_addis",
    text: "The city spent two years on this bridge and it already has cracks. The engineer who signed it off should explain to the public. #accountability",
    correct: "KEEP",
    basis: "protected_speech",
    basisEn: "Protected: criticism of public works and officials",
    basisAm: "የተጠበቀ፦ ስለ ይፋዊ ሥራዎችና አመራሮች ማብራሪያ መጠየቅ",
    whyEn: "The Constitution (Art. 29) protects criticism of public institutions and officials. Harsh opinions about performance are not hate speech — they are the core of free expression.",
    whyAm: "ሕገ-መንግሥቱ (አንቀጽ 29) ስለ ይፋዊ ተቋማትና አመራሮች የሚቀርብ ትችት ይጠብቃል። ስለ አፈጻጸም ጥቃቅን አመለካከቶች ጥላት ንግግር አይደሉም — የነጻ ንግግር ቁልፍ አካል ናቸው።",
  },
  {
    id: 2,
    author: "@lucky_winner_et",
    text: "SEND 500 birr telebirr to this number and receive 5,000 birr back in 10 minutes. Ethio Telecom anniversary promotion! First 100 people only!",
    correct: "REPORT",
    basis: "scam",
    basisEn: "Reportable: advance-fee fraud",
    basisAm: "ሪፖርት የሚደረግ፦ የቅድሚያ ክፍያ ማታለል",
    whyEn: "Money-multiplication promises are advance-fee fraud. Report it so others do not lose savings; the platform and police both treat it as fraud.",
    whyAm: "ገንዘብ የማባዛት ቃል መግባት የቅድሚያ ክፍያ ማታለል ነው። ሌሎች ጉልበታቸውን እንዳያጡ ሪፖርት ያድርጉት፤ መድረኩም ፖሊስም እንደ ማታለል ይቆጥሩታል።",
  },
  {
    id: 3,
    author: "@anonymous_student",
    text: "Everyone in class, go spam Hanna's TikTok with these comments. She thinks she is better than us. Do not stop until she deletes her account. 🤮",
    correct: "REPORT",
    basis: "harassment",
    basisEn: "Reportable: coordinated harassment / cyberbullying",
    basisAm: "ሪፖርት የሚደረግ፦ የታቀደ ማሳደድ / የመስመር ላይ ብጥብጥ",
    whyEn: "This is a coordinated pile-on with a stated goal of driving someone off a platform — textbook cyberbullying. Report the post and the account; tell a teacher if it targets a classmate.",
    whyAm: "ይህ አንድን ሰው ከመድረክ እንዲወጣ በተቀዳጀ ቡድን የሚደረግ ጫና ነው — የተለመደ የመስመር ላይ ብጥብጥ ነው። ልጥፉንና መለያውን ሪፖርት ያድርጉ፤ በክፍል ተማሪ ላይ ከሆነ ለመምህር ይንገሩ።",
  },
  {
    id: 4,
    author: "@true_ethiopian",
    text: "People from that ethnic group are not real citizens. They are vermin and should be driven out of our cities once and for all. 🇪🇹",
    correct: "REPORT",
    basis: "hate_speech",
    basisEn: "Reportable: hate speech — Hate Speech Proclamation No. 1185/2020",
    basisAm: "ሪፖርት የሚደረግ፦ ጥላት ንግግር — የጥላት ንግግር አዋጅ ቁጥር 1185/2020",
    whyEn: "Dehumanising language and calls to drive out an ethnic group are criminal hate speech under Proclamation No. 1185/2020 (Art. 3–4) — not opinion. Report to the platform and to the authorities.",
    whyAm: "የሰው አስተሳሰብን የሚቀንስ ቋንቋና ብሔርን ከከተማ ማባረር መግፋት በአዋጅ ቁጥር 1185/2020 (አንቀጽ 3–4) ወንጀለኛ ጥላት ንግግር ነው — አመለካከት አይደለም። ለመድረኩና ለሥልጣኑ ሪፖርት ያድርጉ።",
  },
  {
    id: 5,
    author: "@addis_daden",
    text: "Traditional Ethiopian breakfast is healthier than any imported cereal. Here is my grandmother's recipe for genfo with a video of how we make it at home. 🥣",
    correct: "KEEP",
    basis: "protected_speech",
    basisEn: "Protected: culture and food discussion",
    basisAm: "የተጠበቀ፦ ስለ ባህልና ምግብ ውይይት",
    whyEn: "Cultural and culinary discussion harms nobody. Nothing here to report — flagging harmless posts wastes moderators' time and can silence ordinary voices.",
    whyAm: "የባህልና የምግብ ውይይት ማንንም አያጠቃም። ሪፖርት የሚደረግበት ነገር የለም — ጎጂ ያልሆኑ ልጥፎችን ምልክት ማድረግ የመቆጣጠሪያ ሰዎችን ጊዜ ያባክናል፣ የተለመዱ ድምጾችንም ሊያገዳቸው ይችላል።",
  },
  {
    id: 6,
    author: "@who_are_you",
    text: "This is Sara M., grade 10, she goes to X school and her number is 09xxxxxxxx. She blocked me so now everyone can bother her directly 😈",
    correct: "REPORT",
    basis: "privacy",
    basisEn: "Reportable: publishing private data (doxxing)",
    basisAm: "ሪፖርት የሚደረግ፦ የግል መረጃ ማውጣት (ዶክሲንግ)",
    whyEn: "Publishing someone's school, full name and number without consent to invite harassment violates privacy rules and Proclamation 1321/2024's personal-data protections. Report immediately.",
    whyAm: "ያለ ፈቃዳቸው የሰው ትምህርት ቤት፣ ሙሉ ስምና ቁጥር በማውጣት ጫና ማስፈራት የግላዊነት ደንቦችንና የአዋጅ 1321/2024ን የግል መረጃ ጥበቃ ይጥሳል። ወዲያውኑ ሪፖርት ያድርጉ።",
  },
  {
    id: 7,
    author: "@addis_satire",
    text: "BREAKING (satire): City announces traffic will now flow backwards on Bole Road to reduce congestion. Experts call it 'innovative reversed mobility'. 😄",
    correct: "KEEP",
    basis: "protected_speech",
    basisEn: "Protected: satire clearly labelled",
    basisAm: "የተጠበቀ፦ በግልጽ የተመሰረተ ቀልድ",
    whyEn: "Satire that is clearly labelled and obviously absurd is protected expression. It becomes reportable misinformation only when it presents invented facts as real in ways that cause panic or harm.",
    whyAm: "በግልጽ የተመሰረተና ግልጽ ያልሆነ ቀልድ የተጠበቀ ንግግር ነው። የሚሪፖርት ውሸት የሚሆነው የተፈጠሩ እውነታዎችን እንደ እውነት አቅርቦ ፍርሃት ወይም ጉዳት ሲያስከትል ነው።",
  },
  {
    id: 8,
    author: "@urgent_news_et",
    text: "OFFICIAL: All banks in Ethiopia will be closed for two weeks starting Monday. Withdraw all your money this weekend. Share before it is deleted!",
    correct: "REPORT",
    basis: "misinformation",
    basisEn: "Reportable: panic-driving misinformation about finance",
    basisAm: "ሪፖርት የሚደረግ፦ ስለ ፋይናንስ ፍርሃት የሚያስፈራ ውሸት",
    whyEn: "A fabricated announcement engineered to cause bank runs and panics. 'Share before it is deleted' is the tell. Verify with official bank channels and report the post.",
    whyAm: "የባንክ ማሽበርን የሚያስነሳ የተፈጠረ ማስታወቂያ ነው። 'ከመሰረዙ በፊት ሼር አድርግ' ማለቱ ማሳያው ነው። በይፋዊ የባንክ ቻናሎች ያረጋግጡና ልጥፉን ሪፖርት ያድርጉ።",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool 6 — Cybercrime reporting guide (Table 23 #6)
// ─────────────────────────────────────────────────────────────────────────────

export type IncidentTypeId =
  | "account_takeover"
  | "money_scam"
  | "harassment"
  | "sextortion"
  | "data_breach"
  | "malware";

export interface IncidentType {
  id: IncidentTypeId;
  labelEn: string;
  labelAm: string;
  urgency: "critical" | "high" | "medium";
  urgencyEn: string;
  urgencyAm: string;
  // First-response steps specific to this incident, appended to the common ones
  specificEn: string[];
  specificAm: string[];
}

export const INCIDENT_TYPES: IncidentType[] = [
  {
    id: "account_takeover",
    labelEn: "My account / email / social media was taken over",
    labelAm: "መለያዬ / ኢሜይሌ / ማህበራዊ ሚዲያዬ ተወርዶብታል",
    urgency: "critical",
    urgencyEn: "Act within minutes",
    urgencyAm: "በደቂቃዎች ውስጥ እርምጃ ይውሰዱ",
    specificEn: [
      "Try the service's own 'account recovery' page from a clean device — speed decides whether you keep the account.",
      "If recovery fails, use the platform's 'hacked account' report form; it is a separate channel from normal support.",
      "After recovery, sign out all sessions, then change the password and add 2FA before doing anything else.",
      "If the same password exists anywhere else, change it there too — attackers try stolen passwords everywhere.",
    ],
    specificAm: [
      "ከጽድቅ መሣሪያ በአገልግሎቱ የራሱን 'መለያ መመለሻ' ገጽ ሞክሩ — ፍጥነት መለያዎን እንደሚያቆዩ ይወስናል።",
      "መመለሱ ካልሆነ፣ የመድረኩን 'የተወረደ መለያ' ሪፖርት ቅጽ ይጠቀሙ፤ ከመደበኛ ድጋፍ የተለየ ቻናል ነው።",
      "መለሱ በኋላ ሁሉንም ክፍለ-ጊዜዎች ዝጋ፣ ከዚያ የይለፍ ቃል ቀይረው 2FA ይጨምሩ — ከዚህ በፊት ሌላ አይሠራሩ።",
      "ተመሳሳይ የይለፍ ቃል በሌላ ቦታ ካለ እዚያም ቀይሩት — ሌቦች የተሰረቁትን ይለፍ ቃላት ሁሉ ቦታ ይሞክራሉ።",
    ],
  },
  {
    id: "money_scam",
    labelEn: "I was tricked into sending money (telebirr / bank transfer)",
    labelAm: "ገንዘብ ልኬ ተታልሌያለሁ (ቴሌብር / የባንክ ዝውው)",
    urgency: "critical",
    urgencyEn: "Every minute counts",
    urgencyAm: "እያንዳንዱ ደቂቃ ወሳኝ ነው",
    specificEn: [
      "Call your bank or telebirr (994) immediately and ask them to freeze or recall the transfer — the first hour is the best chance.",
      "Collect the transaction reference, receiver name and number, time, and amount before you call.",
      "File a police report the same day; take the reference number with you — banks act faster with one.",
      "If the scam came through a platform (marketplace, social), report the account there too so it cannot strike again.",
    ],
    specificAm: [
      "ወዲያውኑ ባንክዎን ወይም ቴሌብርን (994) ይደውሉ፤ ዝውዉን ሊቆለፍ ወይም ሊመለስ ይጠይቁ — የመጀመሪያው ሰዓት ምርጥ እድል ነው።",
      "ደውሉ ከመደወልዎ በፊት የዝውው ማጣቀሻ፣ የተቀባይ ስምና ቁጥር፣ ሰዓቱና መጠኑን ያሰባብሩ።",
      "በዚያው ቀን ለፖሊስ ሪፖርት ያድርጉ፤ ማጣቀሻውን ይዘው ይሂዱ — ባንኮች ከሪፖርት ጋር በፍጥነት ይሠራሉ።",
      "ማታለው በመድረክ (ገበያ፣ ማህበራዊ ሚዲያ) ከመጣ መለያውን እዚያም ሪፖርት ያድርጉ — ደግሞ እንዳይበሳጭ።",
    ],
  },
  {
    id: "harassment",
    labelEn: "Someone is threatening, stalking or bullying me online",
    labelAm: "ሰው በመስመር ላይ ያስፈራኛል / ይከተለኛል / ያሳድደኛል",
    urgency: "high",
    urgencyEn: "Act today",
    urgencyAm: "ዛሬ ይሠሩት",
    specificEn: [
      "Do not reply or confront — responses escalate. Screenshot first, with the sender name, date and time visible.",
      "Use the platform's block and report tools; keep the report reference numbers.",
      "If the person knows you offline (school, work, neighbourhood), also tell an adult or supervisor you trust — parallel support matters.",
      "If threats mention physical harm, weapons or your family, go to the police the same day and take the screenshots.",
    ],
    specificAm: [
      "አትመልሱና አትጋፈጡ — ምላሽ ሁኔታውን ያባብሳል። መጀመሪያ ቅጽበታዊ ምስል ይያዙ፤ የመላኪያው ስም፣ ቀንና ሰዓት እንዲታይ።",
      "የመድረኩን ማገጃና ሪፖርት መሳሪያዎች ይጠቀሙ፤ የሪፖርት ማጣቀሻዎችን ይያዙ።",
      "ሰውየው ከመስመር ውጭ ካወቀዎት (ትምህርት ቤት፣ ሥራ፣ አካባቢ) ለሚታመን አዋቂ ወይም ሱፐርቫይዘር ይንገሩ — ትርቁ ድጋፍ አስፈላጊ ነው።",
      "ማስፈራራቱ የአካል ጉዳትን፣ ጦር መሣሪያን ወይም ቤተሰብዎን ከጠቀሰ በዚያው ቀን ለፖሊስ ተመልከቱ፤ ማስረጃዎችን ይዘው ይሂዱ።",
    ],
  },
  {
    id: "sextortion",
    labelEn: "Someone threatens to share private images of me unless I pay",
    labelAm: "ሰው ገንዘብ ካልከፈልኝ የግል ምስሌን የሚያስፋፋ ማስፈራራት አስፈርቶኛል",
    urgency: "critical",
    urgencyEn: "Do not pay — get help now",
    urgencyAm: "አትክፈል — አሁን እርዳታ ይፍለጉ",
    specificEn: [
      "Never pay and never send more images — INTERPOL's cases show payment leads to more demands, not deletion.",
      "Stop all contact but do not block yet and do not delete anything: police need the account, messages and payment demands.",
      "Tell a trusted adult today. You are the victim of a crime; this is never your fault.",
      "Report to the police cybercrime desk and to Ethio-CERT — they handle these cases and can coordinate with platforms.",
    ],
    specificAm: [
      "በጭራሽ አትክፈሉምና ተጨማሪ ምስል አትላኩም — የኢንተርፖል ጉዳዮች ክፍያ ማብቂያ ሳይሆን ተጨማሪ ጥያቄ እንደሚያመጣ ያሳያሉ።",
      "ግንኙነቱን አቁሙ፤ ግን ገና አትከልክሉና ምንም አትሰርዙ፦ ፖሊስ መለያውን፣ መልዕክቶቹንና የክፍያ ጥያቄዎቹን ያስፈልጉታል።",
      "ዛሬ ለሚታመን አዋቂ ይንገሩ። የወንጀል መሳዋ ነዎት፤ ይህ በፍጹም የእርስዎ ስህተት አይደለም።",
      "ለፖሊስ የሳይበር ወንጀል ክፍልና ለኢትዮ-ሴርት ሪፖርት ያድርጉ — እነዚህ ጉዳዮችን ይይዛሉ፣ ከመድረኮችም ጋር ሊተባበሩ ይችላሉ።",
    ],
  },
  {
    id: "data_breach",
    labelEn: "My organisation leaked / exposed people's personal data",
    labelAm: "ድርጅቴ የሰዎችን የግል መረጃ አፋፍሷል / አግሯል",
    urgency: "high",
    urgencyEn: "72-hour reporting window",
    urgencyAm: "የ72 ሰዓት የሪፖርት ጊዜ",
    specificEn: [
      "Notify your data protection officer / management immediately — Proclamation 1321/2024 gives controllers a 72-hour window to report breaches to the authority.",
      "Preserve logs and systems exactly as they are; rebuilding or wiping can destroy the evidence needed to size the breach.",
      "Document what data, how many people, and how it happened — the authority's form asks for exactly this.",
      "Prepare to notify affected individuals if the risk to them is high (fraud, identity theft exposure).",
    ],
    specificAm: [
      "ለውእት የመረጃ ጥበቃ አስኪያጁ / አመራሩ ወዲያውኑ ያሳውቁ — አዋጅ 1321/2024 ለባለሥልጣኑ በ72 ሰዓት ውስጥ ግልጽነትን ሪፖርት ማድረግን ይገድዳል።",
      "ምዝገባዎችንና ሥርዓቶችን እንደነበሩ ጠብቀው ያቆዩ፤ መልሶ መገንባት ወይም መሰረዝ የግልጽነቱን መጠን የሚያሳዩ ማስረጃዎችን ሊያጠፋ ይችላል።",
      "ምን መረጃ፣ ለስንት ሰውና እንዴት እንደሆነ ይመዝግቡ — የባለሥልጣኑ ቅጽ በትክክል እነዚህን ይጠይቃል።",
      "ለተጎዱ ግለሰቦች አደጋው ከፍ ከፍ ከሆነ (ማታለል፣ የማንነት ስም መጋለጥ) ማሳወቅ ያዘጋጁ።",
    ],
  },
  {
    id: "malware",
    labelEn: "My device is acting strangely / I think it has malware",
    labelAm: "መሣሪያዬ በድንገት እየሠራ / ቫይረስ አለው ብዬ እጠራለሁ",
    urgency: "medium",
    urgencyEn: "Isolate the device",
    urgencyAm: "መሣሪያውን አግልሉ",
    specificEn: [
      "Disconnect from Wi-Fi and mobile data first — isolation stops data theft and spread.",
      "Do not enter passwords on the device until it is cleaned; use another device for anything urgent.",
      "Run a reputable antivirus scan; if you cannot clean it, take it to a professional before reusing it.",
      "After cleaning, change passwords (starting with email) from the clean device.",
    ],
    specificAm: [
      "መጀመሪያ ከዋይፋይና ከሞባይል ዳታ ያግለሉት — መከላከያ የመረጃ መስረቅንና መስፋፋትን ያቆማል።",
      "ንጹህ እስኪሆን ድረስ በዚያ መሣሪያ የይለፍ ቃላትን አታስገቡ፤ አስቸኳይ ሥራ ለሌላ መሣሪያ ይጠቀሙ።",
      "የታመነ አንቲቫይረስ ፍተሻ ያካሂዱ፤ ማጽዳት ካልቻሉ እንደገና ከመጠቀምዎ በፊት ለባለሙያ ያስረክቡት።",
      "ንጹህ ከሆነ በኋላ የይለፍ ቃላትን (ከኢሜይል ጀምሮ) ከንጹህ መሣሪያ ቀይሩ።",
    ],
  },
];

export interface ReportChecklist {
  urgency: { en: string; am: string };
  steps: { titleEn: string; titleAm: string; itemsEn: string[]; itemsAm: string[] }[];
  channelsEn: string[];
  channelsAm: string[];
}

/** Build the personalised bilingual checklist for an incident type. */
export function buildReportChecklist(typeId: string): ReportChecklist | null {
  const type = INCIDENT_TYPES.find((t) => t.id === typeId);
  if (!type) return null;

  return {
    urgency: { en: type.urgencyEn, am: type.urgencyAm },
    steps: [
      {
        titleEn: "1 · Preserve the evidence",
        titleAm: "1 · ማስረጃውን ያዙ",
        itemsEn: [
          "Screenshot messages, pages and profiles with dates, times and usernames visible.",
          "Save transaction references, phone numbers and account names exactly as they appear.",
          "Do not delete anything — even embarrassing material. Deletion destroys your case.",
        ],
        itemsAm: [
          "ቀን፣ ሰዓትና የተጠቃሚ ስም እንዲታይ መልዕክቶችን፣ ገጾችንና መገለጫዎችን በቅጽበታዊ ምስል ያዙ።",
          "የዝውው ማጣቀሻዎችን፣ የስልክ ቁጥሮችንና የመለያ ስሞችን እንደሚታዩ በትክክል ያስቀምጡ።",
          "ምንም አትሰርዙ — ያሳፍራችሁ ነገር ቢሆንም። መሰረዝ ጉዳዮን ያጠፋል።",
        ],
      },
      {
        titleEn: "2 · First response for your case",
        titleAm: "2 · ለጉዳይዎ የመጀመሪያ ምላሽ",
        itemsEn: type.specificEn,
        itemsAm: type.specificAm,
      },
      {
        titleEn: "3 · Report it",
        titleAm: "3 · ሪፖርት ያድርጉት",
        itemsEn: [
          "Report inside the platform/app where it happened (report reference numbers help the police).",
          "Report to the police — the nearest station or the cybercrime desk handles online offences.",
          "Report to Ethio-CERT (through INSA) — the national team coordinates cybercrime and threat cases.",
          "Organisations under Proclamation 1321/2024 must also report qualifying personal-data breaches to the supervisory authority.",
        ],
        itemsAm: [
          "የተከሰተበት በመድረኩ/መተግበሪያው ውስጥ ሪፖርት ያድርጉ (የሪፖርት ማጣቀሻ ቁጥሮች ለፖሊስ ይረዳሉ)።",
          "ለፖሊስ ሪፖርት ያድርጉ — በሚቀርብበት ጣቢያ ወይም የሳይበር ወንጀል ክፍል የመስመር ላይ ወንጀሎች ይሠራሉ።",
          "ለኢትዮ-ሴርት (በኢንሳ በኩል) ሪፖርት ያድርጉ — ብሔራዊ ቡድኑ የሳይበር ወንጀልና የስጋት ጉዳዮችን ያስተባብራል።",
          "በአዋጅ 1321/2024 ሥር ያሉ ድርጅቶች ብቁ የግል መረጃ ግልጽነቶችን ለቁጥጥር አካሉም ሪፖርት ማድረግ አለባቸው።",
        ],
      },
    ],
    channelsEn: [
      "Ethio-CERT — via INSA's official reporting channels (insa.gov.et)",
      "Police emergency line — 991",
      "telebirr wallet fraud — 994",
      "Your bank's official hotline (printed on your card / official app)",
    ],
    channelsAm: [
      "ኢትዮ-ሴርት — በኢንሳ ይፋዊ ሪፖርት ቻናሎች (insa.gov.et)",
      "የፖሊስ ድንገተኛ መስመር — 991",
      "የቴሌብር ማታለያ — 994",
      "የባንክዎ ይፋዊ ሙሉ መስመር (በካርድዎ / በይፋዊ መተግበሪያው ላይ የተጻፈው)",
    ],
  };
}
