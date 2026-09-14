import test from "node:test";
import assert from "node:assert/strict";
import {
  diffRows,
  hydrateOAuthStore,
  persistOAuthStore,
  rowsToSnapshot,
  setOAuthStoreForTests,
  snapshotRows,
  type OAuthRow,
  type OAuthStore,
} from "../server/utils/oauthPersistence.ts";
import {
  exportOAuthState,
  oauthRegisterClient,
  resetOAuthState,
  resolveOAuthIssuer,
  validateOAuthBearer,
} from "../server/utils/jiraOAuth.ts";

const ISSUER = resolveOAuthIssuer({ envIssuer: "https://jira.test/api/oauth" });

function memoryStore() {
  const rows = new Map<string, OAuthRow>();
  const store: OAuthStore & { rows: Map<string, OAuthRow>; writes: number } = {
    rows,
    writes: 0,
    async load() {
      return [...rows.values()].map((row) => structuredClone(row));
    },
    async upsert(next) {
      store.writes += next.length;
      for (const row of next) rows.set(`${row.kind}::${row.id}`, structuredClone(row));
    },
    async remove(keys) {
      for (const key of keys) rows.delete(`${key.kind}::${key.id}`);
    },
  };
  return store;
}

test("oauth persistence: snapshot rows round-trip and diff only what changed", () => {
  const before = snapshotRows(rowsToSnapshot([
    { kind: "clients", id: "c1", value: { clientId: "c1", clientName: "one" } },
    { kind: "accessTokens", id: "t1", value: { token: "t1", revoked: false } },
    { kind: "grantTickets", id: "g1", value: { ticket: "g1" } },
    { kind: "bogus", id: "x", value: {} },
  ]));
  assert.equal(before.size, 3);
  const after = new Map(before);
  after.set("accessTokens::t1", { kind: "accessTokens", id: "t1", value: { token: "t1", revoked: true } });
  after.delete("grantTickets::g1");
  after.set("deactivatedAccounts::a1", { kind: "deactivatedAccounts", id: "a1", value: "a1" });
  const { upserts, deletes } = diffRows(before, after);
  assert.deepEqual(upserts.map((row) => row.id).sort(), ["a1", "t1"]);
  assert.deepEqual(deletes, [{ kind: "grantTickets", id: "g1" }]);
});

test("oauth persistence: a registered client survives a fresh process via hydration", async () => {
  const store = memoryStore();
  setOAuthStoreForTests(store);
  try {
    resetOAuthState();
    await hydrateOAuthStore();
    const registered = await oauthRegisterClient(
      { client_name: "connect", redirect_uris: ["https://connect.vercel.com/callback"], token_endpoint_auth_method: "none" },
      ISSUER,
    );
    assert.ok(registered.ok);
    if (!registered.ok) return;
    await persistOAuthStore();
    assert.equal(store.writes, 1);
    // Nothing changed: no extra writes.
    await persistOAuthStore();
    assert.equal(store.writes, 1);

    // Simulate a cold start: memory is empty, the durable copy is not.
    resetOAuthState();
    assert.equal(exportOAuthState().clients.length, 0);
    await hydrateOAuthStore();
    assert.equal(exportOAuthState().clients[0]?.clientId, registered.client.client_id);
    // Bearer validation reads the hydrated store and still fails closed on unknown tokens.
    assert.equal(validateOAuthBearer("Bearer nope", ISSUER).ok, false);
  } finally {
    setOAuthStoreForTests(undefined);
    resetOAuthState();
  }
});

test("oauth persistence: without a database the store stays in memory and hydrate is a no-op", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    resetOAuthState();
    const registered = await oauthRegisterClient(
      { client_name: "local", redirect_uris: ["https://connect.vercel.com/callback"], token_endpoint_auth_method: "none" },
      ISSUER,
    );
    assert.ok(registered.ok);
    await hydrateOAuthStore();
    assert.equal(exportOAuthState().clients.length, 1);
    await persistOAuthStore();
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
    resetOAuthState();
  }
});
