# Demo-only Jira OAuth 2.1 provider boundary

A small, standards-honest authorization-code provider for the ADEO fake
Jira, so a later Vercel Connect service-provider registration has a real
local contract to register against. Vercel Connect is **not** live: no
external connector registration or callback is performed from this demo.

> Demo boundary: everything here runs over an in-memory store (clients,
> grant tickets, codes and tokens reset on redeploy or cold start). Tokens
> are opaque random bearer strings (no JWTs, no JWKS to operate). Signing
> uses platform Web Crypto only (SHA-256 PKCE S256, salted client-secret
> hashes, `getRandomValues` secrets); if Web Crypto is unavailable the
> provider fails closed. This is not production auth, not SAML/SCIM, and
> persistence is not durable. Every response carries `demoOnly: true` and
> the shared boundary note.

## Endpoints

| Route | Contract |
| --- | --- |
| `GET /api/oauth/.well-known/oauth-authorization-server` | RFC 8414 metadata: `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `response_types_supported: ["code"]`, `grant_types_supported: ["authorization_code", "refresh_token"]`, `code_challenge_methods_supported: ["S256"]`, `scopes_supported: ["read", "write"]`, `token_endpoint_auth_methods_supported` (basic/post/none) and revocation auth methods. Redirect-URI support is behavioral (exact-match registration plus exact-match authorize/token checks); `expires_in` is asserted on token responses. An OpenID-style alias serves the same fields at `.../openid-configuration` (no ID tokens are issued). |
| `GET /api/oauth/.well-known/oauth-protected-resource` | RFC 9728 metadata for the demo API resource `{origin}/api` (served by the REST adapter): `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported: ["header"]`. MCP tools over `/mcp` enforce the same server-derived bearer authority per request when an `Authorization` header is present (reads require `read`, writes require `write`); requests without the header keep the labelled demo identity. |
| `POST /api/oauth/register` (JSON) | Dynamic registration: `{client_name?, redirect_uris, scope?, token_endpoint_auth_method?}`. Each redirect URI is validated exactly (https, or http loopback for local demo testing; fragments never allowed); duplicates, unknown scopes and unknown auth methods fail closed. Returns the registration record plus a one-time `client_secret` (confidential clients) and a `registration_access_token` credential. |
| `GET /api/oauth/register/:clientId` | Management read with `Authorization: Bearer <registration_access_token>`; bad credentials and unknown clients fail closed. |
| `GET /api/oauth/authorize?...` | Starts a grant for the **server-derived** account (Passport header via the shared authority, or the labelled `x-demo-user` fallback; any caller-supplied user id in the query is ignored). Requires `response_type=code`, an exactly-registered `redirect_uri`, PKCE `code_challenge` with `code_challenge_method=S256` (plain rejected), in-grant and in-role scopes, and an optional RFC 8707 `resource` that must equal this deployment's API resource. Browsers (`Accept: text/html`) get a clearly labelled demo-only consent page tied to the server-derived account and requested scopes, with an approve/deny form (no auto-approval, no caller-supplied user id); machine clients (`format=json` or non-HTML accept) get the JSON grant ticket plus the browser consent path. The ticket names the requesting client (`client_name`) and expires in 5 minutes, single-use. |
| `POST /api/oauth/consent` (JSON) | `{grant_ticket, approved}`: approval mints the one-time 5-minute code bound to client, redirect URI, PKCE challenge and account; denial destroys the ticket (`access_denied`); replay fails closed. Stays machine-readable and never redirects. |
| `POST /api/oauth/consent/decision` (form) | Browser consent decision from the authorize consent page (`grant_ticket` + `decision=approve\|deny`, form-encoded): approval redirects (302) exactly to the registered redirect_uri with the one-time `code` and `state`; denial redirects with `error=access_denied` and `state`. The ticket is consumed exactly once; unknown, replayed, expired and malformed decisions fail closed with a machine-readable error and no redirect. Never accepts a caller-supplied user id. |
| `POST /api/oauth/token` (form) | `grant_type=authorization_code` (single-use code + exact redirect + `code_verifier` S256 check) or `grant_type=refresh_token` (single-use rotation; replay revokes the whole grant family). Secrets via basic auth or form fields; public (`none`) clients send only their id. Success: `{access_token, token_type: "Bearer", expires_in: 600, scope, refresh_token}`. Unknown clients, codes, verifiers, redirects, scopes and resources fail closed. |
| `POST /api/oauth/revoke` (form) | RFC 7009 revocation: a known token revokes its whole grant family; unknown tokens still return success so callers cannot probe the store. |

Machine discovery/token/revocation routes stay machine-readable: the JSON
consent POST approves without redirecting, while the browser consent page
posts to the separate form decision path, which only redirects (never
JSON) to the exactly-registered redirect_uri. Neither path accepts a
caller-supplied user id, and neither exposes raw secrets or tokens in logs
or HTML: the one-time grant ticket is the only credential the form carries.

## Scopes and roles

Scopes are `read` (default) and `write`. The authorizing account's role
caps issuance (viewers can never receive `write`). Every Jira REST read
endpoint (search, issue, comments, transitions, project, statuses,
myself) enforces a shared read gate when an `Authorization: Bearer` token
is present: the token must validate and carry the `read` scope, and
`myself` reports the server-derived bearer account; REST/MCP writes
through a bearer additionally require the `write` scope plus the existing
member/admin authority: viewer or read-only tokens get 403 and write
nothing, while member/admin `read write` tokens perform the same bounded
operations as their Passport/demo counterparts. MCP tools read the live
`Authorization` request header per call (the installed
`@nuxtjs/mcp-toolkit@0.21.0` with `@modelcontextprotocol/sdk@1.30.0`
propagates it via `extra.requestInfo.headers`) and enforce the same
server-derived read/write authority; a present bearer (valid or not)
never falls through to the demo identity. Requests without
`Authorization` keep the labelled local demo behavior. Deactivated demo
accounts deny already-issued tokens and refreshes.

## Vercel Connect registration (external, not done here)

A later registration uses the exact callback
`https://connect.vercel.com/callback` (it registers like any other exact
https URI), the discovered authorization/token endpoints, scopes
`read`/`write`, and PKCE S256. Three deployment prerequisites remain
outside this demo: enabling Vercel Passport deployment protection (the
source of the trusted authorization identity), no external Vercel Connect
registration/callback performed from this demo, and, if root
`/.well-known/*` discovery is wanted, proxying the toolkit-owned root
stubs (the fixed `@nuxtjs/mcp-toolkit` dependency answers 404
not-configured there; routing configuration is outside the worker
boundary) to `/api/oauth/.well-known/*`. For a stable issuer across
restarts, set `JIRA_OAUTH_ISSUER=https://<deployment>/api/oauth`;
otherwise the issuer derives per request from forwarded protocol/host.
Remaining limits: in-memory demo persistence only, no SAML/SCIM.

## Proving the local contract

```sh
pnpm --filter @jira-clone/jira test
```

OAuth coverage lives in `apps/jira/tests/jira-oauth-provider.test.ts`
(discovery, registration, grant/consent, exchange, rotation/replay,
revocation, deactivation, fail-closed cases),
`apps/jira/tests/jira-oauth-bearer.test.ts` (bearer REST writes, viewer
and read-scope denial, no-fallback enforcement),
`apps/jira/tests/jira-oauth-browser.test.ts` (browser approve/deny
redirects, state and code binding, replay/failure paths, REST read-bearer
authorization, MCP bearer authority) and
`apps/jira/tests/jira-mcp-tools.test.ts` (tool protocol plus live
per-request bearer authority). The shared domain boundary is
`apps/jira/server/utils/jiraOAuth.ts` (`authorizeOAuthBearerRead`,
`oauthBrowserDecision`, `oauthRedirectWithParams`); the REST read gate is
`authorizeBearerRead`/`restBearerIdentity` and the MCP per-request
authority is `mcpBearerAuthority`/`mcpBearerIdentity`, both in
`apps/jira/server/utils/jiraRest.ts`.
