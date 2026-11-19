# Sign in with Google — production setup guide

Adwa Cyber implements a complete, hand-rolled **OAuth 2.0 / OIDC "Sign in with
Google"** flow (no next-auth). The code is production-grade: CSRF state cookie,
`authorization_code` exchange, RS256 ID-token verification against Google's
live JWKS, `email_verified` enforcement, and auto-provisioning rules scoped to
tenant domains. The only thing that separates the dev mock from the real
provider is **two environment variables**.

This guide turns the real Google provider on in about 10 minutes.

---

## 1. What the flow does (so you can verify it end-to-end)

| Step | Where | What happens |
| --- | --- | --- |
| 1 | `GET /api/auth/google` | Server builds Google's consent URL (scope `openid email profile`, `prompt=select_account`), sets a 10-minute CSRF state cookie, 302s to Google |
| 2 | Google consent screen | User picks an account; Google redirects back to `/api/auth/google/callback?code=…&state=…` |
| 3 | `GET /api/auth/google/callback` | Server verifies state, rate-limits, exchanges the code for tokens, verifies the RS256 ID token against `https://www.googleapis.com/oauth2/v3/certs` (issuer `accounts.google.com`, audience = your client ID, `email_verified` required) |
| 4 | Account resolution | (a) Google ID already linked → sign in; (b) email matches an existing local account → link on first login; (c) no account but email domain matches an `Organization.contactEmail` domain → auto-provision a VIEWER account; (d) otherwise refused (`google_no_account`); MFA-enabled accounts are refused for safety (`google_mfa_required`) |
| 5 | Session | Standard platform session issued — 15-min JWT access cookie + rotating refresh cookie, same as password login |

---

## 2. Create the Google credentials (the real provider)

1. **Google Cloud Console** → <https://console.cloud.google.com> → select (or create) a project, e.g. `adwa-cyber`.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal if you run a Google Workspace org — then skip the test-user step).
   - App name: `Adwa Cyber`; support email; developer email.
   - Scopes: add `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (or leave default — the app requests them explicitly anyway).
   - No sensitive scopes, so no Google security assessment is required.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Type: **Web application**.
   - **Authorized redirect URIs** (must match byte-for-byte, no trailing slash):
     - production: `https://YOUR_PUBLIC_HOST/api/auth/google/callback` (e.g. `https://platform.adwacyber.et/api/auth/google/callback`)
     - local dev: `http://localhost:3000/api/auth/google/callback`
4. Copy the **Client ID** (ends `...apps.googleusercontent.com`) and **Client Secret**.
5. While the consent screen is in *Testing*, add testers under **Audience → Test users**. For production use by an unlimited set of domain users, click **Publish app** (no verification review needed for these basic scopes).

## 3. Switch the deployment from mock to real

Put exactly two values in the deployment's `.env` (see `.env.example`):

```
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

then restart the app. That's the whole switch:

- `GET /api/auth/config` now reports `googleEnabled: true, googleMock: false`.
- The login screen shows the **Continue with Google** button with no "mock" badge.
- The Google JWKS, token and auth URLs revert to the real Google endpoints automatically (the `GOOGLE_AUTH_BASE` / `GOOGLE_TOKEN_URL` / `GOOGLE_JWKS_URL` overrides exist only for the dev mock).

For **demo/offline environments**, keep the bundled mock instead (no real Google involved):

```
GOOGLE_CLIENT_ID=adwa-dev-mock-client.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=adwa-dev-mock-secret
GOOGLE_AUTH_BASE=/mock-google/auth?XTransformPort=3010
GOOGLE_TOKEN_URL=http://localhost:3010/token
GOOGLE_JWKS_URL=http://localhost:3010/certs
bun mini-services/mock-google/index.ts   # RSA-signed mock OIDC provider on :3010
```

The login screen then honestly badges the provider as a dev mock.

## 4. Account provisioning policy (know before rollout)

- **Domain-scoped auto-provisioning**: a Google identity whose email domain matches an existing `Organization.contactEmail` domain is auto-provisioned as **VIEWER** (least privilege). Elevations happen through the normal admin flow.
- **Linking**: a user who already has a password account and signs in with a Google identity with the same email gets the Google ID linked on first sign-in.
- **MFA accounts**: if the existing account has TOTP MFA enabled, Google sign-in is refused with `google_mfa_required` — the user must use password + TOTP. This prevents an unverified-identity path around the second factor.
- **No account**: `google_no_account` — an administrator must provision the account (this is deliberate; the platform does not create accounts for arbitrary Google identities).

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Login screen shows "Google Sign-In is not configured" | `GOOGLE_CLIENT_ID/SECRET` not set on THIS server instance — set them and restart. |
| Google shows `redirect_uri_mismatch` | The redirect URI registered in the console doesn't byte-match `https://<host>/api/auth/google/callback` (scheme, host, path, no trailing slash). |
| Redirects back with `?authError=google_state_mismatch` | State cookie expired (>10 min) or cookies blocked — retry the sign-in. |
| `?authError=google_exchange_failed` | Client secret wrong, or code reused/expired. |
| `?authError=google_no_account` | Expected policy — provision the account first or sign in with password once to link. |
| `?authError=google_mfa_required` | Expected policy — sign in with password + TOTP. |
| `?authError=google_not_configured` | Real provider half-configured (only one of the two env vars set). |

## 6. Verify the production binding

```bash
curl -s https://YOUR_PUBLIC_HOST/api/auth/config | jq
# expect: { "googleEnabled": true, "googleMock": false, ... }
```

Then run the callback test matrix offline first if you want full coverage:
`bun scripts/test-google.ts` (runs the full exchange/verification/provision
matrix against the mock provider, including all four callback branches).
