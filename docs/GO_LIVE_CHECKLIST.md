# Adwa Cyber — Founder go-live checklist (Phase 3 cutover)

The one-hour, click-by-click runbook that flips the pilot to production.
Everything technical is already done: the SAME build switches by env vars,
and the platform honestly reports which mode is active (`live` / `mock` /
`fixture` / `snapshot` / `unconfigured` / `disabled`). Operator-level detail
lives in `docs/PRODUCTION_BINDINGS.md`; the Google deep guide in
`docs/GOOGLE_SSO_SETUP.md`.

**Budget: ~60 minutes of founder time for steps 1–3 (Google, mail, intel
keys). MISP (step 4) is optional and adds ~30 min on a small server.**

## Ground rules (read once)

1. **Keys go ONLY into the server's `.env`** — never into chat, email, or git
   (`.env` is gitignored). `chmod 600 .env`.
2. **After every step, verify**: `bun run bindings:report` — the flipped row
   must read `● live`. The same view is the **System Bindings** tab
   (SUPER_ADMIN) and `GET /api/system/bindings`.
3. Restart the app after editing `.env` (`docker compose restart app`, or
   restart the systemd/service unit).
4. Keep the dev mocks out of the production `.env` (`GOOGLE_AUTH_BASE`,
   `GOOGLE_TOKEN_URL`, `GOOGLE_JWKS_URL` must be ABSENT — their presence
   keeps the mock provider).
5. Baseline first: `cp .env .env.backup-$(date +%F)` and save the current
   `bun run bindings:report` output for the before/after diff.

## 0. Pre-flight (5 min)

```bash
bun run bindings:report          # baseline: 14 rows, statuses as today
cp .env .env.backup-$(date +%F)  # rollback point
```

## 1. Sign in with Google — 15 min, free

Done by: the founder who owns the Google account. Full detail:
`docs/GOOGLE_SSO_SETUP.md` §2.

| # | Click path | Value |
|---|---|---|
| 1 | <https://console.cloud.google.com> → project selector | create/select `adwa-cyber` |
| 2 | **APIs & Services → OAuth consent screen** | User type **External**; app name `Adwa Cyber`; support + developer email; scopes `openid` / `userinfo.email` / `userinfo.profile` |
| 3 | Consent screen → **Audience → Test users** | add the pilot tenant emails while in *Testing* |
| 4 | **APIs & Services → Credentials → Create credentials → OAuth client ID** | type **Web application** |
| 5 | Authorized redirect URIs (byte-for-byte, no trailing slash) | `https://YOUR_PUBLIC_HOST/api/auth/google/callback` |
| 6 | **Publish app** (Audience) | unlimited tenant users; no verification review (no sensitive scopes) |
| 7 | Copy Client ID (`...apps.googleusercontent.com`) + Client Secret | → `.env` |

```bash
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…            # exactly these two; no GOOGLE_*_URL overrides
```

**Verify:** login screen shows *Continue with Google* with no "dev mock"
badge; a real Google sign-in lands in the app; `bindings:report` →
`google-sso ● live`.

## 2. Real email (SMTP) — 10 min, free tier

Done by: any founder. Choose one:

| Provider | Free tier | Notes |
|---|---|---|
| Brevo | 300 mails/day | simplest signup, recommended |
| SendGrid | 100 mails/day | more polish, same steps |
| Gmail (org address) | ~500/day | needs 2FA + **App password** (not the login password) |

```bash
SMTP_HOST=smtp.provider.et
SMTP_PORT=587                    # 465 → also set SMTP_SECURE=true
SMTP_USER=…
SMTP_PASS=…
MAIL_FROM="Adwa Cyber <no-reply@adwacyber.et>"
```

**Verify:** request a password reset for a REAL inbox — the email arrives
with the correct public link (`APP_ORIGIN`); `bindings:report` →
`smtp-mail ● live`.

## 3. Free threat-intel API keys — 5 min each, all free

CISA KEV + Spamhaus DROP need NO key (already live). The four keyed free
feeds:

| Key | Sign-up | Where the key appears |
|---|---|---|
| `ABUSECH_AUTH_KEY` | <https://auth.abuse.ch> (register) | Account page → API key — covers URLhaus **and** ThreatFox; attribution required when showing their data |
| `OTX_API_KEY` | <https://otx.alienvault.com> (create account) | username menu → **Settings** → API Integration key |
| `GREYNOISE_API_KEY` | <https://greynoise.io> → Community account | Community API key (IP context, 4 req/min) |
| `VIRUSTOTAL_API_KEY` | <https://www.virustotal.com> → free profile | profile → **API key** — public tier 4 req/min · 500/day |

```bash
ABUSECH_AUTH_KEY=…
OTX_API_KEY=…
GREYNOISE_API_KEY=…
VIRUSTOTAL_API_KEY=…
```

**Verify:** SOC threat-intel hub → **Sync now** → ingested rows sourced
`LIVE — URLhaus` / `ThreatFox` / `OTX`; the connector registry no longer
says "key required"; enrichment shows GreyNoise/VirusTotal detail on an
indicator.

## 4. Self-hosted MISP — optional, recommended (~30 min on a small VPS)

The private sharing channel INSA/sector peers can use for sensitive
indicators (TLP:AMBER+/RED never leave the tenant):

1. Stand up MISP (AGPL, free) on an ops host — the official
   `docker-compose` from MISP-project works unmodified on 4 GB RAM.
2. MISP UI → **Administration → Add user** → role `sync user` → copy the
   40-char **auth key**.
3. `.env`:

   ```bash
   MISP_URL=https://misp.your-ops.et
   MISP_API_KEY=…
   ```

**Verify:** `bindings:report` → `misp-exchange ● live`; a SOC sync ingests
published events of the last 7 days.

## Already live — zero action needed

CISA KEV · Spamhaus DROP · Ethio-CERT public advisories/alerts/news/regulations
· INSA headlines · ITU GCI layer · live FIRST EPSS at scan time ·
certificate-transparency EASM discovery · NVD/FIRST feed pipeline.

## Stays coordination (not click-by-click)

- **Ethio-CERT bilateral exchange** — the INSA agreement. When they issue the
  endpoint + key: `ETHIOCERT_API_URL` / `ETHIOCERT_API_KEY`. Until then the
  sync layer honestly serves fixtures. Public-web national intel is already
  live without it.
- Track C CII (MOU/INSA licence gates) — platform governance, separate track.

## 5. Keep the labelled snapshots fresh (cron, 10 min once)

```cron
17 */6 * * *  cd /opt/adwa && bun run intel:snapshots   # KEV + DROP
23 4 * * *    cd /opt/adwa && bun run vapt:epss         # FIRST EPSS bundle
31 5 * * *    cd /opt/adwa && bun run ethio:snapshot    # national capture
```

## Final acceptance (5 min)

1. `bun run bindings:report` — expected: every row `live` (or deliberately
   `fixture`/`unconfigured` with a reason you can state aloud).
2. System Bindings tab shows the same; no secret values anywhere on screen.
3. Walk one real pass of: Google sign-in → password reset mail → SOC sync →
   authorized-scope VAPT scan → bilingual PDF report download.

## Rollback (honest degradation, never silent)

```bash
ETHIO_WEB_OFF=1      # national web layer → labelled snapshot only
INTEL_FEEDS_OFF=1    # every public intel connector off
EPSS_LIVE_OFF=1      # EPSS → strictly bundled snapshot values
```

Each shows as `⊘ disabled` in the registry. Restore by removing the var and
restarting.
