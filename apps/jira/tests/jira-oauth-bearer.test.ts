import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeBearerWrite,
  authorizeRestWrite,
  restAddComment,
  restBearerIdentity,
  restCreateIssue,
  restTransitionIssue,
  restUpdateIssue,
} from "../server/utils/jiraRest.ts";
import {
  deactivateOAuthAccount,
  oauthApproveGrant,
  oauthBeginGrant,
  oauthExchangeCode,
  oauthRegisterClient,
  oauthRevokeToken,
  resetOAuthState,
  resolveOAuthIssuer,
  s256Challenge,
  validateOAuthBearer,
} from "../server/utils/jiraOAuth.ts";
import type { AppAccount } from "../server/utils/appAccounts.ts";
import { getIssue, resetIssues } from "../server/utils/issues.ts";

const ORIGIN = "https://jira-demo.example";
const ISSUER = `${ORIGIN}/api/oauth`;
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

function account(role: "admin" | "member" | "viewer", sub: string): AppAccount {
  return {
    id: `passport:${sub}`,
    label: `${role} ${sub}`,
    role,
    canWrite: role !== "viewer",
    canReset: role === "admin",
    demoOnly: true,
    identitySource: "passport",
    externalSub: sub,
    email: null,
    displayName: `${role} ${sub}`,
    dev: true,
    explicit: true,
  };
}

async function bearerToken(input: {
  role?: "admin" | "member" | "viewer";
  scope?: string;
  clientScopes?: string;
}): Promise<{ accessToken: string; refreshToken: string; scope: string }> {
  const role = input.role ?? "member";
  const registered = await oauthRegisterClient(
    {
      client_name: "bearer test",
      redirect_uris: ["https://connect.vercel.com/callback"],
      ...(input.clientScopes === undefined ? {} : { scope: input.clientScopes }),
    },
    ISSUER,
  );
  assert.ok(registered.ok);
  if (!registered.ok) throw new Error("registration failed in test setup");
  const grant = oauthBeginGrant(
    {
      response_type: "code",
      client_id: registered.client.client_id,
      redirect_uri: "https://connect.vercel.com/callback",
      code_challenge: await s256Challenge(VERIFIER),
      code_challenge_method: "S256",
      ...(input.scope === undefined ? {} : { scope: input.scope }),
    },
    account(role, `bearer-${role}`),
    ISSUER,
  );
  assert.ok(grant.ok);
  if (!grant.ok) throw new Error(`grant failed in test setup: ${grant.errorDescription}`);
  const approval = oauthApproveGrant({ grant_ticket: grant.ticket.grant_ticket, approved: true });
  assert.ok(approval.ok);
  if (!approval.ok) throw new Error("approval failed in test setup");
  const exchanged = await oauthExchangeCode(
    {
      grant_type: "authorization_code",
      code: approval.approval.code,
      redirect_uri: "https://connect.vercel.com/callback",
      code_verifier: VERIFIER,
    },
    { clientId: registered.client.client_id, secret: registered.clientSecret, method: "client_secret_post" },
    ISSUER,
  );
  assert.ok(exchanged.ok);
  if (!exchanged.ok) throw new Error(`exchange failed in test setup: ${exchanged.errorDescription}`);
  return {
    accessToken: exchanged.token.access_token,
    refreshToken: exchanged.token.refresh_token,
    scope: exchanged.token.scope,
  };
}

function bearerFor(token: string) {
  return restBearerIdentity(`Bearer ${token}`, { envIssuer: ISSUER });
}

function memberIdentity() {
  return { demoUser: "demo-member", nodeEnv: "test" as const };
}

test("oauth bearer: member write-scope tokens perform the bounded REST writes", () => {
  resetOAuthState();
  resetIssues();
  return bearerToken({ role: "member", scope: "read write" }).then((tokens) => {
    assert.equal(tokens.scope, "read write");
    const bearer = bearerFor(tokens.accessToken);
    assert.ok(bearer?.ok);
    const gate = authorizeBearerWrite(bearer);
    assert.equal(gate.ok, true);

    const created = restCreateIssue(
      memberIdentity(),
      { fields: { summary: "OAuth bearer issue", priority: { name: "High" } } },
      { bearer },
    );
    assert.equal(created.ok, true);
    assert.ok(created.ok);
    const key = created.data.issue.key;

    const updated = restUpdateIssue(
      memberIdentity(),
      key,
      { fields: { priority: { name: "Low" } } },
      { bearer },
    );
    assert.equal(updated.ok, true);

    const commented = restAddComment(
      memberIdentity(),
      key,
      { body: "bearer comment" },
      { bearer },
    );
    assert.equal(commented.ok, true);

    const from = getIssue(key)?.status ?? "To Do";
    const transitions = restTransitionIssue(
      memberIdentity(),
      key,
      { transition: undefined, fail: false },
      { bearer },
    );
    // Resolving without a transition id fails closed and writes nothing.
    assert.equal(transitions.ok, false);
    assert.equal(getIssue(key)?.status, from);

    // The write happened under the bearer account, not the demo fallback.
    assert.equal(created.data.actor.id, "passport:bearer-member");
    assert.equal(created.data.identitySource, "passport");
    resetIssues();
  });
});

test("oauth bearer: viewer tokens read but cannot write, and member read-only tokens cannot write", async () => {
  resetOAuthState();
  resetIssues();
  const viewer = await bearerToken({ role: "viewer", scope: "read" });
  const viewerBearer = bearerFor(viewer.accessToken);
  assert.ok(viewerBearer?.ok);
  const viewerGate = authorizeBearerWrite(viewerBearer);
  assert.equal(viewerGate.ok, false);
  assert.equal(viewerGate.ok ? 0 : viewerGate.statusCode, 403);

  const viewerWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "viewer must not write" } },
    { bearer: viewerBearer },
  );
  assert.equal(viewerWrite.ok, false);
  assert.equal(viewerWrite.ok ? 0 : viewerWrite.statusCode, 403);

  const readOnlyMember = await bearerToken({ role: "member", scope: "read" });
  const readOnlyBearer = bearerFor(readOnlyMember.accessToken);
  const readOnlyWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "read scope must not write" } },
    { bearer: readOnlyBearer },
  );
  assert.equal(readOnlyWrite.ok, false);
  assert.equal(readOnlyWrite.ok ? 0 : readOnlyWrite.statusCode, 403);
  resetIssues();
});

test("oauth bearer: invalid, revoked and deactivated tokens fail closed without demo fallback", async () => {
  resetOAuthState();
  resetIssues();
  // No Authorization header: existing demo behavior is untouched.
  assert.equal(restBearerIdentity(null), null);
  assert.equal(restBearerIdentity(""), null);
  const untouched = restCreateIssue(memberIdentity(), {
    fields: { summary: "demo fallback still works without bearer" },
  });
  assert.equal(untouched.ok, true);
  assert.ok(untouched.ok);
  const fallbackKey = untouched.data.issue.key;

  // Unknown bearer: validation fails and the write gate fails closed.
  const unknown = bearerFor("demo_at_unknown");
  assert.ok(unknown && !unknown.ok);
  const unknownWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "unknown bearer must not fall back" } },
    { bearer: unknown },
  );
  assert.equal(unknownWrite.ok, false);
  assert.equal(unknownWrite.ok ? 0 : unknownWrite.statusCode, 401);

  // Malformed header never falls through either.
  const malformed = restBearerIdentity("Basic abc", { envIssuer: ISSUER });
  assert.ok(malformed && !malformed.ok);
  const malformedWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "malformed bearer must not fall back" } },
    { bearer: malformed },
  );
  assert.equal(malformedWrite.ok, false);

  // Revoked bearer denies.
  const tokens = await bearerToken({ role: "member", scope: "read write" });
  oauthRevokeToken({ token: tokens.accessToken });
  const revoked = bearerFor(tokens.accessToken);
  assert.ok(revoked && !revoked.ok);
  const revokedWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "revoked bearer must not write" } },
    { bearer: revoked },
  );
  assert.equal(revokedWrite.ok, false);

  // Deactivated account denies an already-issued token.
  const live = await bearerToken({ role: "member", scope: "read write" });
  deactivateOAuthAccount("passport:bearer-member");
  const dead = bearerFor(live.accessToken);
  assert.ok(dead && !dead.ok);
  const deadWrite = restCreateIssue(
    memberIdentity(),
    { fields: { summary: "deactivated bearer must not write" } },
    { bearer: dead },
  );
  assert.equal(deadWrite.ok, false);

  // authorizeRestWrite with no bearer keeps the demo path (null passes through).
  const demoGate = authorizeRestWrite(memberIdentity(), "create", null);
  assert.equal(demoGate.ok, true);
  void fallbackKey;
  resetIssues();
});

test("oauth bearer: issuer agreement between discovery and validation", () => {
  resetOAuthState();
  assert.equal(resolveOAuthIssuer({ envIssuer: ISSUER }), ISSUER);
  const missing = validateOAuthBearer("Bearer demo_at_unknown", ISSUER);
  assert.equal(missing.ok, false);
  assert.equal(missing.ok ? 0 : missing.statusCode, 401);
});
