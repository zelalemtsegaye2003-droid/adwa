/**
 * Adwa Cyber — VAPT External Attack Surface Management discovery engine
 * (NBE LOT4 §"Asset Discovery & External Attack Surface Management (EASM)":
 * #1 "Native EASM with domain/DNS discovery", #2 "subsidiary / rogue domain
 * mapping", #5 "identification of unmanaged, shadow-IT and orphaned assets").
 *
 * REAL, purely passive OSINT — nothing is probed on the target's systems:
 *   - Certificate-transparency log query (crt.sh) for every hostname ever
 *     issued a certificate under the queried domain (the classic EASM source).
 *   - DNS resolution of each discovered name (live resolvers) to attach
 *     current addresses.
 *
 * Scope classification (done by the API route against approved scopes):
 * discovered names/IPs that fall OUTSIDE every approved scope are surfaced as
 * the tender's "unmanaged / shadow-IT" exposure signal.
 *
 * Transports are injectable so unit tests run on a RECORDED fixture (the
 * fixture shipped with the repo is real captured crt.sh output, not invented
 * data); production uses live fetch + node:dns.
 */
export type CrtShEntry = {
  issuer_ca_id: number;
  issuer_name: string;
  common_name?: string;
  name_value: string; // may contain multiple newline-separated names
  id: number;
  not_before?: string;
  not_after?: string;
  serial_number?: string;
};

export interface DiscoveredHost {
  name: string;
  sources: { ct?: { entryId: number; issuer: string; notBefore?: string } };
  ipAddresses: string[];
  resolved: boolean;
}

export type Fetcher = (url: string, timeoutMs: number) => Promise<CrtShEntry[]>;
export type Resolver = (name: string) => Promise<string[]>;

/** One crt.sh attempt (bounded). */
async function ctFetchOnce(url: string, timeoutMs: number): Promise<CrtShEntry[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
    return (await res.json()) as CrtShEntry[];
  } finally {
    clearTimeout(t);
  }
}

/** Live crt.sh CT-log fetch with one retry (crt.sh rate-limits/flakes often). */
export const liveCtFetcher: Fetcher = async (url: string, timeoutMs: number) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ctFetchOnce(url, attempt === 0 ? timeoutMs : Math.min(timeoutMs, 10_000));
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("crt.sh unreachable");
};

/** Live DNS A-record resolution, bounded per name (a hanging resolver must not stall a run). */
export const liveResolver: Resolver = async (name: string) => {
  const dns = await import("dns").then((m) => m.promises);
  try {
    return await Promise.race([
      dns.resolve4(name),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 4_000).unref?.()),
    ]);
  } catch {
    return [];
  }
};

/**
 * Query CT logs for every hostname under `domain`, then resolve each unique
 * name. Wildcard prefixes and duplicates are collapsed. Purely passive.
 */
export async function discoverSubdomains(
  domain: string,
  opts: { fetcher?: Fetcher; resolver?: Resolver; timeoutMs?: number } = {},
): Promise<{ domain: string; hosts: DiscoveredHost[]; fetchedAt: string; error?: string }> {
  const fetcher = opts.fetcher ?? liveCtFetcher;
  const resolver = opts.resolver ?? liveResolver;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const url = `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`;

  let entries: CrtShEntry[] = [];
  try {
    entries = await fetcher(url, timeoutMs);
  } catch (e) {
    return { domain, hosts: [], fetchedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "CT log query failed" };
  }

  const byName = new Map<string, DiscoveredHost>();
  for (const entry of entries) {
    const names = `${entry.name_value ?? ""}\n${entry.common_name ?? ""}`
      .split("\n")
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n && n.endsWith(`.${domain}`) && !n.includes(" ") && !n.includes("*"));
    for (const name of names) {
      if (name === domain) continue; // root handled implicitly
      const existing = byName.get(name);
      if (existing) continue; // first (earliest-listed) entry wins
      byName.set(name, {
        name,
        sources: { ct: { entryId: entry.id ?? 0, issuer: entry.issuer_name ?? "", notBefore: entry.not_before } },
        ipAddresses: [],
        resolved: false,
      });
    }
  }

  const hosts = [...byName.values()];
  await Promise.all(
    hosts.map(async (h) => {
      try {
        h.ipAddresses = await resolver(h.name);
        h.resolved = h.ipAddresses.length > 0;
      } catch {
        h.resolved = false;
      }
    }),
  );

  return { domain, hosts, fetchedAt: new Date().toISOString() };
}
