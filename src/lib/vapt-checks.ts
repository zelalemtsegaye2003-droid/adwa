/**
 * Adwa Cyber — VAPT custom check engine (plan §Phase 3: "a UI and API where
 * analysts write checks in YAML … and a sandboxed runner").
 *
 * Checks are DECLARATIVE matchers — banner regex, HTTP response properties,
 * TLS posture, open-port sets. There is no script execution surface at all:
 * the interpreter evaluates data, never code, so a malicious check file can
 * at worst fail to match. Versioning and a test-run button are part of the
 * model (VaptCustomCheck.version / lastRunAt / lastResult).
 *
 * YAML subset (indentation-based, scalars, lists of scalars/maps):
 *
 *   name: Exposed ProFTPD version banner
 *   severity: medium
 *   title: FTP banner discloses product version
 *   remediation: Strip version from the FTP greeting.
 *   match:
 *     - type: banner-regex
 *       pattern: "220[ -].*ProFTPD [0-9.]+"
 *   or:
 *   match:
 *     - type: http-response
 *       header-regex: "server: .*nginx/[0-9.]+"
 *     - type: tls
 *       deprecated-accepted: true
 *     - type: port-open
 *       ports: [23, 2323]
 */
import type { InfraReport } from "./vapt-netengine";
import type { DastReport } from "./vapt-engine";

// ── Minimal YAML subset parser (no external dependency, no code execution) ──

type YamlValue = string | number | boolean | YamlValue[] | { [k: string]: YamlValue } | null;

function parseScalar(raw: string): YamlValue {
  const t = raw.trim();
  if (t === "" ) return null;
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return t.slice(1, -1);
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return Number.parseFloat(t);
  // flow list: [a, b, 23]
  if (/^\[[\s\S]*\]$/.test(t)) {
    return t.slice(1, -1).split(",").map((x) => parseScalar(x)).filter((x) => x !== null);
  }
  return t;
}

function parseYamlBlock(lines: string[], startIndent: number): { value: YamlValue; consumed: number } {
  // Map or list determined by the first significant line at this indent.
  let i = 0;
  let firstSig = -1;
  while (i < lines.length) {
    if (lines[i].trim() === "" || lines[i].trim().startsWith("#")) { i++; continue; }
    firstSig = i;
    break;
  }
  if (firstSig === -1) return { value: null, consumed: lines.length };
  const indent = lines[firstSig].length - lines[firstSig].replace(/^\s+/, "").length;
  if (indent < startIndent) return { value: null, consumed: 0 };

  if (lines[firstSig].trim().startsWith("- ") || lines[firstSig].trim() === "-") {
    // list
    const items: YamlValue[] = [];
    i = firstSig;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "" || line.trim().startsWith("#")) { i++; continue; }
      const curIndent = line.length - line.replace(/^\s+/, "").length;
      if (curIndent < indent) break;
      if (curIndent > indent) throw new Error(`Unexpected indent at line ${i + 1}`);
      if (!line.trim().startsWith("-")) throw new Error(`Expected list item at line ${i + 1}`);
      const inline = line.trim().slice(1).trim();
      if (inline && /^([A-Za-z0-9_-]+):\s*/.test(inline)) {
        // "- key: value" — a mapping item; rewrite the dash line as the first
        // line of a nested map at the content's column and parse from there.
        const contentIndent = line.indexOf(inline);
        const synthetic = [" ".repeat(contentIndent) + inline, ...lines.slice(i + 1)];
        const sub = parseYamlBlock(synthetic, contentIndent);
        items.push(sub.value);
        i += sub.consumed;
      } else if (inline) {
        items.push(parseScalar(inline));
        i++;
      } else {
        // nested structure under the dash
        const rest = lines.slice(i + 1);
        const sub = parseYamlBlock(rest, indent + 1);
        items.push(sub.value);
        i += 1 + sub.consumed;
      }
    }
    return { value: items, consumed: i };
  }

  // map
  const map: { [k: string]: YamlValue } = {};
  i = firstSig;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) { i++; continue; }
    const curIndent = line.length - line.replace(/^\s+/, "").length;
    if (curIndent < indent) break;
    if (curIndent > indent) throw new Error(`Unexpected indent at line ${i + 1}`);
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!m) throw new Error(`Expected "key: value" at line ${i + 1}`);
    const key = m[1];
    const inlineVal = m[2];
    if (inlineVal.trim() === "") {
      const rest = lines.slice(i + 1);
      const sub = parseYamlBlock(rest, indent + 1);
      map[key] = sub.value;
      i += 1 + sub.consumed;
    } else if (inlineVal.trim().startsWith("-")) {
      // inline list start "- a" as value
      const sub = parseYamlBlock([line.replace(/^([A-Za-z0-9_-]+):\s*/, "  ".repeat(curIndent + 1) === "" ? "" : " ".repeat(curIndent) + "- ") + ""].concat(lines.slice(i + 1)), curIndent + 1);
      // Simpler: treat as nested block by rewriting — handled by recursion below instead.
      // (Not reachable in practice: our emitter writes lists on their own lines.)
      map[key] = sub.value;
      i += 1 + sub.consumed;
    } else {
      map[key] = parseScalar(inlineVal);
      i++;
    }
  }
  return { value: map, consumed: i };
}

export function parseYaml(text: string): { [k: string]: YamlValue } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const { value } = parseYamlBlock(lines, 0);
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("YAML root must be a mapping");
  }
  return value;
}

// ── Check definition ────────────────────────────────────────────────────────

export type CheckMatcherType = "banner-regex" | "http-response" | "tls" | "port-open";

export interface CheckMatcher {
  type: CheckMatcherType;
  pattern?: string; // banner-regex / http-response header-regex
  bodyRegex?: string;
  status?: number;
  ports?: number[];
  deprecatedAccepted?: boolean;
  certDaysMax?: number;
}

export interface CheckDefinition {
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  remediation: string;
  match: CheckMatcher[];
}

const SEVERITIES = ["critical", "high", "medium", "low", "info"];

/** Parse + validate a custom-check YAML document. Throws with a clear message. */
export function parseCheckYaml(yaml: string): CheckDefinition {
  const doc = parseYaml(yaml) as unknown as Record<string, YamlValue>;
  const name = typeof doc.name === "string" ? doc.name.trim() : "";
  if (!name) throw new Error("Missing 'name'");
  const severity = typeof doc.severity === "string" && SEVERITIES.includes(doc.severity) ? (doc.severity as CheckDefinition["severity"]) : "medium";
  const title = typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : name;
  const remediation = typeof doc.remediation === "string" ? doc.remediation.trim() : "Apply the vendor's hardening guidance.";
  const rawMatch = doc.match;
  if (!Array.isArray(rawMatch) || !rawMatch.length) throw new Error("At least one entry under 'match:' is required");
  const match: CheckMatcher[] = [];
  for (const item of rawMatch) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Error("Each match entry must be a mapping");
    const rec = item as Record<string, YamlValue>;
    const type = rec.type;
    if (type !== "banner-regex" && type !== "http-response" && type !== "tls" && type !== "port-open") {
      throw new Error(`Unsupported matcher type: ${String(type)}`);
    }
    const m: CheckMatcher = { type };
    if (typeof rec.pattern === "string") m.pattern = rec.pattern;
    if (typeof rec["body-regex"] === "string") m.bodyRegex = rec["body-regex"];
    if (typeof rec["header-regex"] === "string") m.pattern = rec["header-regex"];
    if (typeof rec.status === "number") m.status = rec.status;
    if (Array.isArray(rec.ports)) m.ports = rec.ports.filter((p): p is number => typeof p === "number");
    if (typeof rec["deprecated-accepted"] === "boolean") m.deprecatedAccepted = rec["deprecated-accepted"];
    if (typeof rec["cert-days-max"] === "number") m.certDaysMax = rec["cert-days-max"];
    // validate regexes compile
    for (const rx of [m.pattern, m.bodyRegex]) {
      if (rx !== undefined) new RegExp(rx); // throws on malformed — surfaced to the author
    }
    match.push(m);
  }
  return { name, severity, title, remediation, match };
}

// ── Evaluation against REAL probe data ─────────────────────────────────────

export interface CheckEvaluation {
  matched: boolean;
  evidence: string;
}

/**
 * Evaluate one check against a REAL infra report (banners, TLS posture, ports)
 * and (optionally) a DAST report. Sandbox = pure data evaluation.
 */
export function evaluateCheck(def: CheckDefinition, infra: InfraReport | null, dast: DastReport | null): CheckEvaluation {
  const notes: string[] = [];
  let matched = false;
  for (const m of def.match) {
    switch (m.type) {
      case "banner-regex": {
        if (!infra) break;
        const rx = m.pattern ? new RegExp(m.pattern, "i") : null;
        for (const b of infra.banners) {
          if (m.ports?.length && !m.ports.includes(b.port)) continue;
          if (rx && rx.test(b.banner)) {
            matched = true;
            notes.push(`banner-regex matched on port ${b.port}: ${b.banner.slice(0, 80)}`);
          }
        }
        break;
      }
      case "http-response": {
        if (!dast) break;
        if (m.status !== undefined) {
          if (dast.httpStatus === m.status) {
            matched = true;
            notes.push(`HTTP status ${m.status} observed`);
          }
        }
        if (m.pattern) {
          const rx = new RegExp(m.pattern, "i");
          const headers = dast.checks.map((c) => `${c.name}: ${c.detail}`).join("\n");
          // header evidence comes from the DAST checks + protocol/cookies state
          const surface = `${dast.protocol ?? ""} ${dast.target} status=${dast.httpStatus ?? "?"}\n${headers}`;
          if (rx.test(surface)) {
            matched = true;
            notes.push(`http-response matched: ${m.pattern}`);
          }
        }
        if (m.bodyRegex && dast) {
          // DAST keeps headers/cookies but not full bodies — evaluate against
          // the robots disclosure evidence we retain.
          const surface = dast.checks.map((c) => `${c.id}: ${c.detail}`).join("\n");
          if (new RegExp(m.bodyRegex, "i").test(surface)) {
            matched = true;
            notes.push(`http-response body-regex matched: ${m.bodyRegex}`);
          }
        }
        break;
      }
      case "tls": {
        if (!infra) break;
        for (const t of infra.tls) {
          if (m.deprecatedAccepted && (t.tls10Accepted || t.tls11Accepted)) {
            matched = true;
            notes.push(`deprecated TLS accepted on port ${t.port}`);
          }
          if (m.certDaysMax !== undefined && t.certDaysRemaining !== null && t.certDaysRemaining <= m.certDaysMax) {
            matched = true;
            notes.push(`certificate on port ${t.port} has ${t.certDaysRemaining} day(s) left (≤ ${m.certDaysMax})`);
          }
        }
        break;
      }
      case "port-open": {
        if (!infra) break;
        const wanted = m.ports ?? [];
        const hits = wanted.filter((p) => infra.openPorts.includes(p));
        if (hits.length) {
          matched = true;
          notes.push(`ports open: ${hits.join(", ")}`);
        }
        break;
      }
    }
  }
  return { matched, evidence: notes.join("; ") || "no matcher fired (target evaluated)" };
}

/** Sample checks shipped as tenant-visible templates (plan: versioned, test-run). */
export const SAMPLE_CHECK_YAML = `name: Legacy FTP banner disclosure
severity: medium
title: FTP greeting discloses product and version
remediation: Strip product/version details from the FTP greeting banner.
match:
  - type: banner-regex
    pattern: "220[ -].*(ProFTPD|vsFTPd|vsftpd) [0-9.]+"
`;
