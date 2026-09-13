import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilitiesForAccount,
  capabilitiesForRole,
  canInvokeMutation,
  readOnlyMutationHint,
  type MutationKind,
  type WorkspaceCapabilities,
} from "../app/utils/roleAffordances.ts";

const KINDS: MutationKind[] = ["create", "update", "comment", "reset"];

test("role-to-affordance mapping mirrors the demo role matrix", () => {
  assert.deepEqual(capabilitiesForRole("admin"), {
    canWrite: true,
    canReset: true,
    readOnly: false,
  });
  assert.deepEqual(capabilitiesForRole("member"), {
    canWrite: true,
    canReset: false,
    readOnly: false,
  });
  assert.deepEqual(capabilitiesForRole("viewer"), {
    canWrite: false,
    canReset: false,
    readOnly: true,
  });
  // Unknown roles fail closed to read-only.
  assert.deepEqual(capabilitiesForRole("mallory"), {
    canWrite: false,
    canReset: false,
    readOnly: true,
  });
});

test("loaded /api/me capability drives affordances; missing accounts fail closed", () => {
  const viewer = capabilitiesForAccount({ role: "viewer", canWrite: false, canReset: false });
  assert.equal(viewer.readOnly, true);
  // Explicit capability flags win over the role fallback.
  const explicit = capabilitiesForAccount({ role: "viewer", canWrite: true, canReset: false });
  assert.equal(explicit.canWrite, true);
  assert.equal(explicit.readOnly, false);
  // A missing account never enables mutation affordances.
  for (const account of [null, undefined, {}] as const) {
    const fallback = capabilitiesForAccount(account);
    assert.equal(fallback.canWrite, false);
    assert.equal(fallback.canReset, false);
    assert.equal(fallback.readOnly, true);
  }
});

test("viewer cannot invoke any mutation while admin/member mapping holds", () => {
  const viewer = capabilitiesForRole("viewer");
  for (const kind of KINDS) {
    assert.equal(canInvokeMutation(kind, viewer), false);
  }
  const member: WorkspaceCapabilities = capabilitiesForRole("member");
  assert.equal(canInvokeMutation("create", member), true);
  assert.equal(canInvokeMutation("update", member), true);
  assert.equal(canInvokeMutation("comment", member), true);
  assert.equal(canInvokeMutation("reset", member), false);
  const admin: WorkspaceCapabilities = capabilitiesForRole("admin");
  for (const kind of KINDS) {
    assert.equal(canInvokeMutation(kind, admin), true);
  }
});

test("viewer UI gate never invokes a mutation save", () => {
  // Mirrors the app.vue guard: a read-only workspace returns before any
  // create/update/comment/reset call, so the API sees no viewer mutation.
  const viewer = capabilitiesForRole("viewer");
  let saves = 0;
  for (const kind of KINDS) {
    if (canInvokeMutation(kind, viewer)) {
      saves += 1;
    }
  }
  assert.equal(saves, 0);
  assert.match(readOnlyMutationHint("update"), /read-only/i);
  assert.match(readOnlyMutationHint("reset"), /Demo Admin/);
});
