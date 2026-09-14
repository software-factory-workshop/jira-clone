/**
 * Demo-only OAuth 2.1 provider boundary for the ADEO fake Jira.
 *
 * A small, standards-honest authorization-code provider (RFC 6749/6750/7009/
 * 7591/7636/8414/9126/9728-shaped, OAuth 2.1 draft behavior: PKCE S256 is
 * always required, plain is rejected) that a later Vercel Connect
 * registration can use. This is product work with explicit demo limits, not
 * production auth:
 *
 * - Authorization identity is server-derived only. Callers pass an
 *   already-resolved `AppAccount` (Passport-derived via `./appAccounts`,
 *   which fails closed on malformed identities and never keys accounts by
 *   email). This module never reads a user id from query/body/header: extra
 *   identity-looking parameters are ignored and tests prove the issued code
 *   binds the passed account, not any caller-supplied id.
 * - Tokens are opaque random bearer strings (no JWTs, no JWKS to operate).
 *   Access tokens are short-lived (10 minutes); refresh tokens rotate
 *   single-use and replay revokes the whole grant family.
 * - Persistence is the existing in-memory demo boundary: clients, grant
 *   tickets, codes and tokens live in module Maps, survive reload against
 *   the same running server, and reset on redeploy, cold start or
 *   `resetOAuthState()` (tests). There is no durable store, no SAML, no
 *   SCIM, and Vercel Connect itself is not registered from here.
 * - Crypto is platform Web Crypto only (`crypto.subtle` SHA-256 for PKCE
 *   S256 and salted client-secret hashes, `crypto.getRandomValues` for
 *   secrets/tokens). No dependency, no toy crypto. If Web Crypto is
 *   unavailable the module fails closed instead of falling back.
 * - Discovery cannot live at root `/.well-known/*`: the fixed
 *   `@nuxtjs/mcp-toolkit` dependency registers those paths as
 *   not-configured stubs and routing configuration is outside the worker
 *   boundary. The provider therefore publishes RFC 8414-shaped metadata at
 *   `{issuer}/.well-known/oauth-authorization-server` (and RFC 9728
 *   protected-resource metadata next to it) and documents the external
 *   proxy step a deployment would need for root discovery.
 *
 * Fails closed throughout: unknown clients, redirect mismatches, reused or
 * unknown codes, bad verifiers, unknown scopes, resource mismatches and
 * unknown/revoked/expired/deactivated tokens are errors that issue or
 * authorize nothing.
 */

import type { AppAccount, AppIdentitySource } from "./appAccounts.ts";
import type { DemoRole } from "./demoAccounts.ts";

/** Issuer path under the demo API. Full issuer is `{origin}/api/oauth`. */
export const OAUTH_ISSUER_PATH = "/api/oauth";

/** Scopes this provider issues. `read` is the default; `write` gates writes. */
export const OAUTH_SCOPES = ["read", "write"] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

/** Short-lived bearer access: 10 minutes. */
export const OAUTH_ACCESS_TOKEN_TTL_S = 600;

/** Refresh-token lifetime: 24 hours (rotation still applies on every use). */
export const OAUTH_REFRESH_TOKEN_TTL_S = 86400;

/** Authorization codes and pre-consent grant tickets: 5 minutes, one-time. */
export const OAUTH_CODE_TTL_S = 300;
export const OAUTH_GRANT_TICKET_TTL_S = 300;

/**
 * Exact redirect URI a later Vercel Connect service-provider registration
 * must use. Registration accepts it like any other exact https URI; the
 * authorize/token steps then require an exact string match.
 */
export const OAUTH_CONNECT_CALLBACK = "https://connect.vercel.com/callback";

export const OAUTH_TOKEN_AUTH_METHODS = [
  "client_secret_basic",
  "client_secret_post",
  "none",
] as const;

/** Explicit boundary note for responses and docs. */
export const OAUTH_BOUNDARY =
  "Demo-only OAuth 2.1 provider boundary: authorization-code flow with mandatory PKCE S256, " +
  "short-lived opaque bearer access tokens (10 minutes), rotating single-use refresh tokens, RFC 7009 " +
  "revocation and dynamic client registration over an in-memory demo store (clients, codes and tokens " +
  "reset on redeploy or cold start). Authorization identity is server-derived (Passport or the documented " +
  "non-production dev stand-in); no user id is ever accepted from query/body/header as authority. " +
  "Not production auth, not SAML/SCIM, not durable, and Vercel Connect is not registered from this demo.";

/** Machine-readable error codes used in `{error, error_description}` bodies. */
export const OAUTH_ERRORS = {
  invalidRequest: "invalid_request",
  invalidClient: "invalid_client",
  invalidGrant: "invalid_grant",
  unauthorizedClient: "unauthorized_client",
  unsupportedGrantType: "unsupported_grant_type",
  unsupportedResponseType: "unsupported_response_type",
  invalidScope: "invalid_scope",
  invalidTarget: "invalid_target",
  accessDenied: "access_denied",
  serverError: "server_error",
} as const;

export type OAuthErrorCode =
  (typeof OAUTH_ERRORS)[keyof typeof OAUTH_ERRORS];

export type OAuthFailure = {
  ok: false;
  statusCode: number;
  error: OAuthErrorCode;
  errorDescription: string;
};

function fail(
  statusCode: number,
  error: OAuthErrorCode,
  errorDescription: string,
): OAuthFailure {
  return { ok: false, statusCode, error, errorDescription };
}

function nowSeconds(now?: number): number {
  return Math.floor((now ?? Date.now()) / 1000);
}

// ---------------------------------------------------------------------------
// Platform crypto (Web Crypto only; fail closed when unavailable).
// ---------------------------------------------------------------------------

function webCrypto(): SubtleCrypto {
  const scope = globalThis as {
    crypto?: { subtle?: SubtleCrypto; getRandomValues?: (array: Uint8Array) => Uint8Array };
  };
  const subtle = scope.crypto?.subtle;
  if (!subtle || typeof scope.crypto?.getRandomValues !== "function") {
    throw new Error(
      "Demo-only OAuth provider is unavailable: platform Web Crypto is missing. No token was issued.",
    );
  }
  return subtle;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const scope = globalThis as {
    btoa?: (input: string) => string;
    Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } };
  };
  const base64 =
    typeof scope.btoa === "function"
      ? scope.btoa(binary)
      : scope.Buffer
        ? scope.Buffer.from(binary, "binary").toString("base64")
        : null;
  if (!base64) {
    throw new Error(
      "Demo-only OAuth provider is unavailable: no base64 encoder. No token was issued.",
    );
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Opaque random token with a readable prefix (never a JWT). */
function randomToken(prefix: string, bytes = 32): string {
  const scope = globalThis as {
    crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
  };
  const random = scope.crypto?.getRandomValues;
  if (typeof random !== "function") {
    throw new Error(
      "Demo-only OAuth provider is unavailable: no secure random source. No token was issued.",
    );
  }
  const raw = new Uint8Array(bytes);
  random.call(scope.crypto, raw);
  return `${prefix}_${base64UrlEncodeBytes(raw)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = webCrypto();
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** PKCE S256 code challenge for a verifier. Exported so tests and the browser demo use the real transform. */
export async function s256Challenge(verifier: string): Promise<string> {
  const subtle = webCrypto();
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

/** Constant-time string comparison for hashes and bearer secrets. */
function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Issuer, scopes, redirect URIs.
// ---------------------------------------------------------------------------

/**
 * Resolve the provider issuer. An explicit `JIRA_OAUTH_ISSUER` env value
 * wins (stable across restarts); otherwise it is derived per request from
 * the forwarded protocol/host plus `/api/oauth`. The derived form is a
 * demo convenience, not a stable production issuer: document the env for
 * any real registration.
 */
export function resolveOAuthIssuer(input: {
  envIssuer?: unknown;
  proto?: unknown;
  host?: unknown;
}): string {
  if (typeof input.envIssuer === "string" && input.envIssuer.trim() !== "") {
    return input.envIssuer.trim().replace(/\/+$/g, "");
  }
  const proto =
    typeof input.proto === "string" && input.proto.trim() !== ""
      ? input.proto.trim().toLowerCase()
      : "https";
  const host =
    typeof input.host === "string" && input.host.trim() !== ""
      ? input.host.trim().toLowerCase()
      : "localhost";
  return `${proto}://${host}${OAUTH_ISSUER_PATH}`;
}

/** Protected API resource identifier for an issuer: `{origin}/api`. */
export function oauthResourceForIssuer(issuer: string): string {
  const trimmed = issuer.replace(/\/+$/g, "");
  const withoutSuffix = trimmed.endsWith("/api/oauth")
    ? trimmed.slice(0, -"/api/oauth".length)
    : trimmed.replace(/\/oauth$/g, "");
  return `${withoutSuffix}/api`;
}

function isOAuthScopeName(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

/**
 * Parse a space-separated scope string. Unknown names fail closed; callers
 * pass the role-derived default when the parameter is absent.
 */
export function parseOAuthScopes(
  value: unknown,
  fallback: readonly OAuthScope[],
): { ok: true; scopes: OAuthScope[] } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, scopes: [...fallback] };
  }
  if (typeof value !== "string") {
    return {
      ok: false,
      error:
        "Invalid scope: expected a space-separated string of demo scopes (read, write). Nothing was issued.",
    };
  }
  const names = value.split(/\s+/).filter((part) => part !== "");
  if (names.length === 0) {
    return { ok: true, scopes: [...fallback] };
  }
  const unknown = names.filter((name) => !isOAuthScopeName(name));
  if (unknown.length > 0) {
    return {
      ok: false,
      error:
        `Unknown demo scope(s): ${unknown.join(", ")}. Supported demo scopes: ${OAUTH_SCOPES.join(", ")}. ` +
        "Nothing was issued.",
    };
  }
  return { ok: true, scopes: [...new Set(names as OAuthScope[])] };
}

/** Scopes an account may hold: viewers read, members/admins read and write. */
export function allowedScopesForRole(role: DemoRole): OAuthScope[] {
  return role === "viewer" ? ["read"] : ["read", "write"];
}

/**
 * Exact redirect-URI validation. Registration accepts absolute URLs with an
 * https scheme, plus http only for loopback hosts (local demo testing),
 * and never allows a fragment. Authorization and token steps require an
 * exact string match against a registered value.
 */
export function validateRedirectUri(
  value: unknown,
): { ok: true; redirectUri: string } | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return {
      ok: false,
      error:
        "Invalid redirect_uri: expected a nonblank absolute URL string. Nothing was registered or issued.",
    };
  }
  const candidate = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      error: `Invalid redirect_uri "${candidate}": not an absolute URL. Nothing was registered or issued.`,
    };
  }
  if (parsed.hash !== "") {
    return {
      ok: false,
      error: `Invalid redirect_uri "${candidate}": fragments are never allowed. Nothing was registered or issued.`,
    };
  }
  const host = parsed.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (parsed.protocol === "https:") {
    return { ok: true, redirectUri: candidate };
  }
  if (parsed.protocol === "http:" && loopback) {
    return { ok: true, redirectUri: candidate };
  }
  return {
    ok: false,
    error:
      `Invalid redirect_uri "${candidate}": only https URLs (plus http loopback for local demo testing) are accepted. ` +
      "Nothing was registered or issued.",
  };
}

function validateCodeChallengeShape(value: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(value)) {
    return {
      ok: false,
      error:
        "Invalid code_challenge: expected the S256 challenge string (43-128 base64url characters). Nothing was issued.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Demo stores (in-memory boundary; reset on redeploy/cold start/tests).
// ---------------------------------------------------------------------------

export type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  /** Granted ceiling; issuance still caps by the authorizing account role. */
  scopes: OAuthScope[];
  confidential: boolean;
  secretSalt: string | null;
  secretHash: string | null;
  registrationToken: string;
  createdAt: number;
};

export type OAuthAccountSnapshot = {
  accountId: string;
  label: string;
  role: DemoRole;
  canWrite: boolean;
  canReset: boolean;
  externalSub: string | null;
  email: string | null;
  displayName: string | null;
  identitySource: AppIdentitySource;
  dev: boolean;
};

type GrantTicket = {
  ticket: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: OAuthScope[];
  account: OAuthAccountSnapshot;
  state: string | null;
  resource: string | null;
  expiresAt: number;
};

type AuthCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: OAuthScope[];
  account: OAuthAccountSnapshot;
  used: boolean;
  expiresAt: number;
};

type AccessToken = {
  token: string;
  clientId: string;
  familyId: string;
  scopes: OAuthScope[];
  account: OAuthAccountSnapshot;
  revoked: boolean;
  expiresAt: number;
};

type RefreshToken = {
  token: string;
  clientId: string;
  familyId: string;
  scopes: OAuthScope[];
  account: OAuthAccountSnapshot;
  revoked: boolean;
  replacedBy: string | null;
  expiresAt: number;
};

const clients = new Map<string, OAuthClient>();
const grantTickets = new Map<string, GrantTicket>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, AccessToken>();
const refreshTokens = new Map<string, RefreshToken>();
const deactivatedAccounts = new Set<string>();

/**
 * Serializable snapshot of the whole demo OAuth store. The persistence
 * boundary (`oauthPersistence.ts`) hydrates the in-memory maps from Neon
 * before a request touches them and writes the changed entries back after,
 * so registered clients and issued tokens survive cold starts and deploys.
 * The OAuth logic itself stays synchronous and in-memory.
 */
export type OAuthStateSnapshot = {
  clients: OAuthClient[];
  grantTickets: GrantTicket[];
  authCodes: AuthCode[];
  accessTokens: AccessToken[];
  refreshTokens: RefreshToken[];
  deactivatedAccounts: string[];
};

export function exportOAuthState(): OAuthStateSnapshot {
  return {
    clients: [...clients.values()],
    grantTickets: [...grantTickets.values()],
    authCodes: [...authCodes.values()],
    accessTokens: [...accessTokens.values()],
    refreshTokens: [...refreshTokens.values()],
    deactivatedAccounts: [...deactivatedAccounts],
  };
}

/** Replace the in-memory store with a snapshot (used by hydration). */
export function importOAuthState(snapshot: OAuthStateSnapshot): void {
  resetOAuthState();
  for (const c of snapshot.clients) clients.set(c.clientId, c);
  for (const t of snapshot.grantTickets) grantTickets.set(t.ticket, t);
  for (const c of snapshot.authCodes) authCodes.set(c.code, c);
  for (const t of snapshot.accessTokens) accessTokens.set(t.token, t);
  for (const t of snapshot.refreshTokens) refreshTokens.set(t.token, t);
  for (const a of snapshot.deactivatedAccounts) deactivatedAccounts.add(a);
}

/**
 * Clear all demo OAuth state: clients, grant tickets, codes, tokens and
 * deactivations. Tests call this; routes never do.
 */
export function resetOAuthState(): void {
  clients.clear();
  grantTickets.clear();
  authCodes.clear();
  accessTokens.clear();
  refreshTokens.clear();
  deactivatedAccounts.clear();
}

/**
 * Demo-only test hook: deny an already-issued token by deactivating its
 * account. Bearer validation and refresh rotation fail closed for
 * deactivated accounts. There is no admin route for this; it is labelled
 * demo state, not a directory sync.
 */
export function deactivateOAuthAccount(accountId: string): void {
  deactivatedAccounts.add(accountId);
}

export function isOAuthAccountDeactivated(accountId: string): boolean {
  return deactivatedAccounts.has(accountId);
}

/** Snapshot the server-resolved account into a grant/code/token. Pure. */
export function snapshotOAuthAccount(account: AppAccount): OAuthAccountSnapshot {
  return {
    accountId: account.id,
    label: account.label,
    role: account.role,
    canWrite: account.canWrite,
    canReset: account.canReset,
    externalSub: account.externalSub,
    email: account.email,
    displayName: account.displayName,
    identitySource: account.identitySource,
    dev: account.dev,
  };
}

/** Rebuild the application account for a validated bearer token. Pure. */
export function accountFromSnapshot(snapshot: OAuthAccountSnapshot): AppAccount {
  return {
    id: snapshot.accountId,
    label: snapshot.label,
    role: snapshot.role,
    canWrite: snapshot.canWrite,
    canReset: snapshot.canReset,
    demoOnly: true,
    identitySource: snapshot.identitySource,
    externalSub: snapshot.externalSub,
    email: snapshot.email,
    displayName: snapshot.displayName,
    dev: snapshot.dev,
    explicit: true,
  };
}

// ---------------------------------------------------------------------------
// Discovery documents (RFC 8414 / RFC 9728 shapes, standard fields only).
// ---------------------------------------------------------------------------

export type OAuthAuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  revocation_endpoint_auth_methods_supported: string[];
};

/**
 * RFC 8414 authorization-server metadata for this provider. Uses only
 * standard fields: redirect-URI support is behavioral (exact-match
 * registration plus exact-match authorize/token checks, including the
 * documented Connect callback) and `expires_in` is asserted on token
 * responses, so neither is invented as a discovery field.
 */
export function oauthAuthorizationServerMetadata(
  issuer: string,
): OAuthAuthorizationServerMetadata {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: `${issuer}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...OAUTH_SCOPES],
    token_endpoint_auth_methods_supported: [...OAUTH_TOKEN_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...OAUTH_TOKEN_AUTH_METHODS],
  };
}

export type OAuthProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
};

/**
 * RFC 9728 protected-resource metadata for the demo API resource
 * (`{origin}/api`, served by the REST adapter). The toolkit-owned `/mcp`
 * endpoint is intentionally absent: it currently serves unauthenticated
 * demo tools and is not bearer-protected by this provider.
 */
export function oauthProtectedResourceMetadata(
  issuer: string,
): OAuthProtectedResourceMetadata {
  return {
    resource: oauthResourceForIssuer(issuer),
    authorization_servers: [issuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
  };
}

// ---------------------------------------------------------------------------
// Registration, grant tickets (browser consent ticket), authorization codes.
// ---------------------------------------------------------------------------

export type OAuthRegisterInput = {
  client_name?: unknown;
  redirect_uris?: unknown;
  scope?: unknown;
  token_endpoint_auth_method?: unknown;
};

export type OAuthRegisterResult =
  | {
      ok: true;
      client: {
        client_id: string;
        client_name: string;
        redirect_uris: string[];
        scope: string;
        token_endpoint_auth_method: string;
        registration_access_token: string;
        registration_client_uri: string;
      };
      /** Confidential clients receive this once; public clients get null. */
      clientSecret: string | null;
    }
  | OAuthFailure;

export type OAuthRegisteredClientLookup =
  | { ok: true; client: OAuthClient }
  | OAuthFailure;

/**
 * Dynamic client registration (RFC 7591-shaped). `redirect_uris` is
 * required and each URI is validated exactly (https, or http loopback for
 * local demo testing; fragments never allowed). Duplicate redirect URIs in
 * one request are rejected. `token_endpoint_auth_method` accepts
 * `client_secret_basic` (default), `client_secret_post` and `none`
 * (public); anything else fails closed. Unknown scope names fail closed.
 * Granted scopes are the intersection of the request and the demo set.
 */
export async function oauthRegisterClient(
  input: OAuthRegisterInput,
  issuer: string,
  now?: number,
): Promise<OAuthRegisterResult> {
  const issuedAt = nowSeconds(now);
  const name =
    typeof input.client_name === "string" && input.client_name.trim() !== ""
      ? input.client_name.trim().slice(0, 120)
      : "Demo OAuth client";
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0) {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid registration: redirect_uris must be a non-empty array of absolute URLs. Nothing was registered.",
    );
  }
  const redirectUris: string[] = [];
  for (const entry of input.redirect_uris) {
    const checked = validateRedirectUri(entry);
    if (!checked.ok) {
      return fail(400, OAUTH_ERRORS.invalidRequest, `Invalid registration: ${checked.error}`);
    }
    redirectUris.push(checked.redirectUri);
  }
  if (new Set(redirectUris).size !== redirectUris.length) {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid registration: redirect_uris contains duplicates. Nothing was registered.",
    );
  }
  const authMethod =
    input.token_endpoint_auth_method === undefined ||
    input.token_endpoint_auth_method === null
      ? "client_secret_basic"
      : input.token_endpoint_auth_method;
  if (
    authMethod !== "client_secret_basic" &&
    authMethod !== "client_secret_post" &&
    authMethod !== "none"
  ) {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid registration: token_endpoint_auth_method must be client_secret_basic, " +
        "client_secret_post or none. Nothing was registered.",
    );
  }
  const parsedScopes = parseOAuthScopes(input.scope, [...OAUTH_SCOPES]);
  if (!parsedScopes.ok) {
    return fail(400, OAUTH_ERRORS.invalidScope, `Invalid registration: ${parsedScopes.error}`);
  }
  const confidential = authMethod !== "none";
  const clientId = randomToken("demo_client");
  const registrationToken = randomToken("demo_reg");
  let secretSalt: string | null = null;
  let secretHash: string | null = null;
  let clientSecret: string | null = null;
  if (confidential) {
    clientSecret = randomToken("demo_secret", 40);
    secretSalt = randomToken("salt", 16);
    secretHash = await sha256Hex(`${secretSalt}:${clientSecret}`);
  }
  clients.set(clientId, {
    clientId,
    clientName: name,
    redirectUris,
    scopes: parsedScopes.scopes,
    confidential,
    secretSalt,
    secretHash,
    registrationToken,
    createdAt: issuedAt,
  });
  return {
    ok: true,
    client: {
      client_id: clientId,
      client_name: name,
      redirect_uris: redirectUris,
      scope: parsedScopes.scopes.join(" "),
      token_endpoint_auth_method: authMethod,
      registration_access_token: registrationToken,
      registration_client_uri: `${issuer}/register/${encodeURIComponent(clientId)}`,
    },
    clientSecret,
  };
}

/**
 * Read one registered client for the management URI. The
 * `registration_access_token` (Bearer) is the only credential accepted.
 */
export function oauthReadClient(
  clientId: string,
  registrationToken: string | null,
): OAuthRegisteredClientLookup {
  const client = clients.get(clientId);
  if (!client) {
    return fail(
      404,
      OAUTH_ERRORS.invalidClient,
      "Unknown demo client: no registration with this client_id exists. Nothing was disclosed.",
    );
  }
  if (
    !registrationToken ||
    !secretsEqual(registrationToken, client.registrationToken)
  ) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Invalid registration credential: the registration_access_token is missing or unknown. Nothing was disclosed.",
    );
  }
  return { ok: true, client };
}

export type OAuthAuthorizeInput = {
  response_type?: unknown;
  client_id?: unknown;
  redirect_uri?: unknown;
  scope?: unknown;
  state?: unknown;
  code_challenge?: unknown;
  code_challenge_method?: unknown;
  resource?: unknown;
  /** Extra caller-supplied identity material is ignored by design. */
  [extra: string]: unknown;
};

export type OAuthGrantTicketResult =
  | {
      ok: true;
      ticket: {
        grant_ticket: string;
        client_id: string;
        redirect_uri: string;
        scope: string;
        state: string | null;
        resource: string | null;
        expires_in: number;
        consent_path: string;
        account: { accountId: string; label: string; role: DemoRole };
      };
    }
  | OAuthFailure;

/**
 * Begin an authorization-code grant for a server-resolved account.
 *
 * `response_type=code` with mandatory PKCE S256 (`code_challenge` plus
 * `code_challenge_method=S256`; `plain` is rejected per OAuth 2.1).
 * `redirect_uri` must exactly match one registered value. Requested scopes
 * are intersected with the client grant and the account role (viewers can
 * never receive `write`). An optional RFC 8707 `resource` must exactly
 * match this deployment's API resource. Any caller-supplied user/subject
 * field (`user_id`, `sub`, `username`, `email`, `account_id`, ...) is
 * ignored: the issued code always binds the passed `account`.
 */
export function oauthBeginGrant(
  input: OAuthAuthorizeInput,
  account: AppAccount,
  issuer: string,
  now?: number,
): OAuthGrantTicketResult {
  const issuedAt = nowSeconds(now);
  if (input.response_type !== "code") {
    return fail(
      400,
      OAUTH_ERRORS.unsupportedResponseType,
      "Unsupported response_type: this demo provider only supports code. Nothing was issued.",
    );
  }
  if (typeof input.client_id !== "string" || input.client_id.trim() === "") {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid authorization request: client_id is required. Nothing was issued.",
    );
  }
  const client = clients.get(input.client_id);
  if (!client) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Unknown demo client: no registration with this client_id exists. Nothing was issued.",
    );
  }
  const redirectChecked = validateRedirectUri(input.redirect_uri);
  if (!redirectChecked.ok) {
    return fail(400, OAUTH_ERRORS.invalidRequest, redirectChecked.error);
  }
  if (!client.redirectUris.includes(redirectChecked.redirectUri)) {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Redirect mismatch: redirect_uri is not one of this client's registered redirect_uris (exact match required). " +
        "Nothing was issued.",
    );
  }
  const method = input.code_challenge_method;
  if (method !== "S256") {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid code_challenge_method: this demo provider requires S256 (OAuth 2.1; plain is rejected). " +
        "Nothing was issued.",
    );
  }
  const challengeChecked = validateCodeChallengeShape(input.code_challenge);
  if (!challengeChecked.ok) {
    return fail(400, OAUTH_ERRORS.invalidRequest, challengeChecked.error);
  }
  const requested = parseOAuthScopes(input.scope, [...client.scopes]);
  if (!requested.ok) {
    return fail(400, OAUTH_ERRORS.invalidScope, requested.error);
  }
  const outsideGrant = requested.scopes.filter(
    (scope) => !client.scopes.includes(scope),
  );
  if (outsideGrant.length > 0) {
    return fail(
      400,
      OAUTH_ERRORS.invalidScope,
      `Scope exceeds this client's grant: ${outsideGrant.join(", ")} was not registered for this client. ` +
        "Nothing was issued.",
    );
  }
  const allowed = new Set(allowedScopesForRole(account.role));
  const outsideRole = requested.scopes.filter((scope) => !allowed.has(scope));
  if (outsideRole.length > 0) {
    return fail(
      403,
      OAUTH_ERRORS.invalidScope,
      `Scope exceeds this demo account: ${outsideRole.join(", ")} is not available to role ${account.role}. ` +
        "Nothing was issued.",
    );
  }
  let resource: string | null = null;
  if (input.resource !== undefined && input.resource !== null) {
    if (typeof input.resource !== "string" || input.resource.trim() === "") {
      return fail(
        400,
        OAUTH_ERRORS.invalidTarget,
        "Invalid resource: expected this deployment's API resource identifier. Nothing was issued.",
      );
    }
    const expected = oauthResourceForIssuer(issuer);
    if (input.resource.trim() !== expected) {
      return fail(
      400,
        OAUTH_ERRORS.invalidTarget,
        `Unknown resource: this demo provider only serves resource "${expected}". Nothing was issued.`,
      );
    }
    resource = expected;
  }
  const state =
    typeof input.state === "string" && input.state !== "" ? input.state.slice(0, 1024) : null;
  const ticket = randomToken("demo_grant");
  const scopes = requested.scopes;
  grantTickets.set(ticket, {
    ticket,
    clientId: client.clientId,
    redirectUri: redirectChecked.redirectUri,
    codeChallenge: input.code_challenge as string,
    scopes,
    account: snapshotOAuthAccount(account),
    state,
    resource,
    expiresAt: issuedAt + OAUTH_GRANT_TICKET_TTL_S,
  });
  return {
    ok: true,
    ticket: {
      grant_ticket: ticket,
      client_id: client.clientId,
      redirect_uri: redirectChecked.redirectUri,
      scope: scopes.join(" "),
      state,
      resource,
      expires_in: OAUTH_GRANT_TICKET_TTL_S,
      consent_path: `${OAUTH_ISSUER_PATH}/consent`,
      account: { accountId: account.id, label: account.label, role: account.role },
    },
  };
}

export type OAuthApproveInput = {
  grant_ticket?: unknown;
  approved?: unknown;
};

export type OAuthApproveResult =
  | {
      ok: true;
      approval: {
        code: string;
        state: string | null;
        expires_in: number;
        redirect_uri: string;
      };
    }
  | OAuthFailure;

/**
 * Approve a grant ticket (the consent decision) and mint the one-time
 * authorization code. Denials (`approved: false`) destroy the ticket and
 * return `access_denied` with no code. The JSON consent POST is the demo's
 * only approval path; the browser demo page is a labelled demo stand-in.
 */
export function oauthApproveGrant(
  input: OAuthApproveInput,
  now?: number,
): OAuthApproveResult {
  const issuedAt = nowSeconds(now);
  if (typeof input.grant_ticket !== "string" || input.grant_ticket === "") {
    return fail(
      400,
      OAUTH_ERRORS.invalidRequest,
      "Invalid approval: grant_ticket is required. Nothing was issued.",
    );
  }
  const pending = grantTickets.get(input.grant_ticket);
  if (!pending) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Unknown or consumed grant ticket: it may have expired or already been decided. Nothing was issued.",
    );
  }
  grantTickets.delete(input.grant_ticket);
  if (issuedAt > pending.expiresAt) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Expired grant ticket: approve again within 5 minutes. Nothing was issued.",
    );
  }
  if (input.approved !== true) {
    return fail(
      403,
      OAUTH_ERRORS.accessDenied,
      "The demo account denied this authorization request. No code was issued.",
    );
  }
  const code = randomToken("demo_code");
  authCodes.set(code, {
    code,
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    scopes: pending.scopes,
    account: pending.account,
    used: false,
    expiresAt: issuedAt + OAUTH_CODE_TTL_S,
  });
  return {
    ok: true,
    approval: {
      code,
      state: pending.state,
      expires_in: OAUTH_CODE_TTL_S,
      redirect_uri: pending.redirectUri,
    },
  };
}

// ---------------------------------------------------------------------------
// Token exchange, refresh rotation, revocation, bearer validation.
// ---------------------------------------------------------------------------

export type OAuthClientAuth = {
  clientId: string | null;
  secret: string | null;
  method: "client_secret_basic" | "client_secret_post" | "none";
};

export type OAuthTokenInput = {
  grant_type?: unknown;
  code?: unknown;
  redirect_uri?: unknown;
  code_verifier?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  resource?: unknown;
};

export type OAuthTokenResult =
  | {
      ok: true;
      token: {
        access_token: string;
        token_type: "Bearer";
        expires_in: number;
        scope: string;
        refresh_token: string;
      };
    }
  | OAuthFailure;

/**
 * Authenticate a token-request client from its presented credential. Public
 * clients must send `client_id` with no secret; confidential clients must
 * present the secret via basic or post (matching their registration unless
 * the route already enforced it). Unknown clients and bad secrets fail
 * closed.
 */
export async function oauthAuthenticateTokenClient(
  client: OAuthClient,
  auth: OAuthClientAuth,
): Promise<{ ok: true } | OAuthFailure> {
  if (auth.clientId !== client.clientId) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Client mismatch: the authenticated client_id does not match this grant. Nothing was issued.",
    );
  }
  if (!client.confidential) {
    return { ok: true };
  }
  if (!auth.secret || client.secretSalt === null || client.secretHash === null) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Missing client secret: this is a confidential demo client. Nothing was issued.",
    );
  }
  const candidate = await sha256Hex(`${client.secretSalt}:${auth.secret}`);
  if (!secretsEqual(candidate, client.secretHash)) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Invalid client secret. Nothing was issued.",
    );
  }
  return { ok: true };
}

/** Look up a token client by id (unknown ids fail closed as invalid_client). */
export function oauthTokenClientById(
  clientId: unknown,
): { ok: true; client: OAuthClient } | OAuthFailure {
  if (typeof clientId !== "string" || clientId === "") {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Invalid token request: client_id is required. Nothing was issued.",
    );
  }
  const client = clients.get(clientId);
  if (!client) {
    return fail(
      401,
      OAUTH_ERRORS.invalidClient,
      "Unknown demo client: no registration with this client_id exists. Nothing was issued.",
    );
  }
  return { ok: true, client };
}

async function mintTokenPair(input: {
  client: OAuthClient;
  scopes: OAuthScope[];
  account: OAuthAccountSnapshot;
  now: number;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const familyId = randomToken("demo_grant_family", 16);
  const accessToken = randomToken("demo_at");
  const refreshToken = randomToken("demo_rt");
  accessTokens.set(accessToken, {
    token: accessToken,
    clientId: input.client.clientId,
    familyId,
    scopes: [...input.scopes],
    account: input.account,
    revoked: false,
    expiresAt: input.now + OAUTH_ACCESS_TOKEN_TTL_S,
  });
  refreshTokens.set(refreshToken, {
    token: refreshToken,
    clientId: input.client.clientId,
    familyId,
    scopes: [...input.scopes],
    account: input.account,
    revoked: false,
    replacedBy: null,
    expiresAt: input.now + OAUTH_REFRESH_TOKEN_TTL_S,
  });
  return { accessToken, refreshToken };
}

/**
 * Exchange one authorization code for an access/refresh pair. The code is
 * single-use, expires after 5 minutes, and binds client, redirect URI,
 * PKCE challenge and the server-derived account: any mismatch (including a
 * bad `code_verifier`, which recomputes S256 and constant-time compares)
 * fails closed and consumes the code. `resource`, when present, must equal
 * the deployment resource.
 */
export async function oauthExchangeCode(
  input: OAuthTokenInput,
  auth: OAuthClientAuth,
  issuer: string,
  now?: number,
): Promise<OAuthTokenResult> {
  const issuedAt = nowSeconds(now);
  if (typeof input.code !== "string" || input.code === "") {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Invalid code exchange: code is required. Nothing was issued.",
    );
  }
  const stored = authCodes.get(input.code);
  if (!stored || stored.used) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Unknown or reused authorization code. Nothing was issued.",
    );
  }
  authCodes.delete(input.code);
  const lookup = oauthTokenClientById(auth.clientId);
  if (!lookup.ok) {
    return lookup;
  }
  const client = lookup.client;
  if (client.clientId !== stored.clientId) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Code was issued to a different demo client. Nothing was issued.",
    );
  }
  const gate = await oauthAuthenticateTokenClient(client, {
    ...auth,
    clientId: auth.clientId ?? client.clientId,
  });
  if (!gate.ok) {
    return gate;
  }
  if (issuedAt > stored.expiresAt) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Expired authorization code: restart the authorization request. Nothing was issued.",
    );
  }
  if (typeof input.redirect_uri !== "string" || input.redirect_uri !== stored.redirectUri) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Redirect mismatch: redirect_uri must exactly match the authorization request. Nothing was issued.",
    );
  }
  if (typeof input.code_verifier !== "string" || input.code_verifier === "") {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Missing code_verifier: PKCE S256 is mandatory. Nothing was issued.",
    );
  }
  let challenge: string;
  try {
    challenge = await s256Challenge(input.code_verifier);
  } catch {
    return fail(
      500,
      OAUTH_ERRORS.serverError,
      "Demo-only OAuth provider is unavailable: platform Web Crypto is missing. Nothing was issued.",
    );
  }
  if (!secretsEqual(challenge, stored.codeChallenge)) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "PKCE verification failed: code_verifier does not match the challenge. Nothing was issued.",
    );
  }
  if (input.resource !== undefined && input.resource !== null) {
    if (typeof input.resource !== "string" || input.resource.trim() === "") {
      return fail(
        400,
        OAUTH_ERRORS.invalidTarget,
        "Invalid resource: expected this deployment's API resource identifier. Nothing was issued.",
      );
    }
    const expected = oauthResourceForIssuer(issuer);
    if (input.resource.trim() !== expected) {
      return fail(
        400,
        OAUTH_ERRORS.invalidTarget,
        `Unknown resource: this demo provider only serves resource "${expected}". Nothing was issued.`,
      );
    }
  }
  const minted = await mintTokenPair({
    client,
    scopes: stored.scopes,
    account: stored.account,
    now: issuedAt,
  });
  return {
    ok: true,
    token: {
      access_token: minted.accessToken,
      token_type: "Bearer",
      expires_in: OAUTH_ACCESS_TOKEN_TTL_S,
      scope: stored.scopes.join(" "),
      refresh_token: minted.refreshToken,
    },
  };
}

/**
 * Rotate a refresh token. The presented token is single-use: success
 * revokes it, narrows scopes when requested, and issues a fresh pair in the
 * same grant family. Replaying an already-rotated (or revoked) token fails
 * closed and revokes the whole grant family, so a stolen refresh token is
 * at most single-use. Expired, unknown and deactivated-account tokens fail
 * closed; unknowns additionally revoke nothing because there is no family.
 */
export async function oauthRefreshToken(
  input: OAuthTokenInput,
  auth: OAuthClientAuth,
  now?: number,
): Promise<OAuthTokenResult> {
  const issuedAt = nowSeconds(now);
  if (typeof input.refresh_token !== "string" || input.refresh_token === "") {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Invalid refresh request: refresh_token is required. Nothing was issued.",
    );
  }
  const stored = refreshTokens.get(input.refresh_token);
  if (!stored) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Unknown refresh token. Nothing was issued.",
    );
  }
  const lookup = oauthTokenClientById(auth.clientId ?? undefined);
  if (!lookup.ok) {
    return lookup;
  }
  const client = lookup.client;
  if (client.clientId !== stored.clientId) {
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Refresh token was issued to a different demo client. Nothing was issued.",
    );
  }
  const gate = await oauthAuthenticateTokenClient(client, {
    ...auth,
    clientId: auth.clientId ?? client.clientId,
  });
  if (!gate.ok) {
    return gate;
  }
  if (stored.revoked || stored.replacedBy !== null) {
    revokeGrantFamily(stored.familyId);
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Reused refresh token: it was already rotated or revoked, so the whole demo grant was revoked. " +
        "Nothing was issued.",
    );
  }
  if (issuedAt > stored.expiresAt) {
    stored.revoked = true;
    return fail(
      400,
      OAUTH_ERRORS.invalidGrant,
      "Expired refresh token: restart the authorization request. Nothing was issued.",
    );
  }
  if (isOAuthAccountDeactivated(stored.account.accountId)) {
    stored.revoked = true;
    return fail(
      401,
      OAUTH_ERRORS.invalidGrant,
      "Demo account is deactivated: this grant no longer authorizes anything. Nothing was issued.",
    );
  }
  let scopes = stored.scopes;
  if (input.scope !== undefined && input.scope !== null) {
    const parsed = parseOAuthScopes(input.scope, stored.scopes);
    if (!parsed.ok) {
      return fail(400, OAUTH_ERRORS.invalidScope, parsed.error);
    }
    const outside = parsed.scopes.filter((scope) => !stored.scopes.includes(scope));
    if (outside.length > 0) {
      return fail(
        400,
        OAUTH_ERRORS.invalidScope,
        `Scope exceeds the granted scopes: ${outside.join(", ")} was never granted. Nothing was issued.`,
      );
    }
    scopes = parsed.scopes;
  }
  const accessToken = randomToken("demo_at");
  const nextRefresh = randomToken("demo_rt");
  stored.revoked = true;
  stored.replacedBy = nextRefresh;
  accessTokens.set(accessToken, {
    token: accessToken,
    clientId: client.clientId,
    familyId: stored.familyId,
    scopes: [...scopes],
    account: stored.account,
    revoked: false,
    expiresAt: issuedAt + OAUTH_ACCESS_TOKEN_TTL_S,
  });
  refreshTokens.set(nextRefresh, {
    token: nextRefresh,
    clientId: client.clientId,
    familyId: stored.familyId,
    scopes: [...scopes],
    account: stored.account,
    revoked: false,
    replacedBy: null,
    expiresAt: issuedAt + OAUTH_REFRESH_TOKEN_TTL_S,
  });
  return {
    ok: true,
    token: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: OAUTH_ACCESS_TOKEN_TTL_S,
      scope: scopes.join(" "),
      refresh_token: nextRefresh,
    },
  };
}

function revokeGrantFamily(familyId: string): void {
  for (const token of accessTokens.values()) {
    if (token.familyId === familyId) {
      token.revoked = true;
    }
  }
  for (const token of refreshTokens.values()) {
    if (token.familyId === familyId) {
      token.revoked = true;
    }
  }
}

export type OAuthRevokeInput = {
  token?: unknown;
  token_type_hint?: unknown;
};

/**
 * RFC 7009 revocation. Unknown tokens still return success (per spec, so
 * callers cannot probe the store); a known token revokes its whole grant
 * family. Client authentication is intentionally not required beyond the
 * demo TLS boundary documented in the routes, matching the public-client
 * allowance; confidential leakage is bounded because every token is
 * opaque, single-deployment and short-lived.
 */
export function oauthRevokeToken(input: OAuthRevokeInput): { ok: true } {
  const candidate = typeof input.token === "string" ? input.token : null;
  if (candidate) {
    const access = accessTokens.get(candidate);
    if (access) {
      revokeGrantFamily(access.familyId);
      return { ok: true };
    }
    const refresh = refreshTokens.get(candidate);
    if (refresh) {
      revokeGrantFamily(refresh.familyId);
      return { ok: true };
    }
  }
  return { ok: true };
}

export type OAuthBearerValidation =
  | {
      ok: true;
      account: AppAccount;
      scopes: OAuthScope[];
      clientId: string;
      resource: string;
    }
  | { ok: false; statusCode: 401; error: string };

/**
 * Validate a bearer access token for the demo API resource: known,
 * unrevoked, unexpired, client still registered, account not deactivated.
 * Fails closed with a `WWW-Authenticate: Bearer` hint for the routes.
 */
export function validateOAuthBearer(
  header: unknown,
  issuer: string,
  now?: number,
): OAuthBearerValidation {
  const issuedAt = nowSeconds(now);
  if (typeof header !== "string" || header.trim() === "") {
    return {
      ok: false,
      statusCode: 401,
      error:
        "Missing demo bearer token: send Authorization: Bearer <access_token>. Nothing was authorized.",
    };
  }
  const match = header.trim().match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return {
      ok: false,
      statusCode: 401,
      error:
        "Malformed demo Authorization header: expected Bearer <access_token>. Nothing was authorized.",
    };
  }
  const stored = accessTokens.get(match[1] as string);
  if (!stored || stored.revoked) {
    return {
      ok: false,
      statusCode: 401,
      error: "Unknown or revoked demo access token. Nothing was authorized.",
    };
  }
  if (issuedAt > stored.expiresAt) {
    stored.revoked = true;
    return {
      ok: false,
      statusCode: 401,
      error: "Expired demo access token: refresh or restart the authorization request. Nothing was authorized.",
    };
  }
  if (!clients.has(stored.clientId)) {
    return {
      ok: false,
      statusCode: 401,
      error: "Demo client is gone: its registration no longer exists. Nothing was authorized.",
    };
  }
  if (isOAuthAccountDeactivated(stored.account.accountId)) {
    return {
      ok: false,
      statusCode: 401,
      error: "Demo account is deactivated: this token no longer authorizes anything. Nothing was authorized.",
    };
  }
  return {
    ok: true,
    account: accountFromSnapshot(stored.account),
    scopes: [...stored.scopes],
    clientId: stored.clientId,
    resource: oauthResourceForIssuer(issuer),
  };
}

/**
 * OAuth-aware permission check for REST/MCP writes: the bearer account
 * plus its granted scopes gate writes (`write` scope required), reusing
 * the viewer/member/admin semantics already snapshotted from the shared
 * account authority. Read scope suffices for reads.
 */
export function authorizeOAuthBearerWrite(validation: OAuthBearerValidation): {
  ok: true;
  account: AppAccount;
} | { ok: false; statusCode: 401 | 403; error: string } {
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: validation.statusCode,
      error: validation.error,
    };
  }
  if (!validation.scopes.includes("write")) {
    return {
      ok: false,
      statusCode: 403,
      error:
        `Demo-only OAuth permission denied: this token carries scope "${validation.scopes.join(" ") || "none"}" ` +
        "but writes require the write scope. Nothing was written.",
    };
  }
  if (!validation.account.canWrite) {
    return {
      ok: false,
      statusCode: 403,
      error:
        `Demo-only OAuth permission denied: ${validation.account.label} (${validation.account.role}) cannot write. ` +
        "Nothing was written.",
    };
  }
  return { ok: true, account: validation.account };
}

/**
 * OAuth-aware management read for one OAuth client, backed by the
 * registration-access-token credential on the demo management URI.
 */
export function oauthClientManagementBody(
  client: OAuthClient,
  issuer: string,
): {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  scope: string;
  token_endpoint_auth_method: string;
  registration_client_uri: string;
  created_at: number;
  demoOnly: true;
  boundary: string;
} {
  return {
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: [...client.redirectUris],
    scope: client.scopes.join(" "),
    token_endpoint_auth_method: client.confidential ? "client_secret_basic" : "none",
    registration_client_uri: `${issuer}/register/${encodeURIComponent(client.clientId)}`,
    created_at: client.createdAt,
    demoOnly: true,
    boundary: OAUTH_BOUNDARY,
  };
}
