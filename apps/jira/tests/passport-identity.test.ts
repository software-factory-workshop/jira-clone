import test from "node:test";
import assert from "node:assert/strict";
import {
  PASSPORT_DEPLOYMENT_NOTE,
  PASSPORT_TOKEN_HEADER,
  readPassportIdentity,
} from "../server/utils/passportIdentity.ts";
import {
  PASSPORT_DEFAULT_ROLE,
  PASSPORT_ROLE_MAPPING_LABEL,
  appActorLabel,
  authorizeAppWrite,
  mapPassportRole,
  passportAccountId,
  resolveAppActor,
} from "../server/utils/appAccounts.ts";
import { restMyself, restPermissions, toRestUser } from "../server/utils/jiraRest.ts";
import { getIssues, resetIssues } from "../server/utils/issues.ts";

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

/** Fake signed-looking JWT: header.payload.signature with a JSON payload. */
function fakeJwt(payload: unknown): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `${base64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }))}.${base64Url(body)}.${base64Url("fake-signature")}`;
}

test("passport: header constant and deployment prerequisite are stated", () => {
  assert.equal(PASSPORT_TOKEN_HEADER, "x-vercel-oidc-passport-token");
  assert.match(PASSPORT_DEPLOYMENT_NOTE, /external prerequisite/);
  assert.match(PASSPORT_DEPLOYMENT_NOTE, /never enables Passport/);
  assert.match(PASSPORT_ROLE_MAPPING_LABEL, /JIRA_PASSPORT_ROLE_MAP/);
  assert.match(PASSPORT_ROLE_MAPPING_LABEL, /or viewer \(read-only\) when unset/);
  assert.equal(PASSPORT_DEFAULT_ROLE, "viewer");
});

test("passport: decodes a fake signed-looking JWT payload and requires external_sub", () => {
  const read = readPassportIdentity({
    token: fakeJwt({ external_sub: "user-123", email: "a@example.com", name: "Ada" }),
    nodeEnv: "production",
  });
  assert.equal(read.present, true);
  assert.equal(read.ok, true);
  if (read.present && read.ok) {
    assert.equal(read.identity.externalSub, "user-123");
    assert.equal(read.identity.email, "a@example.com");
    assert.equal(read.identity.displayName, "Ada");
    assert.equal(read.identity.dev, false);
    assert.deepEqual(Object.keys(read.identity.claims).sort(), ["email", "external_sub", "name"]);
  }
  const missing = readPassportIdentity({
    token: fakeJwt({ email: "a@example.com" }),
    nodeEnv: "production",
  });
  assert.equal(missing.present, true);
  assert.equal(missing.ok, false);
  assert.equal(missing.ok ? 0 : missing.statusCode, 401);
  assert.match(missing.ok ? "" : missing.error, /external_sub/);
});

test("passport: malformed tokens fail closed with 401 and no token material", () => {
  for (const token of [
    "not-a-jwt",
    "onlyonepart",
    `${base64Url("{}")}`,
    fakeJwt("just-a-string"),
    fakeJwt([1, 2]),
    `${base64Url("{}")}.${base64Url("not-json{{{")}.${base64Url("sig")}`,
    fakeJwt({ external_sub: "   " }),
    42,
    {},
  ]) {
    const read = readPassportIdentity({ token, nodeEnv: "production" });
    if (token === undefined) continue;
    // Blank-string tokens mean "no header"; everything else present fails closed.
    if (typeof token === "string" && token.trim() === "") continue;
    assert.equal(read.present, true, `present for ${JSON.stringify(token)?.slice(0, 40)}`);
    assert.equal(read.ok, false, `fails closed for ${JSON.stringify(token)?.slice(0, 40)}`);
    assert.equal(read.ok ? 0 : read.statusCode, 401);
    if (!read.ok) {
      assert.doesNotMatch(read.error, /eyJ/);
      assert.doesNotMatch(read.error, /fake-signature/);
    }
  }
  assert.deepEqual(readPassportIdentity({ token: undefined, nodeEnv: "production" }), {
    present: false,
  });
  assert.deepEqual(
    readPassportIdentity({ token: "   ", nodeEnv: "production" }),
    { present: false },
  );
});

test("passport: PASSPORT_DEV_USER works only outside production", () => {
  const dev = readPassportIdentity({
    devUser: JSON.stringify({ external_sub: "dev-1", name: "Dev One" }),
    nodeEnv: "test",
  });
  assert.equal(dev.present, true);
  assert.equal(dev.ok, true);
  if (dev.present && dev.ok) {
    assert.equal(dev.identity.externalSub, "dev-1");
    assert.equal(dev.identity.dev, true);
  }
  const bare = readPassportIdentity({ devUser: "dev-2", nodeEnv: "development" });
  assert.equal(bare.present, true);
  assert.equal(bare.ok, true);
  const ignored = readPassportIdentity({
    devUser: JSON.stringify({ external_sub: "dev-1" }),
    nodeEnv: "production",
  });
  assert.deepEqual(ignored, { present: false });
  const malformed = readPassportIdentity({ devUser: "{nope", nodeEnv: "test" });
  assert.equal(malformed.present, true);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok ? 0 : malformed.statusCode, 401);
  const noSubject = readPassportIdentity({
    devUser: JSON.stringify({ name: "Nobody" }),
    nodeEnv: "test",
  });
  assert.equal(noSubject.ok, false);
});

test("passport: stable account id derives from external_sub, never email", () => {
  assert.equal(passportAccountId("user-123"), "passport:user-123");
  // The id is a pure prefix of whatever subject the platform verified; the
  // resolver only ever passes external_sub (never email) into it.
  assert.equal(passportAccountId("stable-1"), "passport:stable-1");
  const first = resolveAppActor({
    passportToken: fakeJwt({ external_sub: "stable-1", email: "first@example.com" }),
    demoUser: "demo-admin",
    nodeEnv: "production",
  });
  const second = resolveAppActor({
    passportToken: fakeJwt({ external_sub: "stable-1", email: "other@example.com" }),
    demoUser: "demo-viewer",
    nodeEnv: "production",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.account.id, "passport:stable-1");
    assert.equal(second.account.id, "passport:stable-1");
    assert.equal(first.account.identitySource, "passport");
    assert.equal(first.account.externalSub, "stable-1");
    assert.doesNotMatch(first.account.id, /example\.com/);
  }
});

test("passport: explicit role claim wins; groups map; default is viewer", () => {
  assert.deepEqual(mapPassportRole({ role: "ADMIN" }), { ok: true, role: "admin" });
  assert.deepEqual(mapPassportRole({ role: "member" }), { ok: true, role: "member" });
  assert.deepEqual(mapPassportRole({}), { ok: true, role: "viewer" });
  assert.deepEqual(mapPassportRole({ groups: ["jira-admins"] }), { ok: true, role: "admin" });
  assert.deepEqual(mapPassportRole({ groups: "developers" }), { ok: true, role: "member" });
  assert.deepEqual(mapPassportRole({ roles: ["viewers"] }), { ok: true, role: "viewer" });
  // Admin beats member when both appear.
  assert.deepEqual(mapPassportRole({ groups: ["viewers", "jira-admins"] }), {
    ok: true,
    role: "admin",
  });
  const badRole = mapPassportRole({ role: "superuser" });
  assert.equal(badRole.ok, false);
  assert.match(badRole.ok ? "" : badRole.error, /Unrecognised Passport identity/);
  const badGroups = mapPassportRole({ groups: ["mystery-club"] });
  assert.equal(badGroups.ok, false);
  assert.match(badGroups.ok ? "" : badGroups.error, /map to no demo role/);
});

test("resolver: passport takes precedence; invalid passport never falls back", () => {
  resetIssues();
  const before = getIssues();
  const resolved = resolveAppActor({
    passportToken: fakeJwt({ external_sub: "p-1", role: "admin" }),
    demoUser: "demo-viewer",
    nodeEnv: "production",
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.account.identitySource, "passport");
    assert.equal(resolved.account.role, "admin");
    assert.equal(resolved.account.canReset, true);
    assert.equal(resolved.account.explicit, true);
    assert.deepEqual(appActorLabel(resolved.account), {
      id: "passport:p-1",
      label: resolved.account.label,
      role: "admin",
      identitySource: "passport",
    });
  }
  const malformed = resolveAppActor({
    passportToken: "not-a-jwt",
    demoUser: "demo-admin",
    nodeEnv: "production",
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok ? 0 : malformed.statusCode, 401);
  assert.equal(malformed.ok ? "" : malformed.identitySource, "passport");
  const unrecognised = resolveAppActor({
    passportToken: fakeJwt({ external_sub: "p-2", role: "superuser" }),
    demoUser: "demo-admin",
    nodeEnv: "production",
  });
  assert.equal(unrecognised.ok, false);
  assert.equal(unrecognised.ok ? 0 : unrecognised.statusCode, 401);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("resolver: local fallback preserves the synthetic matrix when passport is absent", () => {
  const member = resolveAppActor({ demoUser: "demo-member", nodeEnv: "test" });
  assert.equal(member.ok, true);
  if (member.ok) {
    assert.equal(member.account.identitySource, "demoFallback");
    assert.equal(member.account.id, "demo-member");
    assert.equal(member.account.externalSub, null);
    assert.equal(member.account.dev, false);
  }
  const implicit = resolveAppActor({ demoUser: undefined, nodeEnv: "test" });
  assert.equal(implicit.ok, true);
  if (implicit.ok) {
    assert.equal(implicit.account.id, "demo-member");
    assert.equal(implicit.account.explicit, false);
  }
  const unknown = resolveAppActor({ demoUser: "mallory", nodeEnv: "test" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 401);
  const devFallback = resolveAppActor({
    devUser: JSON.stringify({ external_sub: "local-dev", groups: ["developers"] }),
    nodeEnv: "test",
  });
  assert.equal(devFallback.ok, true);
  if (devFallback.ok) {
    assert.equal(devFallback.account.identitySource, "passport");
    assert.equal(devFallback.account.role, "member");
    assert.equal(devFallback.account.dev, true);
  }
});

test("writes: passport roles keep demo matrix semantics and fail closed", () => {
  resetIssues();
  const before = getIssues();
  for (const action of ["create", "update", "comment", "reset"] as const) {
    const admin = authorizeAppWrite(
      { passportToken: fakeJwt({ external_sub: "a-1", role: "admin" }), nodeEnv: "production" },
      action,
    );
    assert.equal(admin.ok, true, `admin ${action}`);
  }
  const memberReset = authorizeAppWrite(
    { passportToken: fakeJwt({ external_sub: "m-1", role: "member" }), nodeEnv: "production" },
    "reset",
  );
  assert.equal(memberReset.ok, false);
  assert.equal(memberReset.ok ? 0 : memberReset.statusCode, 403);
  const memberCreate = authorizeAppWrite(
    { passportToken: fakeJwt({ external_sub: "m-1", role: "member" }), nodeEnv: "production" },
    "create",
  );
  assert.equal(memberCreate.ok, true);
  for (const action of ["create", "update", "comment", "reset"] as const) {
    const viewer = authorizeAppWrite(
      { passportToken: fakeJwt({ external_sub: "v-1" }), nodeEnv: "production" },
      action,
    );
    assert.equal(viewer.ok, false, `viewer ${action} denied`);
    assert.equal(viewer.ok ? 0 : viewer.statusCode, 403);
    assert.match(viewer.ok ? "" : viewer.error, /changed nothing/);
  }
  const malformed = authorizeAppWrite({ passportToken: "bogus", nodeEnv: "production" }, "create");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok ? 0 : malformed.statusCode, 401);
  // Synthetic fallback semantics are unchanged through the same authority.
  assert.equal(authorizeAppWrite({ demoUser: "demo-viewer", nodeEnv: "test" }, "create").ok, false);
  assert.equal(authorizeAppWrite({ demoUser: "demo-member", nodeEnv: "test" }, "reset").ok, false);
  assert.equal(authorizeAppWrite({ demoUser: "demo-admin", nodeEnv: "test" }, "reset").ok, true);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("myself: distinguishes passport versus demoFallback with read permissions", () => {
  const passport = restMyself(undefined, {
    passportToken: fakeJwt({ external_sub: "me-1", name: "Me One", groups: ["developers"] }),
    nodeEnv: "production",
  });
  assert.equal(passport.ok, true);
  if (passport.ok) {
    assert.equal(passport.data.accountId, "passport:me-1");
    assert.equal(passport.data.displayName, "Me One");
    assert.equal(passport.data.demoRole, "member");
    assert.equal(passport.data.identitySource, "passport");
    assert.equal(passport.data.externalSub, "me-1");
    assert.equal(passport.data.emailAddress, null);
    assert.equal(passport.data.accountType, "atlassian:passport-demo");
    assert.equal(passport.data.demoOnly, true);
    assert.deepEqual(restPermissions({ canWrite: true, canReset: false }), {
      canCreate: true,
      canUpdate: true,
      canComment: true,
      canReset: false,
    });
    assert.ok(!JSON.stringify(passport.data).includes("fake-signature"));
  }
  const fallback = restMyself("demo-viewer");
  assert.equal(fallback.ok, true);
  if (fallback.ok) {
    assert.equal(fallback.data.accountId, "demo-viewer");
    assert.equal(fallback.data.identitySource, "demoFallback");
    assert.equal(fallback.data.externalSub, null);
    assert.equal(fallback.data.demoRole, "viewer");
  }
  const implicit = restMyself(undefined);
  assert.equal(implicit.ok, true);
  if (implicit.ok) {
    assert.equal(implicit.data.accountId, "demo-member");
    assert.equal(implicit.data.identitySource, "demoFallback");
  }
  const bad = restMyself(undefined, { passportToken: "bogus", nodeEnv: "production" });
  assert.equal(bad.ok, false);
  assert.equal(bad.ok ? 0 : bad.statusCode, 401);
  // toRestUser keeps the labelled fallback shape for Jira reads.
  assert.equal(toRestUser({ id: "demo-member", label: "Demo Member", role: "member" }).accountId, "demo-member");
});
