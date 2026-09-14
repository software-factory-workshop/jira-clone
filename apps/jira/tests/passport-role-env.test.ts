import test from "node:test";
import assert from "node:assert/strict";
import { mapPassportRole, passportRoleOptionsFromEnv } from "../server/utils/appAccounts.ts";

test("passport role: email map and default role apply only when no role/groups claims exist", () => {
  const options = passportRoleOptionsFromEnv({
    JIRA_PASSPORT_ROLE_MAP: '{"Persona-Admin@workshop.invalid":"admin","persona-viewer@workshop.invalid":"viewer","bogus@x":"root"}',
    JIRA_PASSPORT_DEFAULT_ROLE: "member",
  });
  assert.deepEqual(options, { emailRoles: { "persona-admin@workshop.invalid": "admin", "persona-viewer@workshop.invalid": "viewer" }, defaultRole: "member" });
  const base = { external_sub: "u1", name: "P" };
  assert.deepEqual(mapPassportRole({ ...base, email: "persona-admin@workshop.invalid" }, options), { ok: true, role: "admin" });
  assert.deepEqual(mapPassportRole({ ...base, email: "PERSONA-VIEWER@workshop.invalid" }, options), { ok: true, role: "viewer" });
  assert.deepEqual(mapPassportRole({ ...base, email: "someone@else" }, options), { ok: true, role: "member" });
  // Claims still win over the deployment map.
  assert.deepEqual(mapPassportRole({ ...base, email: "persona-admin@workshop.invalid", role: "viewer" }, options), { ok: true, role: "viewer" });
  assert.deepEqual(mapPassportRole({ ...base, email: "someone@else", groups: ["jira-admin"] }, options), { ok: true, role: "admin" });
  // Unrecognised groups still fail closed regardless of the default.
  assert.equal(mapPassportRole({ ...base, groups: ["workshop"] }, options).ok, false);
});

test("passport role: without env the documented viewer default holds; bad env values are ignored", () => {
  assert.deepEqual(passportRoleOptionsFromEnv({}), {});
  assert.deepEqual(passportRoleOptionsFromEnv({ JIRA_PASSPORT_DEFAULT_ROLE: "root", JIRA_PASSPORT_ROLE_MAP: "not json" }), {});
  assert.deepEqual(passportRoleOptionsFromEnv({ JIRA_PASSPORT_ROLE_MAP: "a@b=member, c@d=admin" }), { emailRoles: { "a@b": "member", "c@d": "admin" } });
  assert.deepEqual(mapPassportRole({ external_sub: "u1", email: "a@b" }), { ok: true, role: "viewer" });
});
