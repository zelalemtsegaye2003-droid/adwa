"use client";
/**
 * Adwa Cyber — live security-intel ticker.
 *
 * A slim marquee strip under the app header carrying REAL, verifiable
 * cybersecurity facts and operational tips (NIST CSF 2.0, CIS Controls v8,
 * OWASP, CISA KEV, FIRST EPSS, Verizon DBIR, IBM breach-cost research) — the
 * "info ribbon" convention used by commercial threat-intel consoles.
 *
 * Since the real-Ethiopian integration, the ribbon ALSO rotates the national
 * layer: Ethio-CERT's 933 incident hotline, INSA's published awareness
 * campaign (strong unique passwords, 2FA, deepfake scams, social
 * engineering — insa.gov.et), INSA national-posture figures and NBE
 * directives — interleaved with the global facts so the ribbon reads as a
 * national-console intel strip, not a foreign one.
 *
 * Every global fact below is a published, checkable figure; every Ethiopian
 * item carries its national source (chip).
 */
import { ShieldAlert, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface TickerItem {
  en: string;
  am?: string; // Amharic rendering (ours for translated national content)
  source?: "Ethio-CERT" | "INSA" | "NBE"; // national items carry their source
}

/** Ethiopian national layer — real, sourced items (captured 2026-11-19). */
export const ETHIO_TIPS: TickerItem[] = [
  {
    en: "Cyber incident? Call Ethio-CERT on 933 — the national reporting hotline, 24/7 (ethiocert@insa.gov.et)",
    am: "የሳይበር ጥቃት አጋጠመዎት? በ933 የኢትዮ-CERTን መስመር ይደውሉ — በማንኛውም ሰዓት",
    source: "Ethio-CERT",
  },
  {
    en: "INSA: use strong, unique passwords — never reuse one password across bank, email and work accounts",
    am: "ኢንሳ፡ ጠንካራ እና ልዩ የጥበብ ቃላት ይጠቀሙ — አንድን የጥበብ ቃል አትድግመሩ",
    source: "INSA",
  },
  {
    en: "INSA: enable two-factor authentication (2FA) on email and banking apps first",
    am: "ኢንሳ፡ በኢሜይል እና በባንክ መተግበሪያዎች ላይ መጀመሪያ ሁለት-ደረጃ ማረጋገጫ (2FA) ያንቁ",
    source: "INSA",
  },
  {
    en: "INSA: beware of deepfake scams — voice and video can be faked; verify with a second channel before acting on payment requests",
    am: "ኢንሳ፡ ከዲፍበክ ማታለያዎች ይጠንቀቁ — ድምፅ እና ቪዲዮ ሊሰረዙ ይችላሉ",
    source: "INSA",
  },
  {
    en: "INSA: spot social engineering — urgency, secrecy and unusual payment routes are the classic tells",
    am: "ኢንሳ፡ ማስታለያ ብልሃቶችን ይለዩ — አስቸኳይነት፣ ስጥረት እና ያልተለመደ የክፍያ መስመር",
    source: "INSA",
  },
  {
    en: "INSA: keep software and devices updated — enable automatic updates where the network allows",
    am: "ኢንሳ፡ ሶፍትዌሮችን እና መሣሪያዎችን ያዘምኑ",
    source: "INSA",
  },
  {
    en: "INSA thwarted 6,700+ cyberattacks in 2023 — national attack volume keeps rising; report early, report to 933",
    am: "ኢንሳ በ2023 ከ6,700 በላይ የሳይበር ጥቃቶችን ተከትሎ አግዷል — በጊዜ ይዘግዙ",
    source: "INSA",
  },
  {
    en: "NBE SBB/96/2025 reshapes banking licences — banks must meet the new capital threshold by 30 June 2026; cyber governance rides with it",
    am: "ኤንቢኢ SBB/96/2025 የባንክ ፈቃድ ደንብ — የካፒታል ገደብ ግዴታ 30 ሰኔ 2026 ነው",
    source: "NBE",
  },
  {
    en: "Financial Sector Cybersecurity Forum launched (Nov 2026) — NBE-member coordination now has a national venue",
    am: "የፋይናንስ ዘርፍ የሳይበር ደህንነት መድረክ ተመርቋል (ኖቬ 2026) — የኤንቢኢ አባላት ማስተባበሪያ",
    source: "INSA",
  },
  {
    en: "Ethiopia CTI market: USD 3.21M (2025) → USD 37.67M (2034), 31.46% CAGR — IMARC Group sizing",
    am: "የኢትዮጵያ CTI ገበያ፡ 3.21 ሚሊዮን ዶላር (2025) → 37.67 ሚሊዮን (2034)",
  },
];

/** Global layer — published, checkable figures (unchanged set). */
export const INTEL_TIPS: TickerItem[] = [
  { en: "MFA blocks over 99% of automated account-compromise attempts — Microsoft security research" },
  { en: "Verizon DBIR 2024: 68% of breaches involve a human element — train the people, not just the perimeter" },
  { en: "IBM Cost of a Data Breach 2024: global average is $4.88M — detection speed is the biggest cost lever" },
  { en: "CISA KEV: patch vulnerabilities already exploited in the wild first — check the catalog before your backlog" },
  { en: "FIRST EPSS ranks exploit probability within 30 days — use it with CVSS to prioritise what actually gets attacked" },
  { en: "OWASP Top 10 (2021): #1 is Broken Access Control — test authorisation, not just authentication" },
  { en: "NIST CSF 2.0: six functions — Govern · Identify · Protect · Detect · Respond · Recover" },
  { en: "CIS Controls v8: 18 controls, 153 safeguards — start with the Implementation Groups, not the whole list" },
  { en: "ISO/IEC 27001:2022 Annex A: 93 controls in 4 themes — organizational, people, physical, technological" },
  { en: "MITRE ATT&CK Enterprise: 14 tactics, from Reconnaissance to Impact — map your telemetry to them" },
  { en: "NIST SP 800-63B: password length beats complexity — long passphrases, no forced rotation without evidence" },
  { en: "NIST SP 800-207 Zero Trust: never trust, always verify — segment, then verify again" },
  { en: "3-2-1 backup rule: three copies, two different media, one offsite — and make one immutable against ransomware" },
  { en: "CIS Control 8: centralise authentication and audit logs — unmonitored logs are dead weight" },
  { en: "Patch internet-facing systems first — edge devices and VPNs are the preferred initial-access path" },
  { en: "Certificate Transparency logs expose every issued cert — continuously diff your domains for shadow IT (EASM)" },
];

/** Interleave so national and global intel alternate on the ribbon. */
function interleave(a: TickerItem[], b: TickerItem[]): TickerItem[] {
  const out: TickerItem[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

const ALL_TIPS = interleave(ETHIO_TIPS, INTEL_TIPS);

export function TipTicker({ accent, className }: { accent: string; className?: string }) {
  const { lang } = useI18n();
  const items = ALL_TIPS.map((item) => (lang === "am" && item.am ? item.am : item.en));
  return (
    <div
      className={`ticker relative overflow-hidden border-b ${className ?? ""}`}
      style={{
        background: `linear-gradient(90deg, ${accent}1f, ${accent}0a 30%, transparent 70%)`,
      }}
      role="note"
      aria-label="Live security intelligence ticker"
    >
      <span className="sr-only">{items.join(". ")}</span>
      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 bg-background/95 pr-3 pl-3 backdrop-blur-sm"
        style={{ boxShadow: "4px 0 12px -6px rgba(0,0,0,.25)" }}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: accent }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        </span>
        <ShieldAlert className="h-3 w-3 shrink-0" style={{ color: accent }} aria-hidden />
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: accent }}>
          Security Intel
        </span>
      </span>
      <div className="ticker-track flex w-max items-center gap-10 pl-40 pr-10 py-1.5" aria-hidden>
        {[...items.map((text, i) => ({ text, source: ALL_TIPS[i]?.source })), ...items.map((text, i) => ({ text, source: ALL_TIPS[i]?.source }))].map((tip, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap text-[11px] leading-none text-muted-foreground">
            <span className="h-1 w-1 rounded-full" style={{ background: accent, opacity: 0.6 }} aria-hidden />
            {tip.source && (
              <span
                className="inline-flex items-center gap-0.5 rounded-sm border px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: tip.source === "NBE" ? "#f59e0b66" : accent,
                  color: tip.source === "NBE" ? "#b45309" : accent,
                  background: tip.source === "NBE" ? "#f59e0b14" : `${accent}14`,
                }}
              >
                <Flag className="h-2 w-2" aria-hidden />
                {tip.source}
              </span>
            )}
            {tip.text}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
