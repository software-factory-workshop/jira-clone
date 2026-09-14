/**
 * Durable boundary for the demo OAuth store.
 *
 * The OAuth provider in `jiraOAuth.ts` is synchronous and keeps clients,
 * grant tickets, codes and tokens in memory. On Vercel that memory is per
 * instance and is lost on every cold start or deploy, which broke Vercel
 * Connect: the connector's dynamically registered client vanished between
 * `vercel connect create` and the first user authorization.
 *
 * When `DATABASE_URL` is configured (the same Neon database the issues use),
 * every request that touches the store first hydrates the maps from the
 * `jira_demo_oauth_state` table, and OAuth routes write back the entries
 * that changed (upsert) or disappeared (delete) when they finish, success or
 * error. Without a database the store stays in memory, as before.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { exportOAuthState, importOAuthState, type OAuthStateSnapshot } from "./jiraOAuth.ts";

type Sql = NeonQueryFunction<false, false>;
export type OAuthRow = { kind: string; id: string; value: unknown };
export type OAuthRowKey = { kind: string; id: string };

export type OAuthStore = {
  load(): Promise<OAuthRow[]>;
  upsert(rows: OAuthRow[]): Promise<void>;
  remove(keys: OAuthRowKey[]): Promise<void>;
};

const KINDS = ["clients", "grantTickets", "authCodes", "accessTokens", "refreshTokens", "deactivatedAccounts"] as const;
type Kind = (typeof KINDS)[number];

function idOf(kind: Kind, value: unknown): string {
  if (kind === "deactivatedAccounts") return value as string;
  const entry = value as Record<string, string>;
  if (kind === "clients") return entry.clientId as string;
  if (kind === "grantTickets") return entry.ticket as string;
  if (kind === "authCodes") return entry.code as string;
  return entry.token as string;
}

/** Flatten a snapshot into (kind,id,json) rows keyed by "kind::id". Pure. */
export function snapshotRows(snapshot: OAuthStateSnapshot): Map<string, OAuthRow> {
  const rows = new Map<string, OAuthRow>();
  for (const kind of KINDS) {
    for (const value of snapshot[kind] as unknown[]) {
      const id = idOf(kind, value);
      rows.set(`${kind}::${id}`, { kind, id, value });
    }
  }
  return rows;
}

/** Rebuild a snapshot from rows. Unknown kinds are ignored. Pure. */
export function rowsToSnapshot(rows: OAuthRow[]): OAuthStateSnapshot {
  const snapshot: OAuthStateSnapshot = { clients: [], grantTickets: [], authCodes: [], accessTokens: [], refreshTokens: [], deactivatedAccounts: [] };
  for (const row of rows) {
    if ((KINDS as readonly string[]).includes(row.kind)) (snapshot[row.kind as Kind] as unknown[]).push(row.value);
  }
  return snapshot;
}

/** Diff two flattened snapshots into the writes that move `before` to `after`. Pure. */
export function diffRows(before: Map<string, OAuthRow>, after: Map<string, OAuthRow>): { upserts: OAuthRow[]; deletes: OAuthRowKey[] } {
  const upserts: OAuthRow[] = [];
  const deletes: OAuthRowKey[] = [];
  for (const [key, row] of after) {
    const prior = before.get(key);
    if (!prior || JSON.stringify(prior.value) !== JSON.stringify(row.value)) upserts.push(row);
  }
  for (const [key, row] of before) if (!after.has(key)) deletes.push({ kind: row.kind, id: row.id });
  return { upserts, deletes };
}

export function createNeonOAuthStore(sql: Sql): OAuthStore {
  let ready: Promise<void> | undefined;
  const ensureReady = () =>
    (ready ??= sql`
      CREATE TABLE IF NOT EXISTS jira_demo_oauth_state (
        kind text NOT NULL,
        id text NOT NULL,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, id)
      )
    `.then(() => undefined));
  return {
    async load() {
      await ensureReady();
      return (await sql`SELECT kind, id, value FROM jira_demo_oauth_state`) as OAuthRow[];
    },
    async upsert(rows) {
      if (!rows.length) return;
      await ensureReady();
      await sql`
        INSERT INTO jira_demo_oauth_state (kind, id, value, updated_at)
        SELECT entry->>'kind', entry->>'id', entry->'value', now()
        FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS entry
        ON CONFLICT (kind, id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `;
    },
    async remove(keys) {
      if (!keys.length) return;
      await ensureReady();
      await sql`
        DELETE FROM jira_demo_oauth_state s
        USING jsonb_array_elements(${JSON.stringify(keys)}::jsonb) AS entry
        WHERE s.kind = entry->>'kind' AND s.id = entry->>'id'
      `;
    },
  };
}

let store: OAuthStore | undefined;
let storeUrl: string | undefined;
let hydrated: Map<string, OAuthRow> | undefined;

function databaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : undefined;
}

/** Test hook: inject a store, or `undefined` to fall back to env-based selection. */
export function setOAuthStoreForTests(next: OAuthStore | undefined): void {
  store = next;
  storeUrl = next ? "test" : undefined;
  hydrated = undefined;
}

function currentStore(): OAuthStore | undefined {
  if (storeUrl === "test") return store;
  const url = databaseUrl();
  if (!url) return undefined;
  if (!store || storeUrl !== url) {
    storeUrl = url;
    store = createNeonOAuthStore(neon(url));
  }
  return store;
}

export function oauthStoreIsDurable(): boolean {
  return currentStore() !== undefined;
}

/** Replace the in-memory OAuth store with the durable copy. No-op without a database. */
export async function hydrateOAuthStore(): Promise<void> {
  const current = currentStore();
  if (!current) return;
  importOAuthState(rowsToSnapshot(await current.load()));
  hydrated = snapshotRows(exportOAuthState());
}

/** Write back what changed since the last hydration. No-op without a database. */
export async function persistOAuthStore(): Promise<void> {
  const current = currentStore();
  if (!current) return;
  const before = hydrated ?? new Map<string, OAuthRow>();
  const after = snapshotRows(exportOAuthState());
  const { upserts, deletes } = diffRows(before, after);
  await current.upsert(upserts);
  await current.remove(deletes);
  hydrated = after;
}

/**
 * Route wrapper for the OAuth endpoints: hydrate, run, always persist (a
 * handler may throw an H3 error after mutating the store, e.g. a consumed
 * code). Errors are rethrown after the write-back.
 */
// `defineEventHandler` is Nitro's auto-imported global; importing it from "h3"
// here would resolve to a different h3 major in this workspace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineOAuthHandler<E = any, R = unknown>(handler: (event: E) => R | Promise<R>) {
  return defineEventHandler(async (event) => {
    await hydrateOAuthStore();
    try {
      return await handler(event as unknown as E);
    } finally {
      await persistOAuthStore();
    }
  });
}
