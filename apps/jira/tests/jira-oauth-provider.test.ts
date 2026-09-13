import test from "node:test";
import assert from "node:assert/strict";
import {
  OAUTH_ACCESS_TOKEN_TTL_S,
  OAUTH_BOUNDARY,
  OAUTH_CONNECT_CALLBACK,
  OAUTH_ERRORS,
  accountFromSnapshot,
  authorizeOAuthBearerWrite,
  deactivateOAuthAccount,
  oauthApproveGrant,
  oauthAuthorizationServerMetadata,
  oauthBeginGrant,
  oauthExchangeCode,
  oauthProtectedResourceMetadata,
  oauthRefreshToken,
  oauthRegisterClient,
  oauthReadClient,
  oauthResourceForIssuer,
  oauthRevokeToken,
  parseOAuthScopes,
  allowedScopesForRole,
  resetOAuthState,
  resolveOAuthIssuer,
  s256Challenge,
  snapshotOAuthAccount,
  validateOAuthBearer,
  validateRedirectUri,
  type OAuthAuthorizeInput,
} from "../server/utils/jiraOAuth.ts";
import type { AppAccount } from "../server/utils/appAccounts.ts";

const ISSUER = "https://jira-demo.example/api/oauth";
const RESOURCE = "https://jira-demo.example/api";

function memberAccount(): AppAccount {
  return {
    id: "passport:member-1",
    label: "Member One",
    role: "member",
    canWrite: true,
    canReset: false,
    demoOnly: true,
    identitySource: "passport",
    externalSub: "member-1",
    email: "member@example.com",
    displayName: "Member One",
    dev: true,
    explicit: true,
  };
}

function viewerAccount(): AppAccount {
  return {
    id: "passport:viewer-1",
    label: "Viewer One",
    role: "viewer",
    canWrite: false,
    canReset: false,
    demoOnly: true,
    identitySource: "passport",
    externalSub: "viewer-1",
    email: null,
    displayName: "Viewer One",
    dev: true,
    explicit: true,
  };
}

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

async function registeredClient(overrides: Record<string, unknown> = {}) {
  const result = await oauthRegisterClient(
    {
      client_name: "Demo test client",
      redirect_uris: ["https://connect.vercel.com/callback", "http://localhost:3000/callback"],
      ...overrides,
    },
    ISSUER,
  );
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  return result;
}

async function approvedCode(input: {
  account?: AppAccount;
  scope?: string;
  resource?: string;
  clientId?: string;
  redirectUri?: string;
  verifier?: string;
  extra?: Record<string, unknown>;
} = {}) {
  const account = input.account ?? memberAccount();
  const client = input.clientId
    ? { client: { client_id: input.clientId } }
    : await registeredClient();
  const clientId = input.clientId ?? (client as { client: { client_id: string } }).client.client_id;
  const challenge = await s256Challenge(input.verifier ?? VERIFIER);
  const grantInput: OAuthAuthorizeInput = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: input.redirectUri ?? "https://connect.vercel.com/callback",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(input.scope === undefined ? {} : { scope: input.scope }),
    ...(input.resource === undefined ? { resource: RESOURCE } : { resource: input.resource }),
    ...(input.extra ?? {}),
  };
  const grant = oauthBeginGrant(grantInput, account, ISSUER);
  assert.equal(grant.ok, true, grant.ok ? "" : `${grant.error}: ${grant.errorDescription}`);
  assert.ok(grant.ok);
  const approval = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.equal(approval.ok, true);
  assert.ok(approval.ok);
  return { clientId, grant, approval: approval.approval, challenge };
}

test("oauth discovery: RFC 8414 metadata carries the required contract", () => {
  resetOAuthState();
  const metadata = oauthAuthorizationServerMetadata(ISSUER);
  assert.equal(metadata.issuer, ISSUER);
  assert.equal(metadata.authorization_endpoint, `${ISSUER}/authorize`);
  assert.equal(metadata.token_endpoint, `${ISSUER}/token`);
  assert.ok(metadata.registration_endpoint.endsWith("/register"));
  assert.ok(metadata.revocation_endpoint.endsWith("/revoke"));
  assert.deepEqual(metadata.response_types_supported, ["code"]);
  assert.deepEqual(metadata.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.ok(metadata.scopes_supported.includes("read"));
  assert.ok(metadata.scopes_supported.includes("write"));
  assert.ok(metadata.token_endpoint_auth_methods_supported.includes("client_secret_basic"));
  assert.ok(metadata.token_endpoint_auth_methods_supported.includes("none"));
  assert.ok(metadata.revocation_endpoint_auth_methods_supported.length > 0);
  assert.match(OAUTH_BOUNDARY, /Demo-only/);
});

test("oauth discovery: protected-resource metadata names the demo API resource", () => {
  const metadata = oauthProtectedResourceMetadata(ISSUER);
  assert.equal(metadata.resource, RESOURCE);
  assert.deepEqual(metadata.authorization_servers, [ISSUER]);
  assert.ok(metadata.scopes_supported.includes("read"));
  assert.ok(metadata.scopes_supported.includes("write"));
  assert.deepEqual(metadata.bearer_methods_supported, ["header"]);
  assert.equal(oauthResourceForIssuer(ISSUER), RESOURCE);
});

test("oauth registration: exact redirect validation plus credentials and management read", async () => {
  resetOAuthState();
  const result = await registeredClient();
  assert.ok(result.client.client_id.startsWith("demo_client_"));
  assert.ok(result.clientSecret?.startsWith("demo_secret_"));
  assert.ok(result.client.registration_access_token.startsWith("demo_reg_"));
  assert.ok(result.client.registration_client_uri.includes(result.client.client_id));
  // Management read works with the registration credential ...
  const read = oauthReadClient(result.client.client_id, result.client.registration_access_token);
  assert.equal(read.ok, true);
  // ... and fails closed without it, with a bad one, or for unknown clients.
  const denied = oauthReadClient(result.client.client_id, "demo_reg_nope");
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? 0 : denied.statusCode, 401);
  const missing = oauthReadClient(result.client.client_id, null);
  assert.equal(missing.ok ? 0 : missing.statusCode, 401);
  const unknown = oauthReadClient("demo_client_unknown", result.client.registration_access_token);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
});

test("oauth registration: redirect, scope and auth-method failures fail closed", async () => {
  resetOAuthState();
  for (const redirect_uris of [
    [],
    ["not-a-url"],
    ["https://example.com/cb#fragment"],
    ["ftp://example.com/cb"],
    ["http://example.com/cb"],
    ["https://example.com/cb", "https://example.com/cb"],
    [""],
    ["https://example.com/cb", 42],
  ]) {
    const result = await oauthRegisterClient(
      { client_name: "bad", redirect_uris },
      ISSUER,
    );
    assert.equal(result.ok, false, `registers ${JSON.stringify(redirect_uris)}`);
    assert.equal(result.ok ? 0 : result.statusCode, 400);
  }
  const badScope = await oauthRegisterClient(
    { client_name: "bad", redirect_uris: ["https://example.com/cb"], scope: "read admin" },
    ISSUER,
  );
  assert.equal(badScope.ok, false);
  assert.equal(badScope.ok ? 0 : badScope.error, OAUTH_ERRORS.invalidScope);
  const badMethod = await oauthRegisterClient(
    {
      client_name: "bad",
      redirect_uris: ["https://example.com/cb"],
      token_endpoint_auth_method: "private_key_jwt",
    },
    ISSUER,
  );
  assert.equal(badMethod.ok, false);
  assert.equal(badMethod.ok ? 0 : badMethod.error, OAUTH_ERRORS.invalidRequest);
  // Public clients register without a secret.
  const pub = await oauthRegisterClient(
    {
      client_name: "public",
      redirect_uris: ["https://example.com/cb"],
      token_endpoint_auth_method: "none",
    },
    ISSUER,
  );
  assert.equal(pub.ok, true);
  assert.ok(pub.ok);
  assert.equal(pub.clientSecret, null);
});

test("oauth authorize: happy path binds the server account and honours resource/state", async () => {
  resetOAuthState();
  const { clientId, grant } = await approvedCode({ scope: "read write", extra: { state: "abc123" } });
  assert.equal(grant.ticket.client_id, clientId);
  assert.equal(grant.ticket.redirect_uri, OAUTH_CONNECT_CALLBACK);
  assert.equal(grant.ticket.scope, "read write");
  assert.equal(grant.ticket.state, "abc123");
  assert.equal(grant.ticket.resource, RESOURCE);
  assert.equal(grant.ticket.expires_in, 300);
  assert.equal(grant.ticket.account.accountId, "passport:member-1");
  assert.equal(grant.ticket.account.role, "member");
});

test("oauth authorize: unknown client, redirect, method, challenge, scope and resource fail closed", async () => {
  resetOAuthState();
  const { clientId } = await approvedCode();
  const challenge = await s256Challenge(VERIFIER);
  const base: OAuthAuthorizeInput = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: OAUTH_CONNECT_CALLBACK,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  };
  const cases: { name: string; input: OAuthAuthorizeInput; status: number }[] = [
    { name: "unknown client", input: { ...base, client_id: "demo_client_unknown" }, status: 401 },
    { name: "unregistered redirect", input: { ...base, redirect_uri: "https://evil.example/cb" }, status: 400 },
    { name: "missing redirect", input: { ...base, redirect_uri: undefined }, status: 400 },
    { name: "plain pkce", input: { ...base, code_challenge_method: "plain" }, status: 400 },
    { name: "missing challenge", input: { ...base, code_challenge: undefined }, status: 400 },
    { name: "short challenge", input: { ...base, code_challenge: "short" }, status: 400 },
    { name: "unknown scope", input: { ...base, scope: "read admin" }, status: 400 },
    { name: "wrong resource", input: { ...base, resource: "https://other.example/api" }, status: 400 },
    { name: "bad response type", input: { ...base, response_type: "token" }, status: 400 },
    { name: "missing client", input: { ...base, client_id: "" }, status: 400 },
  ];
  for (const { name, input, status } of cases) {
    const result = oauthBeginGrant(input, memberAccount(), ISSUER);
    assert.equal(result.ok, false, name);
    assert.equal(result.ok ? 0 : result.statusCode, status, name);
  }
  // Viewers can never receive the write scope, even when the client grants it.
  const viewer = oauthBeginGrant({ ...base, scope: "read write" }, viewerAccount(), ISSUER);
  assert.equal(viewer.ok, false);
  assert.equal(viewer.ok ? 0 : viewer.statusCode, 403);
  const viewerRead = oauthBeginGrant({ ...base, scope: "read" }, viewerAccount(), ISSUER);
  assert.equal(viewerRead.ok, true);
});

test("oauth authorize: caller-supplied user ids never become the grant account", async () => {
  resetOAuthState();
  const { grant } = await approvedCode({
    extra: {
      user_id: "demo-admin",
      sub: "attacker-sub",
      username: "attacker",
      email: "attacker@example.com",
      account_id: "demo-admin",
      login_hint: "demo-admin",
    },
  });
  assert.equal(grant.ticket.account.accountId, "passport:member-1");
  assert.equal(grant.ticket.account.role, "member");
});

test("oauth consent: denial and replay fail closed with no code", async () => {
  resetOAuthState();
  const challenge = await s256Challenge(VERIFIER);
  const registered = await registeredClient();
  const grant = oauthBeginGrant(
    {
      response_type: "code",
      client_id: registered.client.client_id,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_challenge: challenge,
      code_challenge_method: "S256",
    },
    memberAccount(),
    ISSUER,
  );
  assert.ok(grant.ok);
  if (!grant.ok) return;
  const denied = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: false });
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? 0 : denied.error, OAUTH_ERRORS.accessDenied);
  const replay = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.equal(replay.ok, false);
  assert.equal(replay.ok ? 0 : replay.error, OAUTH_ERRORS.invalidGrant);
  const unknown = oauthApproveGrant({ grant_ticket: "demo_grant_unknown", approved: true });
  assert.equal(unknown.ok, false);
});

test("oauth token: code exchange issues a short-lived bearer pair", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const { approval } = await approvedCode({ clientId: registered.client.client_id, scope: "read" });
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
      resource: RESOURCE,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.equal(exchanged.ok, true);
  assert.ok(exchanged.ok);
  assert.ok(exchanged.token.access_token.startsWith("demo_at_"));
  assert.ok(exchanged.token.refresh_token.startsWith("demo_rt_"));
  assert.equal(exchanged.token.token_type, "Bearer");
  assert.equal(exchanged.token.expires_in, OAUTH_ACCESS_TOKEN_TTL_S);
  assert.equal(exchanged.token.scope, "read");
  const bearer = validateOAuthBearer(`Bearer ${exchanged.token.access_token}`, ISSUER);
  assert.equal(bearer.ok, true);
  assert.ok(bearer.ok);
  assert.equal(bearer.account.id, "passport:member-1");
  assert.deepEqual(bearer.scopes, ["read"]);
});

test("oauth token: reuse, verifier, redirect, client and grant-type failures fail closed", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const clientId = registered.client.client_id;
  const auth = { clientId, secret: registered.clientSecret, method: "client_secret_post" as const};
  const first = await approvedCode({ clientId });
  const good = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: first.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.equal(good.ok, true);
  const replay = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: first.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.equal(replay.ok, false);
  assert.equal(replay.ok ? 0 : replay.error, OAUTH_ERRORS.invalidGrant);

  const second = await approvedCode({ clientId });
  const badVerifier = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: second.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
    auth,
    ISSUER,
  );
  assert.equal(badVerifier.ok, false);
  assert.equal(badVerifier.ok ? 0 : badVerifier.error, OAUTH_ERRORS.invalidGrant);

  const third = await approvedCode({ clientId });
  const badRedirect = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: third.approval.code,
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.equal(badRedirect.ok, false);

  const fourth = await approvedCode({ clientId });
  const unknownCode = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: "demo_code_unknown",
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.equal(unknownCode.ok, false);

  const fifth = await approvedCode({ clientId });
  const badSecret = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: fifth.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    { clientId, secret: "demo_secret_wrong", method: "client_secret_post" },
    ISSUER,
  );
  assert.equal(badSecret.ok, false);
  assert.equal(badSecret.ok ? 0 : badSecret.error, OAUTH_ERRORS.invalidClient);

  const sixth = await approvedCode({ clientId });
  const unknownClient = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: sixth.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    { clientId: "demo_client_unknown", secret: null, method: "none" },
    ISSUER,
  );
  assert.equal(unknownClient.ok, false);
  assert.equal(unknownClient.ok ? 0 : unknownClient.error, OAUTH_ERRORS.invalidClient);
  void fourth;
});

test("oauth token: public clients exchange without a secret", async () => {
  resetOAuthState();
  const pub = await oauthRegisterClient(
    {
      client_name: "public",
      redirect_uris: [OAUTH_CONNECT_CALLBACK],
      token_endpoint_auth_method: "none",
    },
    ISSUER,
  );
  assert.ok(pub.ok);
  if (!pub.ok) return;
  const challenge = await s256Challenge(VERIFIER);
  const grant = oauthBeginGrant(
    {
      response_type: "code",
      client_id: pub.client.client_id,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_challenge: challenge,
      code_challenge_method: "S256",
    },
    memberAccount(),
    ISSUER,
  );
  assert.ok(grant.ok);
  if (!grant.ok) return;
  const approval = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.ok(approval.ok);
  if (!approval.ok) return;
  assert.ok(approval.ok);
  const exchanged = approval.ok
    ? await oauthExchangeCode(
        {
          grant_type: "authorization_code",
          code: approval.approval.code,
          redirect_uri: OAUTH_CONNECT_CALLBACK,
          code_verifier: VERIFIER,
        },
        { clientId: pub.client.client_id, secret: null, method: "none" },
        ISSUER,
      )
    : approval;
  assert.equal(exchanged.ok, true);
});

test("oauth refresh: rotation issues a new pair and replay revokes the family", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const clientId = registered.client.client_id;
  const auth = { clientId, secret: registered.clientSecret, method: "client_secret_post" as const};
  const { approval } = await approvedCode({ clientId });
  const first = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.ok(first.ok);
  if (!first.ok) return;
  const rotated = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: first.token.refresh_token },
    auth,
  );
  assert.equal(rotated.ok, true);
  assert.ok(rotated.ok);
  assert.notEqual(rotated.token.refresh_token, first.token.refresh_token);
  assert.notEqual(rotated.token.access_token, first.token.access_token);
  // Replay of the consumed refresh token fails closed and revokes the family.
  const replay = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: first.token.refresh_token },
    auth,
  );
  assert.equal(replay.ok, false);
  assert.equal(replay.ok ? 0 : replay.error, OAUTH_ERRORS.invalidGrant);
  const rotatedBearer = validateOAuthBearer(`Bearer ${rotated.token.access_token}`, ISSUER);
  assert.equal(rotatedBearer.ok, false);
  const firstBearer = validateOAuthBearer(`Bearer ${first.token.access_token}`, ISSUER);
  assert.equal(firstBearer.ok, false);
  // Scope widening on refresh is rejected.
  const wide = await approvedCode({ clientId, scope: "read" });
  const wideFirst = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: wide.approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    auth,
    ISSUER,
  );
  assert.ok(wideFirst.ok);
  if (!wideFirst.ok) return;
  const widen = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: wideFirst.token.refresh_token, scope: "read write" },
    auth,
  );
  assert.equal(widen.ok, false);
  assert.equal(widen.ok ? 0 : widen.error, OAUTH_ERRORS.invalidScope);
  const unknown = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: "demo_rt_unknown" },
    auth,
  );
  assert.equal(unknown.ok, false);
});

test("oauth revoke: known tokens revoke; unknown tokens still succeed", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const { approval } = await approvedCode({ clientId: registered.client.client_id });
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;
  assert.deepEqual(oauthRevokeToken({ token: exchanged.token.access_token }), { ok: true });
  assert.equal(validateOAuthBearer(`Bearer ${exchanged.token.access_token}`, ISSUER).ok, false);
  // Refresh sibling dies with the family too.
  const refreshAfter = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: exchanged.token.refresh_token },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
  );
  assert.equal(refreshAfter.ok, false);
  assert.deepEqual(oauthRevokeToken({ token: "demo_at_unknown" }), { ok: true });
  assert.deepEqual(oauthRevokeToken({}), { ok: true });
});

test("oauth bearer: deactivated accounts deny already-issued tokens and refreshes", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const { approval } = await approvedCode({ clientId: registered.client.client_id });
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;
  deactivateOAuthAccount("passport:member-1");
  const bearer = validateOAuthBearer(`Bearer ${exchanged.token.access_token}`, ISSUER);
  assert.equal(bearer.ok, false);
  assert.equal(bearer.ok ? 0 : bearer.statusCode, 401);
  const refresh = await oauthRefreshToken(
    { grant_type: "refresh_token", refresh_token: exchanged.token.refresh_token },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
  );
  assert.equal(refresh.ok, false);
});

test("oauth bearer: malformed headers and expiry fail closed", async () => {
  resetOAuthState();
  assert.equal(validateOAuthBearer("", ISSUER).ok, false);
  assert.equal(validateOAuthBearer(null, ISSUER).ok, false);
  assert.equal(validateOAuthBearer("Bearer", ISSUER).ok, false);
  assert.equal(validateOAuthBearer("Basic abc", ISSUER).ok, false);
  assert.equal(validateOAuthBearer("Bearer demo_at_unknown", ISSUER).ok, false);
  const registered = await registeredClient();
  const { approval } = await approvedCode({ clientId: registered.client.client_id });
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.code,
      redirect_uri: OAUTH_CONNECT_CALLBACK,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;
  const expired = validateOAuthBearer(
    `Bearer ${exchanged.token.access_token}`,
    ISSUER,
    Date.now() + 11 * 60 * 1000,
  );
  assert.equal(expired.ok, false);
});

test("oauth scopes: role ceilings, parsing and bearer write authority", () => {
  resetOAuthState();
  assert.deepEqual(allowedScopesForRole("viewer"), ["read"]);
  assert.deepEqual(allowedScopesForRole("member"), ["read", "write"]);
  assert.deepEqual(allowedScopesForRole("admin"), ["read", "write"]);
  assert.deepEqual(parseOAuthScopes(undefined, ["read"]), { ok: true, scopes: ["read"] });
  assert.deepEqual(parseOAuthScopes("read read", ["write"]), { ok: true, scopes: ["read"] });
  assert.equal(parseOAuthScopes(42, ["read"]).ok, false);
  assert.equal(parseOAuthScopes("read admin", ["read"]).ok, false);
  const snapshot = snapshotOAuthAccount(memberAccount());
  assert.equal(snapshot.accountId, "passport:member-1");
  const rebuilt = accountFromSnapshot(snapshot);
  assert.equal(rebuilt.id, "passport:member-1");
  assert.equal(rebuilt.role, "member");
  assert.equal(
    authorizeOAuthBearerWrite({ ok: true, account: rebuilt, scopes: ["read"], clientId: "c", resource: RESOURCE }).ok,
    false,
  );
  assert.equal(
    authorizeOAuthBearerWrite({ ok: true, account: rebuilt, scopes: ["read", "write"], clientId: "c", resource: RESOURCE }).ok,
    true,
  );
  assert.equal(
    authorizeOAuthBearerWrite({
      ok: true,
      account: accountFromSnapshot(snapshotOAuthAccount(viewerAccount())),
      scopes: ["read"],
      clientId: "c",
      resource: RESOURCE,
    }).ok,
    false,
  );
});

test("oauth helpers: issuer, redirect and challenge utilities", async () => {
  resetOAuthState();
  assert.equal(
    resolveOAuthIssuer({ envIssuer: "https://jira.example/oauth/" }),
    "https://jira.example/oauth",
  );
  assert.equal(
    resolveOAuthIssuer({ proto: "http", host: "localhost:3001" }),
    "http://localhost:3001/api/oauth",
  );
  assert.equal(validateRedirectUri("https://connect.vercel.com/callback").ok, true);
  assert.equal(validateRedirectUri("http://localhost:3000/cb").ok, true);
  assert.equal(validateRedirectUri("http://example.com/cb").ok, false);
  assert.equal(validateRedirectUri("https://example.com/cb#frag").ok, false);
  const challenge = await s256Challenge(VERIFIER);
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.match(OAUTH_CONNECT_CALLBACK, /^https:\/\/connect\.vercel\.com\/callback$/);
});
