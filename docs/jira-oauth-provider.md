# Demo-only Jira OAuth 2.1 provider boundary

A small, standards-honest authorization-code provider for the ADEO fake
Jira, so a later Vercel Connect service-provider registration has a real
local contract to register against. Vercel Connect is **not** live: no
external connector registration or callback is performed from this demo.

> Demo boundary: the OAuth provider state stays in an in-memory store (clients,
> grant tickets, codes and tokens reset on redeploy or cold start). Issue and
> comment data use the separate Jira persistence boundary described in the
> [current-state contract](jira-current-state.md). Tokens
> are opaque random bearer strings (no JWTs, no JWKS to operate). Signing
> uses platform Web Crypto only (SHA-256 PKCE S256, salted client-secret
> hashes, `getRandomValues` secrets); if Web Crypto is unavailable the
> provider fails closed. This is not production auth, not SAML/SCIM, and does
> not make the issue store a complete identity or authorization system. Every
> response carries `demoOnly: true` and
> the shared boundary note.

## Endpoints

| Route | Contract |
| --- | --- |
| `GET /api/oauth/.well-known/oauth-authorization-server` | RFC 8414 metadata: `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `response_types_supported: ["code"]`, `grant_types_supported: ["authorization_code", "refresh_token"]`, `code_challenge_methods_supported: ["S256"]`, `scopes_supported: ["read", "write"]`, `token_endpoint_auth_methods_supported` (basic/post/none) and revocation auth methods. Redirect-URI support is behavioral (exact-match registration plus exact-match authorize/token checks); `expires_in` is asserted on token responses. An OpenID-style alias serves the same fields at `.../openid-configuration` (no ID tokens are issued). |
| `GET /api/oauth/.well-known/oauth-protected-resource` | RFC 9728 metadata for the demo API resource `{origin}/api` (served by the REST adapter): `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported: ["header"]`. `/mcp` is intentionally absent: it is currently unauthenticated demo tooling, not bearer-protected. |
| `POST /api/oauth/register` (JSON) | Dynamic registration: `{client_name?, redirect_uris, scope?, token_endpoint_auth_method?}`. Each redirect URI is validated exactly (https, or http loopback for local demo testing; fragments never allowed); duplicates, unknown scopes and unknown auth methods fail closed. Returns the registration record plus a one-time `client_secret` (confidential clients) and a `registration_access_token` credential. |
| `GET /api/oauth/register/:clientId` | Management read with `Authorization: Bearer <registration_access_token>`; bad credentials and unknown clients fail closed. |
| `GET /api/oauth/authorize?...` | Starts a grant for the **server-derived** account (Passport header via the shared authority, or the labelled `x-demo-user` fallback; any caller-supplied user id in the query is ignored). Requires `response_type=code`, an exactly-registered `redirect_uri`, PKCE `code_challenge` with `code_challenge_method=S256` (plain rejected), in-grant and in-role scopes, and an optional RFC 8707 `resource` that must equal this deployment's API resource. Returns a 5-minute grant ticket plus the JSON consent path. |
| `POST /api/oauth/consent` (JSON) | `{grant_ticket, approved}`: approval mints the one-time 5-minute code bound to client, redirect URI, PKCE challenge and account; denial destroys the ticket (`access_denied`); replay fails closed. |
| `POST /api/oauth/token` (form) | `grant_type=authorization_code` (single-use code + exact redirect + `code_verifier` S256 check) or `grant_type=refresh_token` (single-use rotation; replay revokes the whole grant family). Secrets via basic auth or form fields; public (`none`) clients send only their id. Success: `{access_token, token_type: "Bearer", expires_in: 600, scope, refresh_token}`. Unknown clients, codes, verifiers, redirects, scopes and resources fail closed. |
| `POST /api/oauth/revoke` (form) | RFC 7009 revocation: a known token revokes its whole grant family; unknown tokens still return success so callers cannot probe the store. |

Machine discovery/token/revocation routes stay separate from the browser
consent path: the JSON consent POST is the only approval path, and the
optional browser demo page (if added later) is a labelled stand-in that
posts to the same endpoint.

## Scopes and roles

Scopes are `read` (default) and `write`. The authorizing account's role
caps issuance (viewers can never receive `write`), and REST/MCP writes
through a bearer additionally require the `write` scope plus the existing
member/admin authority: viewer or read-only tokens get 403 and write
nothing, while member/admin `read write` tokens perform the same bounded
operations as their Passport/demo counterparts. An `Authorization: Bearer`
header that is present but invalid never falls through to the demo
fallback. Deactivated demo accounts deny already-issued tokens and
refreshes.

## Vercel Connect registration (external, not done here)

A later registration uses the exact callback
`https://connect.vercel.com/callback` (it registers like any other exact
https URI), the discovered authorization/token endpoints, scopes
`read`/`write`, and PKCE S256. Two deployment prerequisites remain
outside this demo: enabling Vercel Passport deployment protection (the
source of the trusted authorization identity) and, if root
`/.well-known/*` discovery is wanted, proxying the toolkit-owned root
stubs (the fixed `@nuxtjs/mcp-toolkit` dependency answers 404
not-configured there; routing configuration is outside the worker
boundary) to `/api/oauth/.well-known/*`. For a stable issuer across
restarts, set `JIRA_OAUTH_ISSUER=https://<deployment>/api/oauth`;
otherwise the issuer derives per request from forwarded protocol/host.

## Proving the local contract

```sh
pnpm --filter @jira-clone/jira test
```

OAuth coverage lives in `apps/jira/tests/jira-oauth-provider.test.ts`
(discovery, registration, grant/consent, exchange, rotation/replay,
revocation, deactivation, fail-closed cases) and
`apps/jira/tests/jira-oauth-bearer.test.ts` (bearer REST writes, viewer
and read-scope denial, no-fallback enforcement). The shared domain
boundary is `apps/jira/server/utils/jiraOAuth.ts`; the REST/MCP write
gate is `authorizeBearerWrite`/`restBearerIdentity` in
`apps/jira/server/utils/jiraRest.ts`.
