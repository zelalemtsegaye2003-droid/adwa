/**
 * Adwa Cyber — VAPT SNMP device-audit engine (NBE LOT4 §"Vulnerability
 * Assessment & Core Engine Capabilities" #4: "Network device assessment via
 * SSH, Telnet, and SNMPv1/v2c/v3").
 *
 * REAL protocol implementation — zero dependencies (node:dgram + hand-rolled
 * BER):
 *   - SNMPv1 / v2c GET on the MIB-2 system OIDs, used to audit community-
 *     string authentication: default communities ("public"/"private") that
 *     ANSWER are a live misconfiguration finding with the retrieved sysDescr
 *     as evidence. Extra (non-default) communities come only from stored
 *     encrypted credentials — authorized credentialed reachability, not a
 *     finding.
 *   - SNMPv3 USM probes per RFC 3412/3414: engine-ID discovery (Report PDU
 *     usmStatsUnknownEngineIDs), then a securityLevel=0 (noAuthNoPriv) GET.
 *     An agent that SERVES data at noAuthNoPriv is misconfigured — finding.
 *     One that reports usmStatsUnknownUserNames enforces USM authentication —
 *     recorded as secure posture, no finding.
 *
 * SAFE profile, by construction: read-only GET operations only. No SET
 * operation exists in this file — write-community testing would alter the
 * device and is deliberately not implemented.
 */
import dgram from "dgram";
import type { VulnDraft } from "./vapt-engine";

// ── BER primitives (encode side) ─────────────────────────────────────────────

function berLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), berLen(content.length), content]);
}

function berInt(v: number): Buffer {
  const bytes: number[] = [];
  let n = v;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  if (!bytes.length) bytes.push(0);
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return tlv(0x02, Buffer.from(bytes));
}

function berStr(s: string): Buffer {
  return tlv(0x04, Buffer.from(s, "latin1"));
}

function berOid(oid: string): Buffer {
  const parts = oid.split(".").map(Number);
  const body: number[] = [parts.length >= 2 ? 40 * parts[0] + parts[1] : parts[0]];
  for (const p of parts.slice(2)) {
    if (p === 0) {
      body.push(0);
      continue;
    }
    const stack: number[] = [];
    let n = p;
    while (n > 0) {
      stack.unshift(n & 0x7f);
      n = Math.floor(n / 128);
    }
    stack.forEach((b, i) => body.push(i === stack.length - 1 ? b : b | 0x80));
  }
  return tlv(0x06, Buffer.from(body));
}

function berNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

// ── BER decode side ──────────────────────────────────────────────────────────

interface BerNode {
  tag: number;
  content: Buffer;
}

function berChildren(buf: Buffer): BerNode[] {
  const out: BerNode[] = [];
  let i = 0;
  while (i + 2 <= buf.length) {
    const tag = buf[i];
    let len = buf[i + 1];
    let hdr = 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      if (i + 2 + n > buf.length) break;
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + buf[i + 2 + k];
      hdr = 2 + n;
    }
    if (i + hdr + len > buf.length) break;
    out.push({ tag, content: buf.subarray(i + hdr, i + hdr + len) });
    i += hdr + len;
  }
  return out;
}

function oidString(content: Buffer): string {
  const out: number[] = [];
  let i = 0;
  while (i < content.length) {
    if (out.length === 0) {
      const b = content[i++];
      out.push(Math.floor(b / 40), b % 40); // first byte packs 40*X+Y (0x2b = 1.3)
    } else {
      let v = 0;
      let b = content[i++];
      v = b & 0x7f;
      while (b & 0x80) {
        b = content[i++];
        v = v * 128 + (b & 0x7f);
      }
      out.push(v);
    }
  }
  return out.map(String).join(".");
}

function berValueText(node: BerNode): string | null {
  switch (node.tag) {
    case 0x04: // OCTET STRING
      return node.content.toString("latin1");
    case 0x02: // INTEGER
    case 0x41: // Counter32 (v1)
    case 0x42: // Gauge32
    case 0x43: // TimeTicks
    case 0x46: // Counter64
    case 0x47: // Unsigned32
      return String(node.content.reduce((a, b) => a * 256 + b, 0));
    case 0x05:
      return "NULL";
    default:
      return null;
  }
}

// ── UDP transport (single request, one retry) ────────────────────────────────

function udpRequest(host: string, port: number, msg: Buffer, timeoutMs: number, retries = 1): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let settled = false;
    let attempt = 0;
    const sock = dgram.createSocket("udp4");
    const finish = (v: Buffer | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sock.close();
      } catch {
        /* already closed */
      }
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const send = () => {
      sock.send(msg, port, host);
    };
    sock.on("message", (data: Buffer) => finish(data));
    sock.on("error", () => finish(null));
    sock.once("error", () => {});
    // first send + one retry if silent
    send();
    const retryTimer = setTimeout(
      () => {
        if (!settled) {
          attempt++;
          if (attempt <= retries) send();
        }
      },
      Math.floor(timeoutMs / 2),
    );
    // ensure retry timer can't hold the process open
    retryTimer.unref?.();
    timer.unref?.();
  });
}

// ── Message builders ─────────────────────────────────────────────────────────

const SYSTEM_OIDS: Record<string, string> = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  sysContact: "1.3.6.1.2.1.1.4.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",
};

let snmpReqId = Math.floor(Math.random() * 0x7ffffff0) + 1;

export function encodeGet(oids: string[], version: 0 | 1, community: string): Buffer {
  const reqId = (snmpReqId = (snmpReqId + 1) & 0x7fffffff);
  const varbinds = oids.map((o) => tlv(0x30, Buffer.concat([berOid(o), berNull()])));
  const pdu = tlv(0xa0, Buffer.concat([berInt(reqId), berInt(0), berInt(0), tlv(0x30, Buffer.concat(varbinds))]));
  return tlv(0x30, Buffer.concat([berInt(version), berStr(community), pdu]));
}

function encodeV3Get(oids: string[], user: string, engineId: Buffer): Buffer {
  const msgId = (snmpReqId = (snmpReqId + 1) & 0x7fffffff);
  const globalData = berStr(
    // SEQUENCE { msgID, msgMaxSize, msgFlags(0x00 = noAuthNoPriv), msgSecurityModel(3) }
    tlv(0x30, Buffer.concat([berInt(msgId), berInt(65507), tlv(0x04, Buffer.from([0x00])), berInt(3)])).toString("latin1"),
  );
  const usm = berStr(
    tlv(0x30, Buffer.concat([berStr(engineId.toString("latin1")), berInt(0), berInt(0), berStr(user), berStr(""), berStr("")])).toString("latin1"),
  );
  const varbinds = oids.map((o) => tlv(0x30, Buffer.concat([berOid(o), berNull()])));
  const scopedPdu = tlv(
    0x30,
    Buffer.concat([
      berStr(engineId.toString("latin1")),
      berStr(""),
      tlv(0xa0, Buffer.concat([berInt((snmpReqId = (snmpReqId + 1) & 0x7fffffff)), berInt(0), berInt(0), tlv(0x30, Buffer.concat(varbinds))])),
    ]),
  );
  return tlv(0x30, Buffer.concat([berInt(3), globalData, usm, scopedPdu]));
}

// ── Response parsing ─────────────────────────────────────────────────────────

export interface SnmpVarbind {
  oid: string;
  value: string | null;
}

function parseV1V2cResponse(data: Buffer): { errorStatus: number; varbinds: SnmpVarbind[] } | null {
  // top-level SEQUENCE → [version, community, PDU]
  const msg = berChildren(data)[0];
  if (!msg || msg.tag !== 0x30) return null;
  const outer = berChildren(msg.content);
  if (outer.length < 3 || outer[0].tag !== 0x02) return null;
  const pdu = outer[2];
  if (!pdu || (pdu.tag !== 0xa2 && pdu.tag !== 0xa8)) return null;
  const fields = berChildren(pdu.content);
  if (fields.length < 4) return null;
  const errStatus = Number(fields[1].content.reduce((a, b) => a * 256 + b, 0));
  const varbinds = berChildren(fields[3].content).map((vb) => {
    const pair = berChildren(vb.content);
    return { oid: pair[0] ? oidString(pair[0].content) : "?", value: pair[1] ? berValueText(pair[1]) : null };
  });
  return { errorStatus: errStatus, varbinds };
}

function parseV3Response(data: Buffer): { kind: "response" | "report"; engineId: Buffer; varbinds: SnmpVarbind[] } | null {
  const msg = berChildren(data)[0];
  if (!msg || msg.tag !== 0x30) return null;
  const outer = berChildren(msg.content); // [version, msgGlobalData, msgSecurityParameters, scopedPDU]
  if (outer.length < 4 || outer[0].tag !== 0x02) return null;
  const secParams = berChildren(outer[2].content)[0] ?? null; // USM SEQUENCE (OCTET STRING wraps a SEQUENCE)
  const engineId = secParams ? berChildren(secParams.content)[0]?.content ?? Buffer.alloc(0) : Buffer.alloc(0);
  const pduNode = outer[3];
  if (!pduNode) return null;
  const pdu = pduNode.tag === 0x30 ? berChildren(pduNode.content).find((n) => n.tag === 0xa2 || n.tag === 0xa8) : pduNode;
  if (!pdu || (pdu.tag !== 0xa2 && pdu.tag !== 0xa8)) return null;
  const fields = berChildren(pdu.content);
  if (fields.length < 4) return null;
  const varbinds = berChildren(fields[3].content).map((vb) => {
    const pair = berChildren(vb.content);
    return { oid: pair[0] ? oidString(pair[0].content) : "?", value: pair[1] ? berValueText(pair[1]) : null };
  });
  return { kind: pdu.tag === 0xa8 ? "report" : "response", engineId, varbinds };
}

// ── Audit engine ─────────────────────────────────────────────────────────────

export interface SnmpOptions {
  extraCommunities?: string[]; // from stored encrypted credentials only
  v3User?: string; // from stored encrypted credentials only
  timeoutMs?: number;
}

export interface SnmpReport {
  host: string;
  port: number;
  reachable: boolean;
  versions: string[]; // e.g. ["v2c", "v1"]
  defaultCommunities: string[]; // accepted default communities — findings
  system: { sysDescr?: string; sysName?: string; sysLocation?: string; sysContact?: string };
  v3: "none" | "noAuthNoPriv" | "authRequired" | "notReported";
  v3EngineId?: string;
  evidence: string[];
}

const DEFAULT_COMMUNITIES = ["public", "private"];

async function tryCommunityGet(host: string, port: number, community: string, version: 0 | 1, timeoutMs: number): Promise<Record<string, string | null> | null> {
  const oids = Object.values(SYSTEM_OIDS);
  const resp = await udpRequest(host, port, encodeGet(oids, version, community), timeoutMs);
  if (!resp) return null;
  const parsed = parseV1V2cResponse(resp);
  if (!parsed || parsed.errorStatus !== 0) return null;
  const out: Record<string, string | null> = {};
  for (const vb of parsed.varbinds) {
    for (const [k, o] of Object.entries(SYSTEM_OIDS)) {
      if (vb.oid === o) out[k] = vb.value;
    }
  }
  return out;
}

/**
 * Audit one SNMP endpoint (SAFE: read-only GETs). Probes, in order:
 *   v2c with each default community, v1 fallback with each default community,
 *   v2c/v1 with credential communities, then the RFC 3412 v3 USM ladder.
 */
export async function runSnmpAudit(host: string, port: number, opts: SnmpOptions = {}): Promise<SnmpReport> {
  const timeoutMs = opts.timeoutMs ?? 1_500;
  const report: SnmpReport = {
    host,
    port,
    reachable: false,
    versions: [],
    defaultCommunities: [],
    system: {},
    v3: "none",
    evidence: [],
  };

  const communities = [...DEFAULT_COMMUNITIES, ...(opts.extraCommunities ?? [])];
  for (const community of communities) {
    let sys = await tryCommunityGet(host, port, community, 1, timeoutMs);
    if (sys) {
      if (!report.versions.includes("v2c")) report.versions.push("v2c");
    } else {
      sys = await tryCommunityGet(host, port, community, 0, timeoutMs);
      if (sys) {
        if (!report.versions.includes("v1")) report.versions.push("v1");
      }
    }
    if (sys) {
      report.reachable = true;
      if (DEFAULT_COMMUNITIES.includes(community)) report.defaultCommunities.push(community);
      for (const [k, v] of Object.entries(sys)) {
        if (v && !report.system[k as keyof typeof report.system]) (report.system as Record<string, string>)[k] = v;
      }
      report.evidence.push(`GET ${community}@v${report.versions.includes("v2c") ? "2c" : "1"} → sysDescr=${JSON.stringify(sys.sysDescr ?? "")} sysName=${JSON.stringify(sys.sysName ?? "")}`);
    }
  }

  // ── SNMPv3 USM ladder (RFC 3412): engine-ID discovery, then noAuthNoPriv GET
  const v3User = opts.v3User ?? "";
  const discover = await udpRequest(host, port, encodeV3Get([SYSTEM_OIDS.sysDescr], v3User, Buffer.alloc(0)), timeoutMs);
  if (discover) {
    const parsed = parseV3Response(discover);
    if (parsed) {
      if (parsed.kind === "report") {
        const unknownEngine = parsed.varbinds.some((v) => v.oid.startsWith("1.3.6.1.6.3.15.1.1.3"));
        if (unknownEngine && parsed.engineId.length) {
          // resend with the discovered engineID
          const again = await udpRequest(host, port, encodeV3Get([SYSTEM_OIDS.sysDescr], v3User, parsed.engineId), timeoutMs);
          const p2 = again ? parseV3Response(again) : null;
          if (p2?.kind === "response") {
            report.v3 = "noAuthNoPriv";
            report.v3EngineId = parsed.engineId.toString("hex");
            report.reachable = true;
            const descr = p2.varbinds.find((v) => v.oid === SYSTEM_OIDS.sysDescr)?.value;
            if (descr) report.system.sysDescr = report.system.sysDescr ?? descr;
            report.evidence.push(`SNMPv3 noAuthNoPriv GET answered (engineID ${report.v3EngineId}) → sysDescr=${JSON.stringify(descr ?? "")}`);
          } else if (p2?.kind === "report" && p2.varbinds.some((v) => v.oid.startsWith("1.3.6.1.6.3.15.1.1.5"))) {
            report.v3 = "authRequired";
            report.v3EngineId = parsed.engineId.toString("hex");
            report.reachable = true;
            report.evidence.push(`SNMPv3 USM enforces authentication (usmStatsUnknownUserNames, engineID ${report.v3EngineId})`);
          } else {
            report.v3 = "notReported";
            report.evidence.push(`SNMPv3 Report received (engineID ${parsed.engineId.toString("hex")}) — security level or user rejected`);
          }
        } else {
          report.v3 = "notReported";
          report.evidence.push(`SNMPv3 Report received: ${parsed.varbinds.map((v) => `${v.oid}=${v.value ?? ""}`).join(" ")}`);
        }
      } else if (parsed.kind === "response") {
        // answered even without engine-ID discovery — accepts noAuthNoPriv
        report.v3 = "noAuthNoPriv";
        report.reachable = true;
        report.evidence.push("SNMPv3 noAuthNoPriv GET answered directly (no engine-ID discovery required)");
      }
    }
  }

  return report;
}

// ── Findings ─────────────────────────────────────────────────────────────────

const DBLENGTH = { "public": 5.3, private: 7.5 } as Record<string, number>;

export function snmpVulnsFromReport(report: SnmpReport): VulnDraft[] {
  const drafts: VulnDraft[] = [];
  const now = new Date();

  for (const community of report.defaultCommunities) {
    drafts.push({
      cveId: null,
      title: `Default SNMP community "${community}" accepted on ${report.host}:${report.port}`,
      description: `The SNMP agent served MIB-2 system data to a GET request carrying the factory-default community string "${community}"${
        report.system.sysDescr ? `, and disclosed sysDescr "${report.system.sysDescr}"` : ""
      }. Default communities are documented in every vendor manual and are the first thing an attacker tries; on many deployments they also carry write access. Verified by a real SNMP GET over UDP — evidence below is the actual response payload.`,
      remediation: `Replace the default community with a long random value, restrict SNMP access to management VLANs/ACLs, and migrate the device to SNMPv3 with authPriv (USM users).`,
      category: "CONFIG",
      cvssScore: DBLENGTH[community] ?? 5.3,
      cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
      epss: 0.1,
      kev: false,
      evidence: {
        mode: "snmp-live",
        host: report.host,
        port: report.port,
        versions: report.versions,
        sysDescr: report.system.sysDescr ?? null,
        sysName: report.system.sysName ?? null,
        transcripts: report.evidence.slice(0, 8),
        note: "Read-only SNMP GET probes (SAFE profile) — no SET operations exist in this engine",
      },
      detectedAt: now,
    });
  }

  if (report.v3 === "noAuthNoPriv") {
    drafts.push({
      cveId: null,
      title: `SNMPv3 agent serves requests at the noAuthNoPriv security level on ${report.host}:${report.port}`,
      description: `An RFC 3412/3414 engine-ID discovery followed by a securityLevel=0 GET was answered with MIB data — the agent accepts SNMPv3 requests without USM authentication or privacy. All SNMPv3 security benefits are effectively disabled.`,
      remediation: "Configure USM users with SHA-2 authentication and AES privacy (authPriv) and disable the noAuthNoPriv security level on the agent.",
      category: "CONFIG",
      cvssScore: 5.3,
      cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
      epss: 0.08,
      kev: false,
      evidence: {
        mode: "snmp-live",
        host: report.host,
        port: report.port,
        v3: report.v3,
        engineId: report.v3EngineId ?? null,
        transcripts: report.evidence.slice(0, 8),
      },
      detectedAt: now,
    });
  }

  return drafts;
}
