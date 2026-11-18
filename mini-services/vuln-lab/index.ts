/**
 * Adwa Cyber — intentionally vulnerable LAB target (plan §7 "Acceptance
 * tests": a lab with Juice Shop/DVWA-style targets; this is the Node-native
 * equivalent — safe to run anywhere, no real software exploited).
 *
 * Listens on localhost only. Every "vulnerability" is a *label* — the ports
 * simply serve crafted banners/headers that real scanners must detect:
 *
 *   :3060  HTTP   — Apache/2.4.49 banner (CVE-2021-41773/42013 range),
 *                  missing CSP/HSTS/XFO/nosniff, flag-less cookie,
 *                  robots.txt advertising /admin
 *   :3021  FTP    — "220 (vsFTPd 2.3.4)" banner (CVE-2011-2523 exact)
 *   :3061  FTP    — "220 ProFTPD 1.3.3c Server" banner (CVE-2010-20103 exact)
 *   :3062  Redis  — answers PING with +PONG unauthenticated (exposure finding)
 *   :3022  SSH    — "SSH-2.0-OpenSSH_7.2p2 Ubuntu-4ubuntu2.2, OpenSSL 1.0.1e"
 *                  (CVE-2023-38408 range + CVE-2014-0160 range)
 *
 * Start:  bun mini-services/vuln-lab/index.ts   (auto-started by dev.sh)
 */
import net from "net";
import http from "http";

const HOST = "127.0.0.1";

// ── :3060 vulnerable HTTP app ───────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("User-agent: *\nDisallow: /admin\nDisallow: /backup\n");
    return;
  }
  // Deliberately weak header set + version-bearing Server banner.
  res.writeHead(200, {
    server: "Apache/2.4.49 (Unix) mod_ssl/2.4.49 OpenSSL/1.0.1e",
    "x-powered-by": "PHP/5.4.45",
    "set-cookie": "PHPSESSID=lab0session; path=/",
  });
  res.end("<html><body>Adwa VAPT lab target — vulnerable-by-design</body></html>");
});
httpServer.listen(3060, HOST);

// ── generic banner greeter ──────────────────────────────────────────────────
function greeter(port: number, banner: string, handlers?: (line: string, sock: net.Socket) => void) {
  const server = net.createServer((sock) => {
    if (banner) sock.write(banner);
    if (!handlers) {
      sock.on("data", () => sock.end());
      return;
    }
    sock.on("data", (d: Buffer) => {
      for (const line of d.toString("latin1").split("\r\n")) {
        if (line.trim()) handlers(line, sock);
      }
    });
    sock.on("error", () => sock.destroy());
  });
  server.listen(port, HOST);
}

// ── :3021 vsftpd 2.3.4 (backdoor version — banner only, anonymous denied) ──
greeter(3021, "220 (vsFTPd 2.3.4)\r\n", (line, sock) => {
  if (line.toUpperCase().startsWith("USER")) sock.write("530 Permission denied.\r\n");
  else if (line.toUpperCase().startsWith("QUIT")) sock.end("221 Goodbye.\r\n");
});

// ── :3061 ProFTPD 1.3.3c (trojaned-tarball version) ────────────────────────
greeter(3061, "220 ProFTPD 1.3.3c Server (Adwa VAPT lab)\r\n", (line, sock) => {
  if (line.toUpperCase().startsWith("USER")) sock.write("331 Password required.\r\n");
  else if (line.toUpperCase().startsWith("PASS")) sock.write("530 Login incorrect.\r\n");
  else if (line.toUpperCase().startsWith("QUIT")) sock.end("221 Goodbye.\r\n");
});

// ── :3062 unauthenticated Redis ─────────────────────────────────────────────
greeter(3062, "", (line, sock) => {
  const cmd = line.trim().toUpperCase();
  if (cmd === "PING") sock.write("+PONG\r\n");
  else sock.write("-ERR unknown command\r\n");
});

// ── :3022 SSH greeting carrying OpenSSH + OpenSSL versions ─────────────────
greeter(3022, "SSH-2.0-OpenSSH_7.2p2 Ubuntu-4ubuntu2.2, OpenSSL 1.0.1e 14 Mar 2012\r\n");

console.log("Adwa VAPT lab target up — 127.0.0.1:3060(http) :3021(vsftpd) :3061(proftpd) :3062(redis) :3022(ssh)");
// Keep the process alive.
setInterval(() => {}, 60_000);
