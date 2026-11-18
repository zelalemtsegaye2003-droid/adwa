/**
 * Adwa Cyber — DEVELOPMENT MOCK of a self-hosted MISP instance
 * (Real-Data Roadmap Phase 2, §5.1).
 * ---------------------------------------------------------------------
 * Purpose: bind the platform's MISP private-exchange connector to a
 * realistic self-hosted MISP endpoint without standing up the real
 * (PHP/MySQL) MISP stack:
 *
 *   POST /events/restSearch  → the MISP restSearch response the connector
 *                              consumes (returnformat json): two published
 *                              events — a banking-phishing campaign marked
 *                              TLP:AMBER and a restricted sector-malware
 *                              event marked TLP:RED. Attribute types cover
 *                              the whole mapping family (domain, ip-dst,
 *                              url, md5, sha256, filename, email, an
 *                              unsupported sha1, and one cross-event
 *                              duplicate) so the connector's skip, dedupe,
 *                              TLP-honour and confidence paths are all
 *                              exercised deterministically.
 *   GET  /events/restSearch  → same fixture (some tools GET-search).
 *   GET  /                    → service descriptor.
 *
 * Auth: the MISP convention — `Authorization: <API_KEY>` (raw auth key,
 * no Bearer prefix). Must match MISP_API_KEY on the platform side
 * (default adwa-dev-misp-key).
 *
 * This service MUST NOT be exposed in production.
 */
const PORT = Number(process.env.MOCK_PORT ?? 3030);
const API_KEY = process.env.MISP_MOCK_KEY ?? "adwa-dev-misp-key";

// Deterministic event set. Values use documentation ranges (RFC 5737) and
// example-style domains so nothing collides with the seeded pilot estate.
const REST_SEARCH_RESPONSE = {
  response: [
    {
      Event: {
        id: "101",
        uuid: "b0b2a1c3-d4e5-4f60-a718-19202122a3b4",
        info: "INSA advisory — banking phishing campaign (Commercial Bank spoof)",
        date: "2026-11-14",
        published: true,
        threat_level_id: "1",
        analysis: "2",
        Tag: [{ name: "tlp:amber" }, { name: "phishing" }, { name: "type:OSINT" }],
        Attribute: [
          { id: "9001", uuid: "c1c2c3c4-1a2b-3c4d-5e6f-708192a3b4c5", type: "domain", value: "cbe-secure-verify.example.net", category: "Network activity", to_ids: true, timestamp: "1763088000" },
          { id: "9002", uuid: "c1c2c3c4-1a2b-3c4d-5e6f-708192a3b4c6", type: "url", value: "https://cbe-secure-verify.example.net/login?id=ebf8", category: "Network activity", to_ids: true, timestamp: "1763088001" },
          { id: "9003", uuid: "c1c2c3c4-1a2b-3c4d-5e6f-708192a3b4c7", type: "ip-dst", value: "203.0.113.55", category: "Network activity", to_ids: false, timestamp: "1763088002" },
          { id: "9004", uuid: "c1c2c3c4-1a2b-3c4d-5e6f-708192a3b4c8", type: "sha1", value: "0123456789abcdef0123456789abcdef01234567", category: "Payload delivery", to_ids: true, timestamp: "1763088003" },
        ],
      },
    },
    {
      Event: {
        id: "102",
        uuid: "d1d2d3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        info: "Sector malware indicators (restricted)",
        date: "2026-11-16",
        published: true,
        threat_level_id: "2",
        analysis: "1",
        Tag: [{ name: "tlp:red" }, { name: "malware" }, { name: "misp-galaxy:amitis" }],
        Attribute: [
          // duplicate of event 101's domain — exercises cross-event dedupe
          { id: "9010", uuid: "e2e3e4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", type: "domain", value: "cbe-secure-verify.example.net", category: "Network activity", to_ids: true, timestamp: "1763174400" },
          { id: "9011", uuid: "e2e3e4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6f", type: "sha256", value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", category: "Payload delivery", to_ids: true, timestamp: 1763174401 },
          { id: "9012", uuid: "e2e3e4e5-f6a7-4b8c-9d0e-1f2a3b4c5d70", type: "md5", value: "44d88612fea8a8f36de82e1278abb02f", category: "Payload delivery", to_ids: false, timestamp: 1763174402 },
          { id: "9013", uuid: "e2e3e4e5-f6a7-4b8c-9d0e-1f2a3b4c5d71", type: "filename|sha256", value: "update_kyc.exe|e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", category: "Payload delivery", to_ids: true, timestamp: 1763174403 },
          { id: "9014", uuid: "e2e3e4e5-f6a7-4b8c-9d0e-1f2a3b4c5d72", type: "email-src", value: "cbe.kyc.desk@example.org", category: "Payload delivery", to_ids: false, timestamp: 1763174404 },
        ],
      },
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let searchRequests = 0;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    // MISP auth: raw API key in the Authorization header (no Bearer prefix).
    const auth = req.headers.get("authorization") ?? "";
    const authorized = auth === API_KEY;

    if (url.pathname === "/") {
      return json({
        service: "mock-misp",
        role: "Development mock of a self-hosted MISP private sharing instance",
        endpoints: ["POST /events/restSearch", "GET /events/restSearch"],
        note: "Raw-key Authorization header (MISP convention); this mock must not be exposed in production.",
      });
    }

    if (url.pathname === "/events/restSearch" && (req.method === "POST" || req.method === "GET")) {
      if (!authorized) return json({ error: "unauthorized — MISP_API_KEY (raw Authorization header) required" }, 401);
      searchRequests++;
      if (req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (body === null || typeof body !== "object") return json({ error: "restSearch body is not valid JSON" }, 400);
      }
      return json(REST_SEARCH_RESPONSE);
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`[mock-misp] self-hosted MISP mock listening on :${PORT} (2 published events, TLP:AMBER + TLP:RED)`);
