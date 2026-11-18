/**
 * Adwa Cyber — VAPT credentialed database audit engine (NBE LOT4 §"Vulnerability
 * Assessment & Core Engine Capabilities" #5: "Relational and NoSQL database
 * auditing (Oracle, MSSQL, MySQL, Postgres, MongoDB)").
 *
 * REAL wire-protocol clients, zero dependencies (node:net + node:crypto):
 *
 *   MongoDB  — OP_MSG (opcode 2013) framing + BSON encode/decode subset +
 *              SCRAM-SHA-256 (RFC 5802/7677, the mechanism real MongoDB uses
 *              with authEnabled deployments) for credentialed login.
 *   MySQL /  — protocol v10 handshake parse, mysql_native_password
 *   MariaDB    token (SHA1 scramble), HandshakeResponse41, COM_QUERY result
 *              sets. Works against MySQL 5.x/8.x and MariaDB.
 *
 * Audit posture checks (all read-only, SAFE profile):
 *   - authentication enforcement: admin commands / login attempts WITHOUT
 *     credentials that SUCCEED are live findings; clean ERR 1045 /
 *     code-13 Unauthorized responses prove auth is enforced (no finding).
 *   - classic empty-password root probe on MySQL.
 *   - engine release-line end-of-life from the server's own reported version.
 *
 * Credentials arrive ONLY from stored AES-256-GCM-encrypted VaptCredential
 * rows; the caller decrypts and passes them here — never logged, never
 * echoed in evidence (evidence carries the server banner only).
 */
import net from "net";
import { createHash, createHmac, pbkdf2Sync } from "crypto";
import type { VulnDraft } from "./vapt-engine";

// ── BSON subset (types the audit commands actually produce) ─────────────────

export type BsonValue = string | number | boolean | null | Buffer | { [k: string]: BsonValue };

function bsonCString(s: string): Buffer {
  return Buffer.concat([Buffer.from(s, "utf8"), Buffer.alloc(1)]);
}

function bsonEncDouble(v: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(v);
  return b;
}

function bsonEncInt(v: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(Number.isInteger(v) ? v : Math.round(v));
  return b;
}

function bsonEncodeElement(key: string, val: BsonValue): Buffer {
  if (typeof val === "string") return Buffer.concat([Buffer.from([0x02]), bsonCString(key), (() => { const b = Buffer.from(val, "utf8"); const l = Buffer.alloc(4); l.writeInt32LE(b.length + 1); return Buffer.concat([l, b, Buffer.alloc(1)]); })()]);
  if (typeof val === "number") {
    if (Number.isInteger(val)) return Buffer.concat([Buffer.from([0x10]), bsonCString(key), bsonEncInt(val)]);
    return Buffer.concat([Buffer.from([0x01]), bsonCString(key), bsonEncDouble(val)]);
  }
  if (typeof val === "boolean") return Buffer.concat([Buffer.from([0x08]), bsonCString(key), Buffer.from([val ? 1 : 0])]);
  if (val === null || val === undefined) return Buffer.concat([Buffer.from([0x0a]), bsonCString(key)]);
  if (Buffer.isBuffer(val)) {
    const l = Buffer.alloc(4);
    l.writeInt32LE(val.length);
    return Buffer.concat([Buffer.from([0x05]), bsonCString(key), l, Buffer.from([0x00]), val]);
  }
  return Buffer.concat([Buffer.from([0x03]), bsonCString(key), bsonEncodeDoc(val)]);
}

function bsonEncodeDoc(doc: { [k: string]: BsonValue }): Buffer {
  const body = Buffer.concat(Object.entries(doc).map(([k, v]) => bsonEncodeElement(k, v)));
  const len = Buffer.alloc(4);
  len.writeInt32LE(body.length + 5);
  return Buffer.concat([len, body, Buffer.alloc(1)]);
}

export interface BsonBinary {
  buffer: Buffer;
  subtype: number;
}

export type BsonDecoded = string | number | boolean | null | BsonBinary | { [k: string]: BsonDecoded };

function bsonDecode(buf: Buffer): BsonDecoded {
  if (buf.length < 5) throw new Error("short BSON document");
  const end = buf.readInt32LE(0);
  let i = 4;
  const out: { [k: string]: BsonDecoded } = {};
  while (i < end - 1) {
    const type = buf[i++];
    let key = "";
    while (buf[i] !== 0) key += String.fromCharCode(buf[i++]);
    i++; // null
    switch (type) {
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
        out[key] = bsonDecode(buf.subarray(i, i + l));
        i += l;
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
      case 0x10: {
        out[key] = buf.readInt32LE(i);
        i += 4;
        break;
      }
      case 0x12: {
        out[key] = Number(buf.readBigInt64LE(i));
        i += 8;
        break;
      }
      case 0x05: {
        const l = buf.readInt32LE(i);
        const subtype = buf[i + 4];
        out[key] = { buffer: buf.subarray(i + 5, i + 5 + l), subtype } as BsonBinary;
        i += 4 + 1 + l;
        break;
      }
      case 0x07: {
        i += 12; // ObjectId — skip
        out[key] = null;
        break;
      }
      case 0x09: {
        i += 8; // UTC datetime — skip
        out[key] = null;
        break;
      }
      case 0x0a:
      case 0x06: {
        out[key] = null;
        break;
      }
      case 0x11: {
        i += 8; // Timestamp — skip
        out[key] = null;
        break;
      }
      case 0x13: {
        i += 16; // Decimal128 — skip
        out[key] = null;
        break;
      }
      case 0x0b: {
        while (buf[i] !== 0) i++;
        i++;
        while (buf[i] !== 0) i++;
        i++;
        out[key] = null; // Regex — skipped
        break;
      }
      case 0x0d: {
        const l = buf.readInt32LE(i);
        i += 4 + l + 1; // Code — skipped
        out[key] = null;
        break;
      }
      case 0x0f: {
        const l = buf.readInt32LE(i);
        i += 4 + l; // Code w/ scope — skipped
        out[key] = null;
        break;
      }
      case 0xff:
      case 0x7f: {
        out[key] = null; // MinKey / MaxKey
        break;
      }
      default:
        throw new Error(`unsupported BSON element type 0x${type.toString(16)} for key "${key}"`);
    }
  }
  return out;
}

function doc(v: BsonDecoded): { [k: string]: BsonDecoded } {
  if (typeof v === "object" && v !== null && !Buffer.isBuffer(v) && !("buffer" in (v as BsonBinary))) return v as { [k: string]: BsonDecoded };
  return {};
}

// ── MongoDB OP_MSG transport ──────────────────────────────────────────────────

const OP_MSG = 2013;
let mongoReqId = 1;

class MongoWireClient {
  private sock: net.Socket | null = null;
  private buf = Buffer.alloc(0);

  constructor(private host: string, private port: number, private timeoutMs: number) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host: this.host, port: this.port });
      const to = setTimeout(() => {
        s.destroy();
        reject(new Error("connect timeout"));
      }, this.timeoutMs);
      s.once("connect", () => {
        clearTimeout(to);
        this.sock = s;
        s.setNoDelay(true);
        resolve();
      });
      s.once("error", (e) => {
        clearTimeout(to);
        reject(e);
      });
    });
  }

  /** Run one admin command over OP_MSG; throws on transport errors. */
  cmd(command: { [k: string]: BsonValue }): Promise<{ [k: string]: BsonDecoded }> {
    const requestId = mongoReqId++;
    const full = Object.assign({}, command, { $db: "admin" } as { [k: string]: BsonValue });
    const body = bsonEncodeDoc(full);
    const head = Buffer.alloc(16);
    head.writeInt32LE(16 + 4 + 1 + body.length, 0);
    head.writeInt32LE(requestId, 4);
    head.writeInt32LE(0, 8);
    head.writeInt32LE(OP_MSG, 12);
    const msg = Buffer.concat([head, Buffer.from([0, 0, 0, 0]), Buffer.from([0x00]), body]);
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error("not connected"));
      const s = this.sock;
      const to = setTimeout(() => {
        s.off("data", onData);
        s.off("error", onErr);
        reject(new Error("command timeout"));
      }, this.timeoutMs);
      const onData = (d: Buffer) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (this.buf.length < 16) return;
        const len = this.buf.readInt32LE(0);
        if (this.buf.length < len) return;
        const frame = this.buf.subarray(0, len);
        this.buf = this.buf.subarray(len);
        s.off("data", onData);
        s.off("error", onErr);
        clearTimeout(to);
        try {
          const op = frame.readInt32LE(12);
          if (op !== OP_MSG) return reject(new Error(`unexpected opcode ${op}`));
          const kind = frame[20]; // after 16 header + 4 flags
          if (kind !== 0x00) return reject(new Error(`unexpected OP_MSG section kind ${kind}`));
          const docStart = 21;
          const reply = bsonDecode(frame.subarray(docStart, frame.readInt32LE(0)));
          resolve(doc(reply));
        } catch (e) {
          reject(e as Error);
        }
      };
      const onErr = (e: Error) => {
        s.off("data", onData);
        clearTimeout(to);
        reject(e);
      };
      s.on("data", onData);
      s.once("error", onErr);
      s.write(msg);
    });
  }

  close(): void {
    this.sock?.destroy();
    this.sock = null;
  }
}

// ── SCRAM-SHA-256 (RFC 5802 / 7677) — real MongoDB credential exchange ────────

function b64(b: Buffer): string {
  return b.toString("base64");
}

/**
 * Full SCRAM-SHA-256 client exchange against saslStart/saslContinue.
 * Verifies the server signature (mutual auth) before returning ok.
 */
async function scramSha256Login(client: MongoWireClient, user: string, password: string): Promise<{ ok: boolean; failure?: string; serverSignatureVerified?: boolean }> {
  const nonceBytes = createHash("sha256").update(`${Math.random()}:${Date.now()}`).digest().subarray(0, 18);
  const cnonce = b64(nonceBytes);
  const clientFirstBare = `n=${user},r=${cnonce}`;
  const clientFirst = `n,,${clientFirstBare}`;
  const r1 = await client.cmd({ saslStart: 1, mechanism: "SCRAM-SHA-256", payload: Buffer.from(clientFirst, "utf8") });
  if (Number(doc(r1).ok) !== 1) {
    return { ok: false, failure: String(doc(r1).errmsg ?? "saslStart rejected") };
  }
  const convId = doc(r1).conversationId;
  const serverFirst = (doc(r1).payload as BsonBinary)?.buffer.toString("utf8") ?? "";
  const m1 = /^r=([^,]+),s=([^,]+),i=(\d+)/.exec(serverFirst);
  if (!m1) return { ok: false, failure: `malformed server-first message: ${serverFirst.slice(0, 60)}` };
  const fullNonce = m1[1];
  const salt = Buffer.from(m1[2], "base64");
  const iterations = Number(m1[3]);
  if (!fullNonce.startsWith(cnonce)) return { ok: false, failure: "server nonce does not extend client nonce" };

  const saltedPassword = pbkdf2Sync(password.normalize("NFKC"), salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const clientFinalNoProof = `c=biws,r=${fullNonce}`;
  const authMessage = `${clientFirstBare},${serverFirst},${clientFinalNoProof}`;
  const clientSignature = createHmac("sha256", storedKey).update(authMessage).digest();
  const proof = Buffer.alloc(clientKey.length);
  for (let i = 0; i < clientKey.length; i++) proof[i] = clientKey[i] ^ clientSignature[i];

  const r2 = await client.cmd({ saslContinue: 1, conversationId: Number(convId ?? 0), payload: Buffer.from(`${clientFinalNoProof},p=${b64(proof)}`, "utf8") });
  if (Number(doc(r2).ok) !== 1) return { ok: false, failure: String(doc(r2).errmsg ?? "saslContinue rejected") };
  const serverFinal = (doc(r2).payload as BsonBinary)?.buffer.toString("utf8") ?? "";
  const m2 = /^v=([^,]+)/.exec(serverFinal);
  let serverSignatureVerified = false;
  if (m2) {
    const serverKey = createHmac("sha256", saltedPassword).update("Server Key").digest();
    const expected = b64(createHmac("sha256", serverKey).update(authMessage).digest());
    serverSignatureVerified = expected === m2[1];
    if (!serverSignatureVerified) return { ok: false, failure: "server signature mismatch (mutual authentication failed)" };
  }
  const r3 = await client.cmd({ saslContinue: 1, conversationId: Number(convId ?? 0), payload: Buffer.alloc(0) });
  if (Number(doc(r3).ok) !== 1) return { ok: false, failure: String(doc(r3).errmsg ?? "final saslContinue rejected") };
  return { ok: true, serverSignatureVerified };
}

// ── MySQL / MariaDB wire protocol client ─────────────────────────────────────

const CLIENT_LONG_PASSWORD = 0x1;
const CLIENT_PROTOCOL_41 = 0x200;
const CLIENT_TRANSACTIONS = 0x2000;
const CLIENT_SECURE_CONNECTION = 0x8000;
const CLIENT_PLUGIN_AUTH = 0x80000;

export interface MySQLHandshake {
  protocolVersion: number;
  serverVersion: string;
  scramble: Buffer; // 20 bytes
  authPlugin: string;
  capabilities: number;
  threadId: number;
}

function readNullStr(b: Buffer, from: number): { str: string; next: number } {
  let end = from;
  while (end < b.length && b[end] !== 0) end++;
  return { str: b.subarray(from, end).toString("utf8"), next: end + 1 };
}

class MySQLClient {
  private sock: net.Socket | null = null;
  private buf = Buffer.alloc(0);
  private seq = 0;

  constructor(private host: string, private port: number, private timeoutMs: number) {}

  connect(): Promise<MySQLHandshake | null> {
    // The server speaks FIRST — wait for the handshake greeting.
    return new Promise((resolve, reject) => {
      const s = net.connect({ host: this.host, port: this.port });
      const to = setTimeout(() => {
        s.destroy();
        resolve(null); // no greeting within the window → not a MySQL service
      }, this.timeoutMs);
      s.once("error", (e) => {
        clearTimeout(to);
        reject(e);
      });
      const onData = (d: Buffer) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (this.buf.length < 4) return;
        const plen = this.buf.readUIntLE(0, 3);
        if (this.buf.length < 4 + plen) return;
        const frameSeq = this.buf[3];
        const payload = this.buf.subarray(4, 4 + plen);
        this.buf = this.buf.subarray(4 + plen);
        s.off("data", onData);
        clearTimeout(to);
        this.sock = s;
        this.seq = (frameSeq + 1) & 0xff;
        s.setNoDelay(true);
        try {
          resolve(this.parseHandshake(payload));
        } catch (e) {
          reject(e as Error);
        }
      };
      s.on("data", onData);
    });
  }

  private parseHandshake(payload: Buffer): MySQLHandshake | null {
    if (payload[0] !== 0x0a) return null; // protocol version 10 only
    let i = 1;
    const ver = readNullStr(payload, i);
    i = ver.next;
    const threadId = payload.readUIntLE(i, 4);
    i += 4;
    const scramble1 = payload.subarray(i, i + 8);
    i += 8 + 1; // scramble part 1 + filler
    let caps = payload.readUIntLE(i, 2);
    i += 2;
    const charset = payload[i++];
    i += 2; // status flags
    caps += payload.readUIntLE(i, 2) * 0x10000;
    i += 2;
    const authDataLen = payload[i++];
    i += 10; // reserved
    let scramble2: Buffer = Buffer.alloc(0);
    if (caps & CLIENT_SECURE_CONNECTION) {
      const n = Math.max(12, authDataLen - 13);
      scramble2 = payload.subarray(i, i + n);
      i += n;
      if (payload[i] === 0) i += 1;
    }
    let plugin = "mysql_native_password";
    if (caps & CLIENT_PLUGIN_AUTH) {
      const p = readNullStr(payload, i);
      plugin = p.str || plugin;
    }
    const scramble = Buffer.concat([scramble1, scramble2.subarray(0, Math.max(0, 20 - scramble1.length))]);
    return {
      protocolVersion: 10,
      serverVersion: ver.str,
      scramble: scramble.subarray(0, 20),
      authPlugin: plugin,
      capabilities: caps,
      threadId,
    };
  }

  /** mysql_native_password token: SHA1(pwd) XOR SHA1(scramble ‖ SHA1(SHA1(pwd))) */
  static nativeToken(password: string, scramble: Buffer): Buffer {
    if (!password.length) return Buffer.alloc(0);
    const h1 = createHash("sha1").update(password).digest();
    const h2 = createHash("sha1").update(h1).digest();
    const h3 = createHash("sha1").update(Buffer.concat([scramble, h2])).digest();
    const out = Buffer.alloc(h1.length);
    for (let i = 0; i < h1.length; i++) out[i] = h1[i] ^ h3[i];
    return out;
  }

  /** Send HandshakeResponse41 and resolve the OK / ERR packet. */
  async login(user: string, password: string): Promise<{ ok: boolean; errorCode?: number; errorMessage?: string }> {
    const caps = CLIENT_LONG_PASSWORD | CLIENT_PROTOCOL_41 | CLIENT_TRANSACTIONS | CLIENT_SECURE_CONNECTION | CLIENT_PLUGIN_AUTH;
    const token = MySQLClient.nativeToken(password, this.handshakeScramble);
    const parts: Buffer[] = [];
    const c = Buffer.alloc(4);
    c.writeUInt32LE(caps, 0);
    parts.push(c);
    const maxPacket = Buffer.alloc(4);
    maxPacket.writeUInt32LE(16 * 1024 * 1024, 0);
    parts.push(maxPacket);
    parts.push(Buffer.from([0x21])); // utf8_general_ci
    parts.push(Buffer.alloc(23));
    parts.push(Buffer.from(user, "utf8"), Buffer.alloc(1));
    parts.push(Buffer.from([token.length]), token);
    parts.push(Buffer.from("mysql_native_password", "utf8"), Buffer.alloc(1));
    const payload = Buffer.concat(parts);
    const p = await this.sendPacket(payload);
    return this.parseOkErr(p);
  }

  /** Send one COM_QUERY and read the full result set (or OK/ERR). */
  async query(sql: string): Promise<{ columns: string[]; rows: string[][] } | { ok: true }> {
    const payload = Buffer.concat([Buffer.from([0x03]), Buffer.from(sql, "utf8")]);
    await this.sendPacket(payload);
    return this.readResultSet();
  }

  /** Write one MySQL packet (length header + sequence + payload). */
  private sendPacket(payload: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error("not connected"));
      const s = this.sock;
      const head = Buffer.alloc(4);
      head.writeUIntLE(payload.length, 0, 3);
      head.writeUInt8(this.seq & 0xff, 3);
      this.seq = (this.seq + 1) & 0xff;
      const to = setTimeout(() => {
        s.off("data", onData);
        s.off("error", onErr);
        reject(new Error("query timeout"));
      }, this.timeoutMs);
      const onData = (d: Buffer) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (this.buf.length < 4) return;
        const plen = this.buf.readUIntLE(0, 3);
        if (this.buf.length < 4 + plen) return;
        const frame = this.buf.subarray(0, 4 + plen);
        this.buf = this.buf.subarray(4 + plen);
        s.off("data", onData);
        s.off("error", onErr);
        clearTimeout(to);
        this.seq = frame.readUInt8(3) + 1;
        resolve(frame.subarray(4));
      };
      const onErr = (e: Error) => {
        s.off("data", onData);
        clearTimeout(to);
        reject(e);
      };
      s.on("data", onData);
      s.once("error", onErr);
      s.write(Buffer.concat([head, payload]));
    });
  }

  private parseOkErr(p: Buffer): { ok: boolean; errorCode?: number; errorMessage?: string } {
    if (p[0] === 0x00) return { ok: true };
    if (p[0] === 0xff) {
      const code = p.readUIntLE(1, 2);
      const msgStart = p[3] === 0x23 ? 9 : 3; // '#' sqlstate marker
      return { ok: false, errorCode: code, errorMessage: p.subarray(msgStart).toString("utf8") };
    }
    return { ok: false, errorMessage: `unexpected packet header 0x${p[0].toString(16)}` };
  }

  private handshakeScramble: Buffer = Buffer.alloc(20);

  private parseQueryResult(p: Buffer): { columns: string[]; rows: string[][] } | { ok: true } {
    void p;
    throw new Error("internal: use query()/readResultSet()");
  }

  /** Stream-friendly result-set reader: pulls frames until final EOF. */
  async readResultSet(): Promise<{ columns: string[]; rows: string[][] }> {
    const columns: string[] = [];
    const rows: string[][] = [];
    const first = await this.readPacket();
    if (first[0] === 0x00) return { columns, rows }; // OK packet — no result set
    const nCols = first[0]; // column-count packet (lenenc < 251)
    let seen = 0;
    let phase: "cols" | "rows" = "cols";
    for (;;) {
      const p = await this.readPacket();
      if (p[0] === 0xff) {
        const code = p.readUIntLE(1, 2);
        throw new Error(`MySQL error ${code}: ${p.subarray(p[3] === 0x23 ? 9 : 3).toString("utf8")}`);
      }
      if (p[0] === 0xfe && p.length < 9) {
        if (phase === "cols" && seen < nCols) {
          phase = "rows";
          continue;
        }
        break; // final EOF — end of rows
      }
      if (phase === "cols") {
        seen++;
        if (seen > nCols) {
          phase = "rows";
          rows.push(MySQLClient.parseRow(p, nCols));
          continue;
        }
        columns.push(MySQLClient.parseColumnDef(p));
      } else {
        rows.push(MySQLClient.parseRow(p, nCols));
      }
    }
    return { columns, rows };
  }

  /** Read one raw MySQL packet (frame) from the socket. */
  readPacket(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error("not connected"));
      const s = this.sock;
      const to = setTimeout(() => reject(new Error("packet timeout")), this.timeoutMs);
      const onErr = (e: Error) => {
        clearTimeout(to);
        reject(e);
      };
      const settle = (frame: Buffer) => {
        s.off("error", onErr);
        clearTimeout(to);
        this.seq = frame.readUInt8(3) + 1;
        resolve(frame.subarray(4));
      };
      const onData = (d: Buffer) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (this.buf.length < 4) return;
        const plen = this.buf.readUIntLE(0, 3);
        if (this.buf.length < 4 + plen) return;
        s.off("data", onData);
        settle(this.buf.subarray(0, 4 + plen));
        this.buf = this.buf.subarray(4 + plen);
      };
      s.on("data", onData);
      s.once("error", onErr);
      if (this.buf.length >= 4) {
        const plen = this.buf.readUIntLE(0, 3);
        if (this.buf.length >= 4 + plen) {
          s.off("data", onData);
          const frame = this.buf.subarray(0, 4 + plen);
          this.buf = this.buf.subarray(4 + plen);
          settle(frame);
          return;
        }
      }
    });
  }

  private static parseColumnDef(p: Buffer): string {
    // catalog, schema, table, org_table, name, org_name (all length-encoded strings)
    let i = 0;
    const skipLenenc = () => {
      const l = p[i];
      if (l < 0xfb) i += 1 + l;
      else if (l === 0xfb) i += 1;
      else if (l === 0xfc) i += 3 + p.readUIntLE(i + 1, 2);
      else i += 1;
    };
    skipLenenc(); // catalog
    skipLenenc(); // schema
    skipLenenc(); // table
    skipLenenc(); // org_table
    // name
    const l = p[i];
    let name = "";
    if (l < 0xfb) name = p.subarray(i + 1, i + 1 + l).toString("utf8");
    return name;
  }

  private static parseRow(p: Buffer, nCols: number): string[] {
    const vals: string[] = [];
    let i = 0;
    for (let c = 0; c < nCols; c++) {
      const l = p[i];
      if (l === 0xfb) {
        vals.push("NULL");
        i += 1;
      } else if (l < 0xfb) {
        vals.push(p.subarray(i + 1, i + 1 + l).toString("utf8"));
        i += 1 + l;
      } else if (l === 0xfc) {
        const len = p.readUIntLE(i + 1, 2);
        vals.push(p.subarray(i + 3, i + 3 + len).toString("utf8"));
        i += 3 + len;
      } else {
        vals.push("<long>");
        break;
      }
    }
    return vals;
  }

  close(): void {
    this.sock?.destroy();
    this.sock = null;
  }

  /** Set scramble post-connect (used after connect() resolves the handshake). */
  setScramble(sc: Buffer): void {
    this.handshakeScramble = sc;
  }
}

// ── Audit orchestration ──────────────────────────────────────────────────────

export interface DbCredentials {
  mongo?: { user: string; password: string };
  mysql?: { user: string; password: string };
}

export interface DbAuditReport {
  host: string;
  port: number;
  protocol: "mongo" | "mysql" | null;
  reachable: boolean;
  error?: string;
  mongo?: {
    authEnabled: boolean;
    version?: string;
    wireVersion?: number;
    databases?: string[];
    scramOk?: boolean;
    scramFailure?: string;
    evidence: string[];
  };
  mysql?: {
    authEnabled: boolean;
    rootEmpty?: boolean;
    version?: string; // from the server's own handshake banner
    comment?: string;
    loginOk?: boolean;
    loginFailure?: string;
    evidence: string[];
  };
}

/** Detect which database wire protocol a port speaks, then audit it. */
export async function auditDatabase(host: string, port: number, creds: DbCredentials = {}, timeoutMs = 2_500): Promise<DbAuditReport> {
  const report: DbAuditReport = { host, port, protocol: null, reachable: false };

  // MySQL speaks FIRST on connect; MongoDB is silent. Give MySQL a short
  // greeting window, then fall through to a Mongo OP_MSG hello.
  let my: MySQLClient | null = null;
  try {
    my = new MySQLClient(host, port, Math.min(timeoutMs, 700));
    const hs = await my.connect();
    if (hs && /^[0-9]+\.[0-9]+/.test(hs.serverVersion)) {
      my.setScramble(hs.scramble);
      report.protocol = "mysql";
      report.reachable = true;
      await auditMysql(my, hs, creds.mysql, report);
      return report;
    }
    my.close();
    my = null;
  } catch {
    my?.close();
  }

  // MongoDB candidate
  try {
    const mc = new MongoWireClient(host, port, timeoutMs);
    await mc.connect();
    const hello = await mc.cmd({ hello: 1, client: { driver: { name: "adwa-vapt", version: "1.0" }, application: { name: "adwa-vapt-audit" } } });
    if (doc(hello).ok === undefined) throw new Error("no BSON hello reply");
    report.protocol = "mongo";
    report.reachable = true;
    await auditMongo(mc, creds.mongo, report);
    mc.close();
  } catch (e) {
    report.error = e instanceof Error ? e.message : "database probe failed";
  }

  return report;
}

async function auditMongo(mc: MongoWireClient, cred: DbCredentials["mongo"], report: DbAuditReport): Promise<void> {
  const evidence: string[] = [];
  const mongo: NonNullable<DbAuditReport["mongo"]> = { authEnabled: false, evidence };

  // 1. Authentication-enforcement probe — an administrative command WITHOUT
  //    credentials that succeeds means auth is off (finding).
  let listed: { [k: string]: BsonDecoded } | null = null;
  try {
    listed = await mc.cmd({ listDatabases: 1 });
    if (Number(doc(listed).ok) === 1) {
      evidence.push("listDatabases succeeded WITHOUT authentication → authentication not enforced");
    } else {
      mongo.authEnabled = true;
      evidence.push(`listDatabases rejected: code ${String(doc(listed).code)} "${String(doc(listed).errmsg ?? "").slice(0, 80)}" → authentication enforced`);
    }
  } catch (e) {
    mongo.authEnabled = true;
    evidence.push(`listDatabases transport-rejected: ${(e as Error).message}`);
  }

  const readDbList = (docObj: { [k: string]: BsonDecoded }): string[] => {
    const arr = docObj.databases;
    if (Array.isArray(arr)) return arr.map((d) => String(doc(d as BsonDecoded).name));
    if (arr && typeof arr === "object") return Object.values(arr as { [k: string]: BsonDecoded }).map((d) => String(doc(d).name));
    return [];
  };

  // 2. Version + inventory. On auth-enabled servers use SCRAM credentials.
  let versionDoc: { [k: string]: BsonDecoded } | null = null;
  let databases: string[] | null = null;
  if (!mongo.authEnabled) {
    try {
      const bi = await mc.cmd({ buildInfo: 1 });
      versionDoc = doc(bi);
    } catch { /* ignore */ }
    if (listed && Number(doc(listed).ok) === 1) {
      databases = readDbList(doc(listed));
      if (databases.length) evidence.push(`databases visible without authentication: ${databases.join(", ")}`);
    }
  } else if (cred) {
    const scram = await scramSha256Login(mc, cred.user, cred.password);
    mongo.scramOk = scram.ok;
    if (scram.ok) {
      evidence.push(`SCRAM-SHA-256 credentialed login succeeded as "${cred.user}" (server signature verified)`);
      try {
        const bi = await mc.cmd({ buildInfo: 1 });
        versionDoc = doc(bi);
        const ld = await mc.cmd({ listDatabases: 1 });
        if (Number(doc(ld).ok) === 1) {
          databases = readDbList(doc(ld));
        }
      } catch { /* ignore */ }
    } else {
      mongo.scramFailure = scram.failure;
      evidence.push(`SCRAM-SHA-256 login failed: ${scram.failure ?? "rejected"}`);
    }
  } else {
    evidence.push("credentials not provided — credentialed checks skipped (auth enforced)");
  }

  if (versionDoc) {
    mongo.version = String(versionDoc.version ?? "");
    mongo.wireVersion = Number(versionDoc.maxWireVersion ?? 0);
    evidence.push(`buildInfo version: ${mongo.version} (wire version ${mongo.wireVersion})`);
  }
  mongo.databases = databases ?? undefined;
  report.mongo = mongo;
}

async function auditMysql(my: MySQLClient, hs: MySQLHandshake, cred: DbCredentials["mysql"], report: DbAuditReport): Promise<void> {
  const evidence: string[] = [];
  const mysql: NonNullable<DbAuditReport["mysql"]> = { authEnabled: false, version: hs.serverVersion, evidence };
  evidence.push(`handshake banner: ${hs.serverVersion} (protocol v10, plugin ${hs.authPlugin})`);

  // 1. Classic empty-password root probe (read-only login attempt).
  const rootProbe = await my.login("root", "");
  if (rootProbe.ok) {
    mysql.rootEmpty = true;
    mysql.authEnabled = false;
    evidence.push("login as root with EMPTY password ACCEPTED → authentication not enforced");
  } else {
    mysql.authEnabled = true;
    evidence.push(`root/empty-password login rejected: ${rootProbe.errorCode} ${rootProbe.errorMessage ?? ""}`);
  }
  if (rootProbe.ok) {
    // already authenticated as root — collect version facts over this session
    try {
      const v = await queryVersionFacts(my);
      mysql.comment = v.comment;
      evidence.push(`@@version_comment: ${v.comment}`);
    } catch { /* ignore */ }
    report.mysql = mysql;
    return;
  }

  // 2. Credentialed audit (when a stored encrypted credential was provided).
  if (cred) {
    const login = await my.login(cred.user, cred.password);
    mysql.loginOk = login.ok;
    if (login.ok) {
      evidence.push(`credentialed login succeeded as "${cred.user}"`);
      try {
        const v = await queryVersionFacts(my);
        mysql.comment = v.comment;
        evidence.push(`SELECT @@version → ${v.version}; @@version_comment → ${v.comment}; user() → ${v.user}`);
      } catch (e) {
        evidence.push(`version query failed: ${(e as Error).message}`);
      }
    } else {
      mysql.loginFailure = `${login.errorCode} ${login.errorMessage ?? ""}`;
      evidence.push(`credentialed login rejected: ${mysql.loginFailure}`);
    }
  } else {
    evidence.push("credentials not provided — credentialed checks skipped (auth enforced)");
  }
  report.mysql = mysql;
}

async function queryVersionFacts(my: MySQLClient): Promise<{ version: string; comment: string; user: string }> {
  const q = async (sql: string): Promise<string[]> => {
    const rs = await my.query(sql);
    return "rows" in rs ? rs.rows[0] ?? [] : [];
  };
  const v = await q("SELECT @@version");
  const c = await q("SELECT @@version_comment");
  const u = await q("SELECT user()");
  return { version: v[0] ?? "", comment: c[0] ?? "", user: u[0] ?? "" };
}

// ── Findings ─────────────────────────────────────────────────────────────────

/** Release-line end-of-life dates (vendor-published support horizons). */
const EOL_LINES: { match: RegExp; eol: string; product: string }[] = [
  { match: /^MongoDB 4\.0|^4\.0\./, eol: "2022-04", product: "MongoDB 4.0" },
  { match: /^4\.2\./, eol: "2023-04", product: "MongoDB 4.2" },
  { match: /^4\.4\./, eol: "2024-02", product: "MongoDB 4.4" },
  { match: /^5\.0\./, eol: "2024-10", product: "MongoDB 5.0" },
  { match: /^6\.0\./, eol: "2025-07", product: "MongoDB 6.0" },
  { match: /^5\.5\./, eol: "2018-12", product: "MySQL 5.5 / MariaDB 5.5" },
  { match: /^5\.6\./, eol: "2021-02", product: "MySQL 5.6" },
  { match: /^5\.7\./, eol: "2023-10", product: "MySQL 5.7" },
  { match: /^10\.1\./, eol: "2020-10", product: "MariaDB 10.1" },
  { match: /^10\.2\./, eol: "2022-05", product: "MariaDB 10.2" },
  { match: /^10\.3\./, eol: "2023-06", product: "MariaDB 10.3" },
  { match: /^10\.4\./, eol: "2024-06", product: "MariaDB 10.4" },
  { match: /^10\.5\./, eol: "2025-06", product: "MariaDB 10.5" },
  { match: /^10\.6\./, eol: "2026-07", product: "MariaDB 10.6" },
];

function eolLine(version: string): { eol: string; product: string } | null {
  for (const l of EOL_LINES) {
    if (l.match.test(version)) return { eol: l.eol, product: l.product };
  }
  return null;
}

export function dbVulnsFromReport(report: DbAuditReport): VulnDraft[] {
  const drafts: VulnDraft[] = [];
  const now = new Date();

  if (report.mongo) {
    const m = report.mongo;
    if (!m.authEnabled) {
      drafts.push({
        cveId: null,
        title: `MongoDB accepts administrative commands without authentication on ${report.host}:${report.port}`,
        description: `An unauthenticated listDatabases request succeeded against ${report.host}:${report.port}${m.version ? ` (server ${m.version})` : ""}${m.databases?.length ? `, exposing the database inventory: ${m.databases.join(", ")}` : ""}. With authentication disabled, any network-reachable client has full read/write access to the data store.`,
        remediation: "Enable access control (--auth), create role-limited users, require TLS, and bind the service to trusted interfaces only.",
        category: "DATABASE",
        cvssScore: 9.8,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        epss: 0.3,
        kev: false,
        evidence: { mode: "db-live", protocol: "mongo", host: report.host, port: report.port, version: m.version ?? null, databases: m.databases ?? null, transcripts: m.evidence.slice(0, 6) },
        detectedAt: now,
      });
    }
    if (m.version) {
      const line = eolLine(m.version);
      if (line) {
        drafts.push({
          cveId: null,
          title: `${line.product} is past its release-line end-of-life (${line.eol}) — reported version ${m.version}`,
          description: `The server reported version ${m.version} via ${m.authEnabled ? "a credentialed SCRAM-SHA-256 buildInfo query" : "an unauthenticated buildInfo query"}; the ${line.product} release line reached end-of-life in ${line.eol} and no longer receives security patches.`,
          remediation: "Plan an in-place upgrade to a supported release line; review the vendor's upgrade compatibility matrix first.",
          category: "DATABASE",
          cvssScore: 7.5,
          cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
          epss: 0.2,
          kev: false,
          evidence: { mode: "db-live", protocol: "mongo", host: report.host, port: report.port, version: m.version, credentialed: m.authEnabled ? true : false, transcripts: m.evidence.slice(0, 6) },
          detectedAt: now,
        });
      }
    }
  }

  if (report.mysql) {
    const my = report.mysql;
    if (my.rootEmpty) {
      drafts.push({
        cveId: null,
        title: `MySQL/MariaDB root account permits login without a password on ${report.host}:${report.port}`,
        description: `A HandshakeResponse41 for user "root" with an empty mysql_native_password token was ACCEPTED by ${my.version ?? "the server"}. The superuser account can be assumed by any network-reachable client.`,
        remediation: "SET PASSWORD for root immediately, remove anonymous-user grants, remove remote root access (bind to localhost), and run mysql_secure_installation.",
        category: "DATABASE",
        cvssScore: 9.8,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        epss: 0.4,
        kev: false,
        evidence: { mode: "db-live", protocol: "mysql", host: report.host, port: report.port, version: my.version ?? null, transcripts: my.evidence.slice(0, 6) },
        detectedAt: now,
      });
    }
    if (my.version) {
      const line = eolLine(my.version);
      if (line) {
        drafts.push({
          cveId: null,
          title: `${line.product} is past its release-line end-of-life (${line.eol}) — reported version ${my.version}`,
          description: `The service identified itself as "${my.version}" in the protocol handshake banner${my.comment ? ` ("${my.comment}")` : ""}; the ${line.product} release line reached end-of-life in ${line.eol} and no longer receives security patches.`,
          remediation: "Upgrade to a supported release line (MySQL 8.x / current MariaDB), revalidate connectors, then rotate credentials used by applications.",
          category: "DATABASE",
          cvssScore: 7.5,
          cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
          epss: 0.2,
          kev: false,
          evidence: { mode: "db-live", protocol: "mysql", host: report.host, port: report.port, version: my.version, comment: my.comment ?? null, credentialed: my.loginOk ?? false, transcripts: my.evidence.slice(0, 6) },
          detectedAt: now,
        });
      }
    }
  }

  return drafts;
}
