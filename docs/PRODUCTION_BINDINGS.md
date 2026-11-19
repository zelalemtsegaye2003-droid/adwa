# Production Bindings — the go-live operator guide

Phase 3 of the Real-Data Roadmap (see `AdwaSec_Real_Data_Review_and_Roadmap.docx`):
every external integration's live code path already exists and switches on its
environment variables. Nothing in the application code changes between "pilot
demo" and "production" — the SAME build is flipped by env vars, and the
platform honestly reports which mode is active, everywhere, always.

This guide is the ordered checklist an operator follows to take the platform
live, and how to verify each binding once flipped.

## The one-glance surfaces

| Surface | Where |
|---|---|
| Admin console | **System Bindings** tab (SUPER_ADMIN) — every binding, its status, the env vars that flip it |
| API | `GET /api/system/bindings` — the same registry as JSON (`orgs:manage` permission) |
| CLI report | `bun run bindings:report` — the same registry without the app running (pre-boot checklist) |

Statuses (closed set, used by all three surfaces):

- `live` — bound and serving real data
- `mock` — dev test double wired (mock-google :3010, mock-ethiocert :3020, mock MISP :3030)
- `fixture` — no binding configured; bundled demo fixtures serve
- `snapshot` — offline/kill-switch mode; the labelled snapshot captured from the real source serves
- `unconfigured` — optional keyed feature without its key (honestly reported, syncs skip it)
- `disabled` — an operator kill switch is ON (`ETHIO_WEB_OFF`, `INTEL_FEEDS_OFF`, `EPSS_LIVE_OFF`)

**Secrets never leave the server.** The registry carries env var *names*,
booleans, snapshot dates and endpoints — never values. The response is safe to
show on a projector.

## Go-live checklist (ordered)

### 1. Session secret and public origin

```bash
AUTH_SECRET=$(openssl rand -base64 48)     # 64+ chars; rotating it invalidates sessions + MFA seeds
APP_ORIGIN=https://platform.adwacyber.et   # so emailed links carry the public URL behind the proxy
```

### 2. Database

Switch `DATABASE_URL` to PostgreSQL (docker-compose provided). SQLite is the
pilot/dev default. Then `bun run db:deploy`.

### 3. Sign in with Google (real accounts)

Follow `docs/GOOGLE_SSO_SETUP.md` end to end — Google Cloud Console project,
OAuth client, authorized redirect URI
`https://YOUR_HOST/api/auth/google/callback`, then:

```bash
GOOGLE_CLIENT_ID=….apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
```

The login screen shows the Google button the moment both are set. With
`GOOGLE_AUTH_BASE` unset the flow hits the real `accounts.google.com`; the
mock (mini-services/mock-google :3010) remains the deterministic CI double.

**Verify:** login via Google with a real account; `bindings:report` shows
`google-sso ● live`.

### 4. Outbound mail (real delivery)

```bash
SMTP_HOST=smtp.your-provider.et
SMTP_PORT=587            # 465 → SMTP_SECURE=true
SMTP_USER=…
SMTP_PASS=…
MAIL_FROM="Adwa Cyber <no-reply@adwacyber.et>"
```

Unset `SMTP_HOST` means the console transport — reset links print to the
server log. Fine for demos, not for production.

**Verify:** request a password reset with a real inbox address; the email
arrives; `bindings:report` shows `smtp-mail ● live`.

### 5. Ethio-CERT bilateral exchange (coordination item)

The binding code exists today. When the national authority (INSA / Ethio-CERT)
issues the production endpoint and key:

```bash
ETHIOCERT_API_URL=https://…issued-by-INSA…
ETHIOCERT_API_KEY=…
```

Until issued, fixture mode is honest: bundled demo indicators, no network,
the sync UI says so. The public web layer (advisories, alerts, news,
regulations, GCI, INSA headlines) is ALREADY live against
ethiocert.gov.et with no key — it only degrades to the labelled snapshot when
unreachable.

**Verify:** the SOC threat-intel sync page shows a LIVE national sync row
with a receipt id; `bindings:report` shows `ethiocert-exchange ● live`.

### 6. Keyed public feeds (free keys, minutes each)

```bash
ABUSECH_AUTH_KEY=…        # https://auth.abuse.ch/  (URLhaus + ThreatFox; attribution required)
OTX_API_KEY=…             # https://otx.alienvault.com
GREYNOISE_API_KEY=…       # https://greynoise.io (Community)
VIRUSTOTAL_API_KEY=…      # https://www.virustotal.com (4 req/min, 500/day)
```

CISA KEV and Spamhaus DROP need no key and are already live.

**Verify:** a SOC sync run ingests rows sourced `LIVE — URLhaus` etc.; the
connector registry on the hub no longer says "key required".

### 7. Self-hosted MISP (private sharing channel, optional but recommended)

Stand up a MISP instance (AGPL, free — this is the channel INSA/sector peers
can use for sensitive indicators that must never hit public feeds), then:

```bash
MISP_URL=https://misp.your-ops.et
MISP_API_KEY=…
```

TLP is honoured: `TLP:AMBER+`/`TLP:RED` events stay peer-to-peer inside the
tenant, never hub-broadcast.

**Verify:** `bindings:report` shows `misp-exchange ● live`; a sync ingests
published events of the last 7 days.

### 8. Scheduled snapshot refresh (cron)

The labelled snapshots are the offline fallback — keep them current:

```cron
17 */6 * * *  cd /opt/adwa && bun run intel:snapshots   # KEV + DROP
23 4 * * *    cd /opt/adwa && bun run vapt:epss         # FIRST EPSS bundle
31 5 * * *    cd /opt/adwa && bun run ethio:snapshot    # national capture
```

## Rollback / offline posture (kill switches)

Deliberate, honest degradation — useful for air-gapped demos or incident
containment:

```bash
ETHIO_WEB_OFF=1        # national web layer → labelled snapshot only
INTEL_FEEDS_OFF=1      # every public intel connector off
EPSS_LIVE_OFF=1        # EPSS → strictly bundled snapshot values
```

Every switch shows as `⊘ disabled` in the registry — never silent.

## What deliberately stays demo

- the vulnerable lab (`mini-services/vuln-lab`) — the repeatable, authorized
  on-stage VAPT target;
- the deterministic mock providers — CI test doubles that keep the battery
  reproducible without internet;
- the seeded pilot estate — the offline demo dataset once real tenants
  onboard through the login screen's create-organization flow.

Principle: demo only where reality requires authorization, payment or
determinism the internet cannot provide; live everywhere else, and labelled
when not.
