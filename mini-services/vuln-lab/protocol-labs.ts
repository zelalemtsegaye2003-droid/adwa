/**
 * Adwa Cyber — VAPT protocol labs (companion to vuln-lab/index.ts).
 *
 * Independent wire-protocol simulators for the credentialed-audit engines:
 *   UDP 3161  SNMP agent      — default communities public/private accepted,
 *                               MIB-2 system data, v3 noAuthNoPriv answered
 *   TCP 3160  MongoDB (no-auth) — OP_MSG hello/buildInfo/listDatabases served
 *                               without authentication (auth misconfiguration),
 *                               version 4.0.10 (EOL release line)
 *   TCP 3162  MariaDB (auth)  — protocol-10 handshake, mysql_native_password
 *                               verified, accounts: audit/AdwaAudit2026!
 *                               version 5.5.62 (EOL release line)
 *   TCP 3164  MongoDB (SCRAM) — authentication enforced; SCRAM-SHA-256 server
 *                               side implemented (RFC 5802/7677); after login
 *                               buildInfo reports 5.0.5 (EOL line)
 *
 * The BER/BSON/packet code here is written independently of the audit engine
 * (src/lib/vapt-*): the lab is a device simulator, not a shared library — a
 * bug on one side cannot silently pass both.
 */
import net from "net";
import dgram from "dgram";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "crypto";

const HOST = "127.0.0.1";

// ═══ SNMP agent (UDP 3161) ═══════════════════════════════════════════════════

const SYS = {
  sysDescr: "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 12.2(55)SE5, RELEASE SOFTWARE (fc1)",
  sysUpTime: "123456789",
  sysContact: "noc@nbe.et",
  sysName: "CBE-DSW-01",
  sysLocation: "Addis Ababa DC-1 rack B12",
};

const OID_MAP: Record<string, string> = {
  "1.3.6.1.2.1.1.1.0": SYS.sysDescr,
  "1.3.6.1.2.1.1.3.0": SYS.sysUpTime,
  "1.3.6.1.2.1.1.4.0": SYS.sysContact,
  "1.3.6.1.2.1.1.5.0": SYS.sysName,
  "1.3.6.1.2.1.1.6.0": SYS.sysLocation,
};

const LAB_ENGINE_ID = Buffer.from([0x80, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x01]);

// — lab-side BER (independent of the engine) —
function labLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function labTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), labLen(content.length), content]);
}
function labInt(v: number): Buffer {
  const bytes: number[] = [];
  let n = v;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  if (!bytes.length) bytes.push(0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return labTlv(0x02, Buffer.from(bytes));
}
function labStr(s: string): Buffer {
  return labTlv(0x04, Buffer.from(s, "latin1"));
}
function labOid(oid: string): Buffer {
  const p = oid.split(".").map(Number);
  const body: number[] = [40 * p[0] + p[1]];
  for (const x of p.slice(2)) {
    if (x === 0) {
      body.push(0);
      continue;
    }
    const st: number[] = [];
    let n = x;
    while (n > 0) {
      st.unshift(n & 0x7f);
      n = Math.floor(n / 128);
    }
    st.forEach((b, i) => body.push(i === st.length - 1 ? b : b | 0x80));
  }
  return labTlv(0x06, Buffer.from(body));
}
function labParse(data: Buffer): { tag: number; content: Buffer }[] {
  const out: { tag: number; content: Buffer }[] = [];
  let i = 0;
  while (i + 2 <= data.length) {
    const tag = data[i];
    let len = data[i + 1];
    let hdr = 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + data[i + 2 + k];
      hdr = 2 + n;
    }
    if (i + hdr + len > data.length) break;
    out.push({ tag, content: data.subarray(i + hdr, i + hdr + len) });
    i += hdr + len;
  }
  return out;
}
function oidText(content: Buffer): string {
  const vals: number[] = [];
  let i = 0;
  while (i < content.length) {
    if (vals.length === 0) {
      const b = content[i++];
      vals.push(Math.floor(b / 40), b % 40); // first byte packs 40*X+Y
    } else {
      let v = 0;
      let b = content[i++];
      v = b & 0x7f;
      while (b & 0x80) {
        b = content[i++];
        v = v * 128 + (b & 0x7f);
      }
      vals.push(v);
    }
  }
  return vals.map(String).join(".");
}

const SNMP_COMMUNITIES = new Set(["public", "private"]);

function snmpVarbinds(pduContent: Buffer): { oids: string[]; reqId: number } {
  const f = labParse(pduContent);
  const reqId = Number(f[0]?.content.reduce((a, b) => a * 256 + b, 0) ?? 0);
  const oids: string[] = [];
  if (f[3]) {
    for (const vb of labParse(f[3].content)) {
      const pair = labParse(vb.content);
      if (pair[0]?.tag === 0x06) oids.push(oidText(pair[0].content));
    }
  }
  return { oids, reqId };
}

function snmpResponseV1V2c(version: number, community: string, reqId: number, oids: string[]): Buffer {
  const vbs = oids.map((o) => labTlv(0x30, Buffer.concat([labOid(o), labTlv(0x04, Buffer.from(OID_MAP[o] ?? "", "latin1"))])));
  const pdu = labTlv(0xa2, Buffer.concat([labInt(reqId), labInt(0), labInt(0), labTlv(0x30, Buffer.concat(vbs))]));
  return labTlv(0x30, Buffer.concat([labInt(version), labStr(community), pdu]));
}

function snmpV3Message(user: string, reqId: number, oids: string[], engineId: Buffer, isReport: boolean, reportOid?: string): Buffer {
  const globalData = labStr(labTlv(0x30, Buffer.concat([labInt(reqId), labInt(65507), labTlv(0x04, Buffer.from([0x00])), labInt(3)])).toString("latin1"));
  const usm = labStr(labTlv(0x30, Buffer.concat([labStr(engineId.toString("latin1")), labInt(0), labInt(0), labStr(user), labStr(""), labStr("")])).toString("latin1"));
  const vbs = isReport
    ? [labTlv(0x30, Buffer.concat([labOid(reportOid ?? "1.3.6.1.6.3.15.1.1.3.0"), labTlv(0x42, Buffer.from([1]))]))] // Counter32 = 1
    : oids.map((o) => labTlv(0x30, Buffer.concat([labOid(o), labTlv(0x04, Buffer.from(OID_MAP[o] ?? "", "latin1"))])));
  const pdu = labTlv(isReport ? 0xa8 : 0xa2, Buffer.concat([labInt(reqId), labInt(0), labInt(0), labTlv(0x30, Buffer.concat(vbs))]));
  const scoped = labTlv(0x30, Buffer.concat([labStr(engineId.toString("latin1")), labStr(""), pdu]));
  return labTlv(0x30, Buffer.concat([labInt(3), globalData, usm, scoped]));
}

export function startSnmpLab(port = 3161): void {
  const sock = dgram.createSocket("udp4");
  sock.on("message", (data: Buffer, rinfo) => {
    if (process.env.LAB_DEBUG) console.log("snmp-lab RX", data.toString("hex"));
    try {
      const msg = labParse(data)[0];
      if (!msg || msg.tag !== 0x30) return;
      const outer = labParse(msg.content);
      if (!outer.length) return;
      const version = Number(outer[0]?.content.reduce((a, b) => a * 256 + b, 0) ?? -1);
      if (version === 0 || version === 1) {
        const community = outer[1]?.content.toString("latin1") ?? "";
        if (!SNMP_COMMUNITIES.has(community)) return; // wrong community → silence
        const { oids, reqId } = snmpVarbinds(outer[2]?.content ?? Buffer.alloc(0));
        if (process.env.LAB_DEBUG) console.log(`snmp-lab GET v${version === 1 ? "2c" : "1"} comm=${community} oids=[${oids.join(", ")}] reqId=${reqId}`);
        const reply = snmpResponseV1V2c(version, community, reqId, oids);
        if (process.env.LAB_DEBUG) console.log("snmp-lab TX", reply.toString("hex"));
        sock.send(reply, rinfo.port, rinfo.address);
        return;
      }
    if (version === 3) {
      // outer: [version, globalData, secParams, scopedPDU]
      const usm = labParse(outer[2]?.content ?? Buffer.alloc(0))[0];
      const usmFields = labParse(usm?.content ?? Buffer.alloc(0));
      const engineId = usmFields[0]?.content ?? Buffer.alloc(0);
      const user = usmFields[3]?.content.toString("latin1") ?? "";
      const scoped = outer[3];
      const pduNode = scoped?.tag === 0x30 ? labParse(scoped.content).find((n) => n.tag === 0xa0) : scoped;
      const { oids, reqId } = snmpVarbinds(pduNode?.content ?? Buffer.alloc(0));
      if (!engineId.length) {
        // RFC 3412 engine-ID discovery → Report usmStatsUnknownEngineIDs
        sock.send(snmpV3Message(user, reqId, oids, LAB_ENGINE_ID, true, "1.3.6.1.6.3.15.1.1.3.0"), rinfo.port, rinfo.address);
        return;
      }
      if (user === "" || user === "anonymous") {
        // misconfigured: answers noAuthNoPriv
        sock.send(snmpV3Message(user, reqId, oids, engineId, false), rinfo.port, rinfo.address);
      } else {
        // USM authentication enforced → Report usmStatsUnknownUserNames
        sock.send(snmpV3Message(user, reqId, oids, engineId, true, "1.3.6.1.6.3.15.1.1.5.0"), rinfo.port, rinfo.address);
      }
      }
    } catch (e) {
      console.error("snmp-lab handler error:", e);
    }
  });
  sock.on("error", (e: NodeJS.ErrnoException) => console.error(`  lab udp/${port} not started (${e.code}) — already running?`));
  sock.bind(port, HOST);
  console.log(`  snmp-lab        udp/${port} (communities public+private, v3 noAuthNoPriv)`);
}

// ═══ BSON (lab-side, independent) ════════════════════════════════════════════

type LBson = string | number | boolean | null | Buffer | { [k: string]: LBson } | LBson[];

function lbCString(s: string): Buffer {
  return Buffer.concat([Buffer.from(s), Buffer.alloc(1)]);
}
function lbDoc(doc: { [k: string]: LBson }): Buffer {
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(doc)) {
    if (typeof v === "string") {
      const b = Buffer.from(v);
      const l = Buffer.alloc(4);
      l.writeInt32LE(b.length + 1);
      parts.push(Buffer.from([0x02]), lbCString(k), l, b, Buffer.alloc(1));
    } else if (typeof v === "number") {
      if (Number.isInteger(v)) {
        const l = Buffer.alloc(4);
        l.writeInt32LE(v);
        parts.push(Buffer.from([0x10]), lbCString(k), l);
      } else {
        const l = Buffer.alloc(8);
        l.writeDoubleLE(v);
        parts.push(Buffer.from([0x01]), lbCString(k), l);
      }
    } else if (typeof v === "boolean") {
      parts.push(Buffer.from([0x08]), lbCString(k), Buffer.from([v ? 1 : 0]));
    } else if (v === null) {
      parts.push(Buffer.from([0x0a]), lbCString(k));
    } else if (Buffer.isBuffer(v)) {
      const l = Buffer.alloc(4);
      l.writeInt32LE(v.length);
      parts.push(Buffer.from([0x05]), lbCString(k), l, Buffer.from([0x00]), v);
    } else if (Array.isArray(v)) {
      const arr: { [k: string]: LBson } = {};
      v.forEach((x, i) => (arr[String(i)] = x));
      parts.push(Buffer.from([0x04]), lbCString(k), lbDoc(arr));
    } else {
      parts.push(Buffer.from([0x03]), lbCString(k), lbDoc(v));
    }
  }
  const body = Buffer.concat(parts);
  const len = Buffer.alloc(4);
  len.writeInt32LE(body.length + 5);
  return Buffer.concat([len, body, Buffer.alloc(1)]);
}

/** Decode just enough: full doc as nested objects (engine-equivalent subset). */
function lbDecode(buf: Buffer): { [k: string]: unknown } {
  const end = buf.readInt32LE(0);
  let i = 4;
  const out: { [k: string]: unknown } = {};
  while (i < end - 1) {
    const t = buf[i++];
    let key = "";
    while (buf[i] !== 0) key += String.fromCharCode(buf[i++]);
    i++;
    switch (t) {
      case 0x02: {
        const l = buf.readInt32LE(i);
        i += 4;
        out[key] = buf.subarray(i, i + l - 1).toString("utf8");
        i += l;
        break;
      }
      case 0x03:
      case 0x04: {
        const l = buf.readInt32LE(i);
        out[key] = lbDecode(buf.subarray(i, i + l));
        i += l;
        break;
      }
      case 0x05: {
        const l = buf.readInt32LE(i);
        out[key] = buf.subarray(i + 5, i + 5 + l); // return raw binary
        i += 5 + l;
        break;
      }
      case 0x10: {
        out[key] = buf.readInt32LE(i);
        i += 4;
        break;
      }
      case 0x01: {
        out[key] = buf.readDoubleLE(i);
        i += 8;
        break;
      }
      case 0x08: {
        out[key] = buf[i] === 1;
        i += 1;
        break;
      }
      case 0x12: {
        out[key] = Number(buf.readBigInt64LE(i));
        i += 8;
        break;
      }
      case 0x0a:
        out[key] = null;
        break;
      default:
        throw new Error(`lab BSON type 0x${t.toString(16)}`);
    }
  }
  return out;
}

// ═══ MongoDB no-auth lab (TCP 3160) ══════════════════════════════════════════

function opMsgReply(reqId: number, doc: { [k: string]: LBson }): Buffer {
  const body = lbDoc(doc);
  const head = Buffer.alloc(16);
  head.writeInt32LE(16 + 4 + 1 + body.length, 0);
  head.writeInt32LE(1, 4); // server request id
  head.writeInt32LE(reqId, 8); // responseTo
  head.writeInt32LE(2013, 12);
  return Buffer.concat([head, Buffer.alloc(4), Buffer.from([0x00]), body]);
}

function handleMongoCommand(cmdName: string): { [k: string]: LBson } {
  switch (cmdName) {
    case "hello":
    case "ismaster":
      return { ok: 1, isWritablePrimary: true, msg: "isdb", maxWireVersion: 21, minWireVersion: 0, maxBsonObjectSize: 16777216, maxMessageSizeBytes: 48000000, maxWriteBatchSize: 100000, logicalSessionTimeoutMinutes: 30, connectionId: 42 };
    case "buildInfo":
      return { version: "4.0.10", gitVersion: "a4f33947a2c6b5d7b3f0a3e1", versionArray: [4, 0, 10, 0], ok: 1 };
    case "listDatabases":
      return {
        databases: [
          { name: "bankdb", sizeOnDisk: 456778240, empty: false },
          { name: "corebanking", sizeOnDisk: 234567680, empty: false },
          { name: "admin", sizeOnDisk: 32768, empty: true },
          { name: "config", sizeOnDisk: 110592, empty: true },
          { name: "local", sizeOnDisk: 16384, empty: true },
        ],
        totalSize: 691505408,
        ok: 1,
      };
    case "saslStart":
    case "saslContinue":
      return { ok: 0, errmsg: "Authentication is not enabled for this deployment", code: 18, codeName: "AuthenticationFailed" };
    default:
      return { ok: 1 };
  }
}

function readOpMsg(buf: Buffer): { reqId: number; cmdName: string; body: { [k: string]: unknown } } | null {
  if (buf.length < 21) return null;
  const reqId = buf.readInt32LE(4);
  const opCode = buf.readInt32LE(12);
  if (opCode !== 2013) return null;
  const kind = buf[20];
  if (kind !== 0) return null;
  const doc = lbDecode(buf.subarray(21));
  const keys = Object.keys(doc).filter((k) => !k.startsWith("$"));
  return { reqId, cmdName: keys[0] ?? "", body: doc };
}

function startMongoLab(port: number, opts: { scramAuth?: boolean; version?: string; databases?: { name: string; sizeOnDisk: number; empty: boolean }[] }): void {
  const scramAuth = opts.scramAuth ?? false;
  const version = opts.version ?? "4.0.10";
  const databases = opts.databases ?? [
    { name: "bankdb", sizeOnDisk: 456778240, empty: false },
    { name: "corebanking", sizeOnDisk: 234567680, empty: false },
    { name: "admin", sizeOnDisk: 32768, empty: true },
    { name: "config", sizeOnDisk: 110592, empty: true },
    { name: "local", sizeOnDisk: 16384, empty: true },
  ];
  const MONGO_USER = "audit";
  const MONGO_PASS = "AdwaAudit2026!";
  const SALT = Buffer.from("0123456789abcdef"); // deterministic lab salt
  const ITER = 4096;
  const saltedPassword = pbkdf2Sync(MONGO_PASS, SALT, ITER, 32, "sha256");
  let connCounter = 0;

  const server = net.createServer((sock) => {
    const connId = ++connCounter;
    let authed = false;
    let buf = Buffer.alloc(0);
    let scram = { clientFirstBare: "", serverFirst: "", convId: 0 };
    sock.on("data", (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 16) break;
        const len = buf.readInt32LE(0);
        if (buf.length < len) break;
        const frame = buf.subarray(0, len);
        buf = buf.subarray(len);
        const msg = readOpMsg(frame);
        if (!msg) {
          sock.destroy();
          return;
        }
        const reply = (() => {
          if (!scramAuth) return opMsgReply(msg.reqId, handleMongoCommand(msg.cmdName));
          if (authed) {
            if (msg.cmdName === "buildInfo") {
              return opMsgReply(msg.reqId, { version, gitVersion: "lab-" + version, versionArray: version.split(".").map(Number).concat([0]), ok: 1 });
            }
            if (msg.cmdName === "listDatabases") {
              return opMsgReply(msg.reqId, { databases, totalSize: databases.reduce((a, x) => a + x.sizeOnDisk, 0), ok: 1 });
            }
            if (msg.cmdName === "hello" || msg.cmdName === "ismaster") {
              return opMsgReply(msg.reqId, { ok: 1, isWritablePrimary: true, maxWireVersion: 21, minWireVersion: 0, connectionId: connId });
            }
            return opMsgReply(msg.reqId, { ok: 1 });
          }
          if (msg.cmdName === "hello" || msg.cmdName === "ismaster") {
            return opMsgReply(msg.reqId, { ok: 1, isWritablePrimary: true, maxWireVersion: 21, minWireVersion: 0, connectionId: connId });
          }
          if (msg.cmdName === "saslStart") {
            const mech = String(msg.body.mechanism ?? "");
            const payload = Buffer.isBuffer(msg.body.payload) ? (msg.body.payload as Buffer).toString("utf8") : "";
            if (mech !== "SCRAM-SHA-256") {
              return opMsgReply(msg.reqId, { ok: 0, errmsg: "Unsupported mechanism", code: 33, codeName: "InvalidOptions" });
            }
            const bare = payload.replace(/^n,,/, "");
            const user = /n=([^,]+)/.exec(bare)?.[1] ?? "";
            if (user !== MONGO_USER) {
              return opMsgReply(msg.reqId, { ok: 0, errmsg: "UserNotFound: Could not find user", code: 18, codeName: "AuthenticationFailed" });
            }
            const cnonce = /r=([^,]+)/.exec(bare)?.[1] ?? "";
            const snonce = randomBytes(12).toString("base64");
            const serverFirst = `r=${cnonce}${snonce},s=${SALT.toString("base64")},i=${ITER}`;
            scram = { clientFirstBare: bare, serverFirst, convId: 1 };
            return opMsgReply(msg.reqId, { ok: 1, conversationId: 1, payload: Buffer.from(serverFirst, "utf8"), done: false });
          }
          if (msg.cmdName === "saslContinue") {
            const payload = Buffer.isBuffer(msg.body.payload) ? (msg.body.payload as Buffer).toString("utf8") : "";
            if (!payload) {
              authed = true;
              return opMsgReply(msg.reqId, { ok: 1, conversationId: 1, payload: Buffer.alloc(0), done: true });
            }
            const m = /^c=biws,r=([^,]+),p=(.+)$/.exec(payload);
            if (!m) return opMsgReply(msg.reqId, { ok: 0, errmsg: "Malformed SCRAM client-final", code: 18, codeName: "AuthenticationFailed" });
            const [, fullNonce, proofB64] = m;
            const clientFinalNoProof = `c=biws,r=${fullNonce}`;
            const authMessage = `${scram.clientFirstBare},${scram.serverFirst},${clientFinalNoProof}`;
            const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
            const storedKey = createHash("sha256").update(clientKey).digest();
            const clientSig = createHmac("sha256", storedKey).update(authMessage).digest();
            const expected = Buffer.alloc(clientKey.length);
            for (let i = 0; i < clientKey.length; i++) expected[i] = clientKey[i] ^ clientSig[i];
            const received = Buffer.from(proofB64, "base64");
            if (expected.length !== received.length || expected.some((b, i) => b !== received[i])) {
              return opMsgReply(msg.reqId, { ok: 0, errmsg: "SCRAM-SHA-256 authentication failed (proof mismatch)", code: 18, codeName: "AuthenticationFailed" });
            }
            const serverKey = createHmac("sha256", saltedPassword).update("Server Key").digest();
            const serverSig = createHmac("sha256", serverKey).update(authMessage).digest();
            return opMsgReply(msg.reqId, { ok: 1, conversationId: 1, payload: Buffer.from(`v=${serverSig.toString("base64")}`, "utf8"), done: false });
          }
          // unauthenticated anything else → Unauthorized
          return opMsgReply(msg.reqId, { ok: 0, errmsg: `command ${msg.cmdName} requires authentication`, code: 13, codeName: "Unauthorized" });
        })();
        sock.write(reply);
      }
    });
    sock.on("error", () => sock.destroy());
  });
  server.on("error", (e: NodeJS.ErrnoException) => console.error(`  lab tcp/${port} not started (${e.code}) — already running?`));
  server.listen(port, HOST);
  const label = scramAuth ? `SCRAM-SHA-256 auth enforced, buildInfo ${version}` : `NO AUTH, buildInfo ${version}`;
  console.log(`  mongo-lab       tcp/${port} (${label})`);
}

// ═══ MariaDB lab (TCP 3162) ══════════════════════════════════════════════════

const MYSQL_VERSION = "5.5.62-MariaDB-1~wheezy-log";
const MYSQL_ACCOUNTS: Record<string, string> = {
  audit: "AdwaAudit2026!",
  monitor: "Monitor!2026",
};

function mysqlNativeToken(password: string, scramble: Buffer): Buffer {
  if (!password.length) return Buffer.alloc(0);
  const h1 = createHash("sha1").update(password).digest();
  const h2 = createHash("sha1").update(h1).digest();
  const h3 = createHash("sha1").update(Buffer.concat([scramble, h2])).digest();
  const out = Buffer.alloc(h1.length);
  for (let i = 0; i < h1.length; i++) out[i] = h1[i] ^ h3[i];
  return out;
}

function mysqlPacket(seq: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUIntLE(payload.length, 0, 3);
  head.writeUInt8(seq & 0xff, 3);
  return Buffer.concat([head, payload]);
}

function errPacket(code: number, sqlState: string, message: string): Buffer {
  return Buffer.concat([Buffer.from([0xff]), (() => { const b = Buffer.alloc(2); b.writeUInt16LE(code); return b; })(), Buffer.from(`#${sqlState}`, "ascii"), Buffer.from(message, "utf8")]);
}

function okPacket(): Buffer {
  // OK: 0x00, lenenc affectedRows=0, lenenc lastInsertId=0, status 0x0002, warnings 0
  return Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]);
}

function eofPacket(): Buffer {
  return Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]);
}

function colDef(name: string): Buffer {
  const part = (s: string) => Buffer.concat([Buffer.from([s.length]), Buffer.from(s, "utf8")]);
  const fixed = Buffer.concat([
    Buffer.from([0x0c]),
    (() => { const b = Buffer.alloc(2); b.writeUInt16LE(0x21); return b; })(), // charset utf8
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(100); return b; })(), // column length
    Buffer.from([0xfd]), // VAR_STRING
    (() => { const b = Buffer.alloc(2); return b; })(), // flags
    Buffer.from([0x00]), // decimals
    (() => { const b = Buffer.alloc(2); return b; })(), // filler
  ]);
  return Buffer.concat([part("def"), part(""), part(""), part(""), part(name), part(name), fixed]);
}

function rowPacket(values: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const v of values) {
    parts.push(Buffer.from([Buffer.byteLength(v)]), Buffer.from(v, "utf8"));
  }
  return Buffer.concat(parts);
}

function startMysqlLab(port = 3162): void {
  const server = net.createServer((sock) => {
    const scramble = createHash("sha256").update(`s${Math.random()}`).digest().subarray(0, 20);
    const threadId = (Math.floor(Math.random() * 9000) + 1000) >>> 0;
    // Handshake v10
    const caps = (1 | 4 | 0x200 | 0x2000 | 0x8000 | 0x80000 | 0x8) >>> 0;
    const parts: Buffer[] = [
      Buffer.from([0x0a]),
      Buffer.from(MYSQL_VERSION + "\0", "utf8"),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(threadId); return b; })(),
      scramble.subarray(0, 8),
      Buffer.alloc(1),
      (() => { const b = Buffer.alloc(2); b.writeUInt16LE(caps & 0xffff); return b; })(),
      Buffer.from([0x08]), // charset latin1_swedish_ci
      (() => { const b = Buffer.alloc(2); b.writeUInt16LE(0x0002); return b; })(), // status autocommit
      (() => { const b = Buffer.alloc(2); b.writeUInt16LE((caps >> 16) & 0xffff); return b; })(),
      Buffer.from([21]), // auth-plugin-data length
      Buffer.alloc(10),
      scramble.subarray(8, 20),
      Buffer.alloc(1),
      Buffer.from("mysql_native_password\0", "ascii"),
    ];
    sock.write(mysqlPacket(0, Buffer.concat(parts)));

    let buf = Buffer.alloc(0);
    let seq = 1;
    let authed = false;
    sock.on("data", (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 4) break;
        const plen = buf.readUIntLE(0, 3);
        if (buf.length < 4 + plen) break;
        const frameSeq = buf[3];
        const payload = buf.subarray(4, 4 + plen);
        buf = buf.subarray(4 + plen);
        seq = frameSeq + 1;
        // HandshakeResponse41?
        const cap = payload.readUInt32LE(0);
        if (!authed && (cap & 0x200) && plen > 32) {
          let i = 4 + 4 + 1 + 23;
          const userEnd = payload.indexOf(0, i);
          const user = payload.subarray(i, userEnd).toString("utf8");
          i = userEnd + 1;
          const tlen = payload[i];
          const token = payload.subarray(i + 1, i + 1 + tlen);
          const expectedUser = MYSQL_ACCOUNTS[user];
          const expected = expectedUser !== undefined ? mysqlNativeToken(expectedUser, scramble) : null;
          if (expected && token.length === expected.length && expected.every((b, k) => b === token[k])) {
            authed = true;
            sock.write(mysqlPacket(seq, okPacket()));
          } else {
            sock.write(
              mysqlPacket(
                seq,
                errPacket(1045, "28000", `Access denied for user '${user}'@'${HOST}' (using password: ${token.length ? "YES" : "NO"})`),
              ),
            );
          }
          continue;
        }
        if (payload[0] === 0x03) {
          if (!authed) {
            sock.write(mysqlPacket(seq, errPacket(1046, "3D000", "No database selected (not authenticated)")));
            continue;
          }
          const sql = payload.subarray(1).toString("utf8").trim().replace(/;$/, "");
          if (sql === "SELECT @@version") {
            sock.write(mysqlPacket(seq, Buffer.from([0x01])));
            sock.write(mysqlPacket(seq + 1, colDef("@@version")));
            sock.write(mysqlPacket(seq + 2, eofPacket()));
            sock.write(mysqlPacket(seq + 3, rowPacket([MYSQL_VERSION.split("-")[0]])));
            sock.write(mysqlPacket(seq + 4, eofPacket()));
          } else if (sql === "SELECT @@version_comment") {
            sock.write(mysqlPacket(seq, Buffer.from([0x01])));
            sock.write(mysqlPacket(seq + 1, colDef("@@version_comment")));
            sock.write(mysqlPacket(seq + 2, eofPacket()));
            sock.write(mysqlPacket(seq + 3, rowPacket(["MariaDB Server"])));
            sock.write(mysqlPacket(seq + 4, eofPacket()));
          } else if (sql === "SELECT user()") {
            sock.write(mysqlPacket(seq, Buffer.from([0x01])));
            sock.write(mysqlPacket(seq + 1, colDef("user()")));
            sock.write(mysqlPacket(seq + 2, eofPacket()));
            sock.write(mysqlPacket(seq + 3, rowPacket(["audit@localhost"])));
            sock.write(mysqlPacket(seq + 4, eofPacket()));
          } else {
            sock.write(mysqlPacket(seq, errPacket(1064, "42000", "You have an error in your SQL syntax (lab rejects everything else)")));
          }
          continue;
        }
        if (payload[0] === 0x01) {
          // COM_QUIT
          sock.end();
          continue;
        }
      }
    });
    sock.on("error", () => sock.destroy());
  });
  server.on("error", (e: NodeJS.ErrnoException) => console.error(`  lab tcp/${port} not started (${e.code}) — already running?`));
  server.listen(port, HOST);
  console.log(`  mysql-lab       tcp/${port} (auth enabled: audit/AdwaAudit2026! — ${MYSQL_VERSION})`);
}

// ═══ bootstrap ════════════════════════════════════════════════════════════════

export function startProtocolLabs(): void {
  startSnmpLab(3161);
  startMongoLab(3160, { scramAuth: false, version: "4.0.10" });
  startMysqlLab(3162);
  startMongoLab(3164, { scramAuth: true, version: "5.0.5", databases: [
    { name: "bankcore", sizeOnDisk: 234567680, empty: false },
    { name: "admin", sizeOnDisk: 32768, empty: true },
    { name: "config", sizeOnDisk: 110592, empty: true },
    { name: "local", sizeOnDisk: 16384, empty: true },
  ] });
}
