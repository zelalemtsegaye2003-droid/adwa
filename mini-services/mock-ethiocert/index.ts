/**
 * Adwa Cyber — DEVELOPMENT MOCK of the Ethio-CERT exchange API.
 * ---------------------------------------------------------------------
 * Purpose: bind the platform's Ethio-CERT synchronisation layer to a
 * realistic national exchange endpoint without live credentials:
 *
 *   GET  /feed     → the national threat feed (served from the platform's
 *                    own pilot fixture module — zero content drift)
 *   POST /reports  → receives the anonymised upward tenant summary; ENFORCES
 *                    the privacy contract (rejects any payload that carries
 *                    organisation identity or indicator titles → 422) and
 *                    returns a receiptId + the sha256 of the exact bytes
 *                    received (end-to-end integrity proof).
 *   GET  /reports  → receipts of the reports received so far (for e2e tests)
 *
 * Auth: Authorization: Bearer <ETHIOCERT_API_KEY> (must match the key
 * configured on the platform; default adwa-dev-ethiocert-key).
 *
 * This service MUST NOT be exposed in production.
 */
import { createHash } from "crypto";
import { ETHIOCERT_FEED } from "../../src/lib/ethiocert-feed";

const PORT = Number(process.env.MOCK_PORT ?? 3020);
const API_KEY = process.env.ETHIOCERT_MOCK_KEY ?? "adwa-dev-ethiocert-key";

// Tenant identities that must NEVER appear in an upward report (the pilot's
// registered organisations). The exchange rejects the whole report on sight.
const FORBIDDEN_IDENTITY = [
  "Commercial Bank of Ethiopia",
  "CBE",
  "Dashen",
  "Wasasa",
  "Oromia MFI",
  "Amhara MFI",
  "Ethio Telecom",
  "Mekelle",
];

interface Receipt {
  receiptId: string;
  receivedAt: string;
  sha256: string;
  bytes: number;
  sector: string | null;
  incidentTotal: number;
  indicatorCount: number;
}

const receipts: Receipt[] = [];
let feedRequests = 0;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const authorized = (req.headers.get("authorization") ?? "") === `Bearer ${API_KEY}`;

    if (url.pathname === "/" ) {
      return json({
        service: "mock-ethiocert",
        role: "Development mock of the Ethio-CERT national exchange API",
        endpoints: ["GET /feed", "POST /reports", "GET /reports"],
        note: "Bearer auth required; this mock must not be exposed in production.",
      });
    }

    // ── DOWN: national feed ────────────────────────────────────────────────
    if (url.pathname === "/feed" && req.method === "GET") {
      if (!authorized) return json({ error: "unauthorized — Bearer ETHIOCERT_API_KEY required" }, 401);
      feedRequests++;
      return json({
        source: "ETHIO-CERT",
        generatedAt: new Date().toISOString(),
        feed: ETHIOCERT_FEED,
      });
    }

    // ── UP: anonymised tenant summary ──────────────────────────────────────
    if (url.pathname === "/reports" && req.method === "POST") {
      if (!authorized) return json({ error: "unauthorized — Bearer ETHIOCERT_API_KEY required" }, 401);
      const text = await req.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: "report is not valid JSON" }, 400);
      }
      if (body.reportType !== "ADWA_CYBER_TENANT_SUMMARY") {
        return json({ error: `unexpected reportType "${String(body.reportType)}"` }, 422);
      }
      // Privacy contract: no organisation identity anywhere in the payload.
      const identityLeak = FORBIDDEN_IDENTITY.find((name) => text.includes(name));
      if (identityLeak) {
        return json({ error: `privacy violation: payload contains organisation identity "${identityLeak}"` }, 422);
      }
      // Privacy contract: anonymised indicators carry no titles / free text
      // beyond the single descriptionEn field of the sharing protocol.
      const indicators = Array.isArray(body.indicators) ? (body.indicators as Record<string, unknown>[]) : [];
      if (indicators.some((i) => "titleEn" in i || "titleAm" in i || "notes" in i)) {
        return json({ error: "privacy violation: indicators must not carry titles or notes" }, 422);
      }
      const sha256 = createHash("sha256").update(text).digest("hex");
      const receiptId = `EC-RCPT-${createHash("sha256").update(sha256 + receipts.length).digest("hex").slice(0, 10).toUpperCase()}`;
      receipts.push({
        receiptId,
        receivedAt: new Date().toISOString(),
        sha256,
        bytes: Buffer.byteLength(text),
        sector: typeof body.sector === "string" ? body.sector : null,
        incidentTotal:
          (body.incidentCounts as Record<string, unknown> | undefined)?.total !== undefined
            ? Number((body.incidentCounts as Record<string, unknown>).total)
            : 0,
        indicatorCount: indicators.length,
      });
      return json({ status: "accepted", receiptId, receivedAt: new Date().toISOString(), sha256 }, 201);
    }

    if (url.pathname === "/reports" && req.method === "GET") {
      if (!authorized) return json({ error: "unauthorized — Bearer ETHIOCERT_API_KEY required" }, 401);
      return json({ feedRequests, count: receipts.length, receipts: receipts.slice(-20) });
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`[mock-ethiocert] national exchange mock listening on :${PORT} (feed: ${ETHIOCERT_FEED.length} entries)`);
