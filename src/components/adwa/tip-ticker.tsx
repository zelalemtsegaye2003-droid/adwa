"use client";
/**
 * Adwa Cyber — live security-intel ticker.
 *
 * A slim marquee strip under the app header carrying REAL, verifiable
 * cybersecurity facts and operational tips (NIST CSF 2.0, CIS Controls v8,
 * OWASP, CISA KEV, FIRST EPSS, Verizon DBIR, IBM breach-cost research) — the
 * "info ribbon" convention used by commercial threat-intel consoles.
 *
 * Every fact below is a published, checkable figure:
 *  - NIST CSF 2.0 (Feb 2024) defines six functions: Govern · Identify ·
 *    Protect · Detect · Respond · Recover.
 *  - CIS Critical Security Controls v8: 18 controls / 153 safeguards.
 *  - ISO/IEC 27001:2022 Annex A: 93 controls in 4 themes.
 *  - OWASP Top 10 2021 #1: Broken Access Control.
 *  - CISA KEV catalog lists vulnerabilities already exploited in the wild.
 *  - FIRST EPSS estimates the probability of exploitation within 30 days.
 *  - Microsoft research: MFA blocks over 99% of automated account
 *    compromise attempts.
 *  - Verizon DBIR 2024: 68% of breaches involve a human element.
 *  - IBM Cost of a Data Breach 2024: $4.88M global average.
 *  - MITRE ATT&CK Enterprise: 14 tactics, Reconnaissance → Impact.
 *  - NIST SP 800-63B: password length beats complexity.
 *  - NIST SP 800-207: Zero Trust — never trust, always verify.
 */
import { ShieldAlert } from "lucide-react";

export const INTEL_TIPS: string[] = [
  "MFA blocks over 99% of automated account-compromise attempts — Microsoft security research",
  "Verizon DBIR 2024: 68% of breaches involve a human element — train the people, not just the perimeter",
  "IBM Cost of a Data Breach 2024: global average is $4.88M — detection speed is the biggest cost lever",
  "CISA KEV: patch vulnerabilities already exploited in the wild first — check the catalog before your backlog",
  "FIRST EPSS ranks exploit probability within 30 days — use it with CVSS to prioritise what actually gets attacked",
  "OWASP Top 10 (2021): #1 is Broken Access Control — test authorisation, not just authentication",
  "NIST CSF 2.0: six functions — Govern · Identify · Protect · Detect · Respond · Recover",
  "CIS Controls v8: 18 controls, 153 safeguards — start with the Implementation Groups, not the whole list",
  "ISO/IEC 27001:2022 Annex A: 93 controls in 4 themes — organizational, people, physical, technological",
  "MITRE ATT&CK Enterprise: 14 tactics, from Reconnaissance to Impact — map your telemetry to them",
  "NIST SP 800-63B: password length beats complexity — long passphrases, no forced rotation without evidence",
  "NIST SP 800-207 Zero Trust: never trust, always verify — segment, then verify again",
  "3-2-1 backup rule: three copies, two different media, one offsite — and make one immutable against ransomware",
  "CIS Control 8: centralise authentication and audit logs — unmonitored logs are dead weight",
  "Patch internet-facing systems first — edge devices and VPNs are the preferred initial-access path",
  "Certificate Transparency logs expose every issued cert — continuously diff your domains for shadow IT (EASM)",
];

export function TipTicker({ accent, className }: { accent: string; className?: string }) {
  const items = INTEL_TIPS;
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
        {[...items, ...items].map((tip, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap text-[11px] leading-none text-muted-foreground">
            <span className="h-1 w-1 rounded-full" style={{ background: accent, opacity: 0.6 }} aria-hidden />
            {tip}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
