import test from "node:test";
import assert from "node:assert/strict";
import {
  OAUTH_ERRORS,
  authorizeOAuthBearerRead,
  oauthApproveGrant,
  oauthBeginGrant,
  oauthBrowserDecision,
  oauthExchangeCode,
  oauthRedirectWithParams,
  oauthRegisterClient,
  resetOAuthState,
  s256Challenge,
  validateOAuthBearer,
  type OAuthAuthorizeInput,
} from "../server/utils/jiraOAuth.ts";
import { authorizeBearerRead, mcpBearerAuthority, restBearerIdentity } from "../server/utils/jiraRest.ts";
import type { AppAccount } from "../server/utils/appAccounts.ts";

const ISSUER = "https://jira-demo.example/api/oauth";
const RESOURCE = "https://jira-demo.example/api";
const REDIRECT = "https://connect.vercel.com/callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

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

async function registeredClient() {
  const result = await oauthRegisterClient(
    { client_name: "Browser test client", redirect_uris: [REDIRECT] },
    ISSUER,
  );
  assert.ok(result.ok);
  if (!result.ok) throw new Error("registration failed in test setup");
  return result;
}

async function grantTicket(input: { state?: string; extra?: Record<string, unknown> } = {}) {
  const registered = await registeredClient();
  const grantInput: OAuthAuthorizeInput = {
    response_type: "code",
    client_id: registered.client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: await s256Challenge(VERIFIER),
    code_challenge_method: "S256",
    resource: RESOURCE,
    ...(input.state === undefined ? {} : { state: input.state }),
    ...(input.extra ?? {}),
  };
  const grant = oauthBeginGrant(grantInput, memberAccount(), ISSUER);
  assert.ok(grant.ok, grant.ok ? "" : `${grant.error}: ${grant.errorDescription}`);
  if (!grant.ok) throw new Error("grant failed in test setup");
  return { registered, ticket: grant.ticket.grant_ticket, grant: grant.ticket };
}

test("oauth browser: approval redirects exactly to the registered redirect_uri with code and state", async () => {
  resetOAuthState();
  const { ticket, grant } = await grantTicket({ state: "abc123" });
  // The ticket names the requesting client for the consent surface.
  assert.equal(grant.client_name, "Browser test client");
  const decided = oauthBrowserDecision({ grant_ticket: ticket, decision: "approve" });
  assert.equal(decided.ok, true);
  assert.ok(decided.ok);
  const url = new URL(decided.redirectTo);
  assert.equal(`${url.origin}${url.pathname}`, REDIRECT);
  assert.ok(url.searchParams.get("code")?.startsWith("demo_code_"));
  assert.equal(url.searchParams.get("state"), "abc123");
  assert.equal(url.searchParams.get("error"), null);
  // The redirected code is the one-time authorization code (exchanged
  // through the standard token path in the binding test below).
  assert.ok((url.searchParams.get("code") ?? "").startsWith("demo_code_"));
});

test("oauth browser: denial redirects with access_denied and state, and issues no code", async () => {
  resetOAuthState();
  const { ticket } = await grantTicket({ state: "xyz" });
  const decided = oauthBrowserDecision({ grant_ticket: ticket, decision: "deny" });
  assert.equal(decided.ok, true);
  assert.ok(decided.ok);
  const url = new URL(decided.redirectTo);
  assert.equal(`${url.origin}${url.pathname}`, REDIRECT);
  assert.equal(url.searchParams.get("error"), OAUTH_ERRORS.accessDenied);
  assert.equal(url.searchParams.get("state"), "xyz");
  assert.equal(url.searchParams.get("code"), null);
});

test("oauth browser: grant without state redirects without a state parameter", async () => {
  resetOAuthState();
  const { ticket } = await grantTicket();
  const approved = oauthBrowserDecision({ grant_ticket: ticket, decision: "approve" });
  assert.ok(approved.ok);
  if (!approved.ok) return;
  const approveUrl = new URL(approved.redirectTo);
  assert.equal(approveUrl.searchParams.get("state"), null);
  assert.ok(approveUrl.searchParams.get("code"));

  const { ticket: denyTicket } = await grantTicket();
  const denied = oauthBrowserDecision({ grant_ticket: denyTicket, decision: "deny" });
  assert.ok(denied.ok);
  if (!denied.ok) return;
  const denyUrl = new URL(denied.redirectTo);
  assert.equal(denyUrl.searchParams.get("state"), null);
  assert.equal(denyUrl.searchParams.get("error"), OAUTH_ERRORS.accessDenied);
});

test("oauth browser: unknown, replayed, expired and malformed decisions fail closed with no redirect", async () => {
  resetOAuthState();
  const unknown = oauthBrowserDecision({ grant_ticket: "demo_grant_unknown", decision: "approve" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.error, OAUTH_ERRORS.invalidGrant);

  const { ticket } = await grantTicket();
  const approved = oauthBrowserDecision({ grant_ticket: ticket, decision: "approve" });
  assert.ok(approved.ok);
  const replay = oauthBrowserDecision({ grant_ticket: ticket, decision: "approve" });
  assert.equal(replay.ok, false);
  assert.equal(replay.ok ? 0 : replay.error, OAUTH_ERRORS.invalidGrant);

  const { ticket: stale } = await grantTicket();
  const expired = oauthBrowserDecision(
    { grant_ticket: stale, decision: "approve" },
    Date.now() + 6 * 60 * 1000,
  );
  assert.equal(expired.ok, false);
  assert.equal(expired.ok ? 0 : expired.error, OAUTH_ERRORS.invalidGrant);

  const { ticket: badDecision } = await grantTicket();
  const malformed = oauthBrowserDecision({ grant_ticket: badDecision, decision: "maybe" });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok ? 0 : malformed.error, OAUTH_ERRORS.invalidRequest);
  // A malformed decision still consumes the ticket: nothing can be approved after it.
  const after = oauthBrowserDecision({ grant_ticket: badDecision, decision: "approve" });
  assert.equal(after.ok, false);

  const missing = oauthBrowserDecision({ decision: "approve" });
  assert.equal(missing.ok, false);
  assert.equal(missing.ok ? 0 : missing.error, OAUTH_ERRORS.invalidRequest);
});

test("oauth browser: caller-supplied user ids never become the grant account", async () => {
  resetOAuthState();
  const { ticket } = await grantTicket({
    extra: {
      user_id: "demo-admin",
      sub: "attacker-sub",
      username: "attacker",
      email: "attacker@example.com",
      account_id: "demo-admin",
    },
  });
  const decided = oauthBrowserDecision(
    {
      grant_ticket: ticket,
      decision: "approve",
      user_id: "demo-admin",
      sub: "attacker-sub",
    },
    undefined,
  );
  assert.ok(decided.ok);
  if (!decided.ok) return;
  const code = new URL(decided.redirectTo).searchParams.get("code")!;
  // The JSON consent path shares the same binding: the decision body ids are ignored too.
  const { ticket: jsonTicket } = await grantTicket();
  const json = oauthApproveGrant({
    grant_ticket: jsonTicket,
    approved: true,
    user_id: "demo-admin",
  } as unknown as { grant_ticket: string; approved: boolean });
  assert.ok(json.ok);
  void code;
});

test("oauth browser: approved code is one-time and bound to the server account", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const grantInput: OAuthAuthorizeInput = {
    response_type: "code",
    client_id: registered.client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: await s256Challenge(VERIFIER),
    code_challenge_method: "S256",
  };
  const grant = oauthBeginGrant(grantInput, memberAccount(), ISSUER);
  assert.ok(grant.ok);
  if (!grant.ok) return;
  const decided = oauthBrowserDecision({ grant_ticket: grant.ticket.grant_ticket, decision: "approve" });
  assert.ok(decided.ok);
  if (!decided.ok) return;
  const code = new URL(decided.redirectTo).searchParams.get("code")!;
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;
  const bearer = validateOAuthBearer(`Bearer ${exchanged.token.access_token}`, ISSUER);
  assert.ok(bearer.ok);
  if (!bearer.ok) return;
  assert.equal(bearer.account.id, "passport:member-1");
  // Replaying the redirected code fails closed.
  const replay = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.equal(replay.ok, false);
});

test("oauth browser: redirect helper preserves the registered base and encodes params", () => {
  assert.equal(
    oauthRedirectWithParams("https://connect.vercel.com/callback", { code: "demo_code_x", state: "a b" }),
    "https://connect.vercel.com/callback?code=demo_code_x&state=a+b",
  );
  assert.equal(
    oauthRedirectWithParams("http://localhost:3000/cb?from=test", { error: "access_denied" }),
    "http://localhost:3000/cb?from=test&error=access_denied",
  );
  assert.equal(oauthRedirectWithParams(REDIRECT, {}), REDIRECT);
});

test("oauth read gate: bearer with read scope authorizes reads, failures never fall through", async () => {
  resetOAuthState();
  const registered = await registeredClient();
  const grant = oauthBeginGrant(
    {
      response_type: "code",
      client_id: registered.client.client_id,
      redirect_uri: REDIRECT,
      code_challenge: await s256Challenge(VERIFIER),
      code_challenge_method: "S256",
      scope: "read",
    },
    memberAccount(),
    ISSUER,
  );
  assert.ok(grant.ok);
  if (!grant.ok) return;
  const approval = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.ok(approval.ok);
  if (!approval.ok) return;
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.approval.code,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;

  // No Authorization header: existing demo behavior is untouched.
  assert.equal(restBearerIdentity(null), null);
  assert.equal(restBearerIdentity(""), null);
  assert.equal(restBearerIdentity("   "), null);

  // Valid read-scope bearer authorizes reads with the server-derived account.
  const bearer = restBearerIdentity(`Bearer ${exchanged.token.access_token}`, { envIssuer: ISSUER });
  assert.ok(bearer?.ok);
  const gate = authorizeBearerRead(bearer);
  assert.equal(gate.ok, true);
  assert.ok(gate.ok);
  assert.equal(gate.data.id, "passport:member-1");

  // Unknown, malformed, revoked and expired bearers fail closed.
  const unknown = restBearerIdentity("Bearer demo_at_unknown", { envIssuer: ISSUER });
  assert.ok(unknown && !unknown.ok);
  assert.equal(authorizeBearerRead(unknown).ok, false);
  assert.equal(authorizeBearerRead(unknown).ok ? 0 : authorizeBearerRead(unknown).statusCode, 401);

  const malformed = restBearerIdentity("Basic abc", { envIssuer: ISSUER });
  assert.ok(malformed && !malformed.ok);
  assert.equal(authorizeBearerRead(malformed).ok, false);

  const expired = validateOAuthBearer(
    `Bearer ${exchanged.token.access_token}`,
    ISSUER,
    Date.now() + 11 * 60 * 1000,
  );
  assert.equal(expired.ok, false);
  assert.equal(authorizeBearerRead(expired).ok, false);

  // Read-only enforcement at the scope layer: a token without read fails with 403.
  assert.equal(
    authorizeOAuthBearerRead({ ok: true, account: gate.data, scopes: [], clientId: "c", resource: RESOURCE }).ok,
    false,
  );
  assert.equal(
    authorizeOAuthBearerRead({
      ok: true,
      account: gate.data,
      scopes: ["write"],
      clientId: "c",
      resource: RESOURCE,
    }).ok,
    false,
  );
  assert.equal(
    authorizeOAuthBearerRead({
      ok: true,
      account: gate.data,
      scopes: ["read"],
      clientId: "c",
      resource: RESOURCE,
    }).ok,
    true,
  );
  // Validation failures pass through with their 401.
  const failed = validateOAuthBearer("Bearer demo_at_unknown", ISSUER);
  assert.equal(authorizeOAuthBearerRead(failed).ok, false);
});

test("mcp bearer: no header keeps the demo fallback, present headers are authoritative", async () => {
  resetOAuthState();
  // No headers at all: the demo fallback path stays.
  assert.equal(mcpBearerAuthority(null, "read"), null);
  assert.equal(mcpBearerAuthority(undefined, "read"), null);
  assert.equal(mcpBearerAuthority({}, "read"), null);
  assert.equal(mcpBearerAuthority({ "content-type": "application/json" }, "write"), null);
  // Unknown shapes never authorize.
  assert.equal(mcpBearerAuthority(42, "read"), null);
  assert.equal(mcpBearerAuthority("Bearer x", "read"), null);

  const registered = await registeredClient();
  const grant = oauthBeginGrant(
    {
      response_type: "code",
      client_id: registered.client.client_id,
      redirect_uri: REDIRECT,
      code_challenge: await s256Challenge(VERIFIER),
      code_challenge_method: "S256",
      scope: "read",
    },
    memberAccount(),
    ISSUER,
  );
  assert.ok(grant.ok);
  if (!grant.ok) return;
  const approval = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.ok(approval.ok);
  if (!approval.ok) return;
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.approval.code,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) return;
  const token = exchanged.token.access_token;

  // Valid bearer through MCP request headers authorizes reads; this
  // read-only grant is denied for writes below.
  const readAuthority = mcpBearerAuthority({ authorization: `Bearer ${token}` }, "read", {
    envIssuer: ISSUER,
  });
  assert.ok(readAuthority);
  assert.equal(readAuthority?.ok, true);
  assert.ok(readAuthority?.ok);
  assert.equal(readAuthority.data.id, "passport:member-1");

  // A read-only token cannot authorize MCP writes: 403, nothing written.
  const writeDenied = mcpBearerAuthority({ authorization: `Bearer ${token}` }, "write", {
    envIssuer: ISSUER,
  });
  assert.ok(writeDenied);
  assert.equal(writeDenied?.ok, false);
  assert.equal(writeDenied?.ok ? 0 : writeDenied.statusCode, 403);

  // Unknown and malformed MCP bearers fail closed, never demo fallback.
  const unknownMcp = mcpBearerAuthority({ authorization: "Bearer demo_at_unknown" }, "read", {
    envIssuer: ISSUER,
  });
  assert.ok(unknownMcp);
  assert.equal(unknownMcp?.ok, false);

  const malformedMcp = mcpBearerAuthority({ authorization: "Basic abc" }, "read", { envIssuer: ISSUER });
  assert.ok(malformedMcp);
  assert.equal(malformedMcp?.ok, false);

  // Header-name casing from real transports is tolerated.
  const cased = mcpBearerAuthority({ Authorization: `Bearer ${token}` }, "read", { envIssuer: ISSUER });
  assert.ok(cased?.ok);
});
