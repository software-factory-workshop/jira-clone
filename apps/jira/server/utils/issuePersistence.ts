/**
 * Persistence boundary for the Jira demo.
 *
 * Neon Postgres is selected when `DATABASE_URL` is configured, or explicitly
 * with `JIRA_PERSISTENCE=neon`. `JIRA_PERSISTENCE=memory` is useful for local
 * tests and workshops that do not have a database. The memory implementation
 * delegates to the original deterministic store; the Neon implementation
 * lazily creates its small schema and seeds the labelled issues on first use.
 */
import {
  neon,
  type NeonQueryFunction,
  type NeonQueryFunctionInTransaction,
} from "@neondatabase/serverless";
import { demoIssues } from "@jira-clone/context";
import {
  addComment as addMemoryComment,
  editComment as editMemoryComment,
  createIssue as createMemoryIssue,
  DEMO_COMMENT_AUTHOR,
  getIssue as getMemoryIssue,
  getIssues as getMemoryIssues,
  getIssuesPage as getMemoryIssuesPage,
  listComments as listMemoryComments,
  listCommentsPage as listMemoryCommentsPage,
  normalizeCommentBody,
  normalizeIssueCreateInput,
  resetIssues as resetMemoryIssues,
  updateIssue as updateMemoryIssue,
  validateIssuePatch,
  type CommentCreateInput,
  type CommentEditInput,
  type CommentEditResult,
  type CommentResult,
  type DemoComment,
  type DemoIssue,
  type IssueCreateInput,
  type IssuePatch,
  type UpdateResult,
} from "./issues.ts";

export type PersistenceMode = "neon" | "memory";

export type IssuePersistenceInfo = {
  mode: PersistenceMode;
  durable: boolean;
  label: string;
  description: string;
};

export type IssuePage = {
  total: number;
  issues: DemoIssue[];
};

export type CommentPage = {
  total: number;
  comments: DemoComment[];
};

export type IssuePersistence = {
  mode: PersistenceMode;
  durable: boolean;
  getIssues(): Promise<DemoIssue[]>;
  getIssuesPage(startAt: number, maxResults: number): Promise<IssuePage>;
  getIssue(key: string): Promise<DemoIssue | undefined>;
  updateIssue(
    key: string,
    patch: IssuePatch,
    options?: { fail?: boolean },
  ): Promise<UpdateResult>;
  createIssue(
    input: IssueCreateInput,
    options?: { fail?: boolean },
  ): Promise<UpdateResult>;
  listComments(key: string): Promise<DemoComment[] | undefined>;
  listCommentsPage(
    key: string,
    startAt: number,
    maxResults: number,
  ): Promise<CommentPage | undefined>;
  addComment(
    key: string,
    input: CommentCreateInput,
    options?: { fail?: boolean },
  ): Promise<CommentResult>;
  editComment(
    key: string,
    input: CommentEditInput,
    options?: { fail?: boolean },
  ): Promise<CommentEditResult>;
  resetIssues(): Promise<DemoIssue[]>;
};

const persistenceEnv = "JIRA_PERSISTENCE";

function databaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value === "" ? undefined : value;
}

function configuredMode(): PersistenceMode {
  const requested = process.env[persistenceEnv]?.trim().toLowerCase();
  if (requested === "memory") return "memory";
  if (requested === "neon") return "neon";
  if (requested && requested !== "memory" && requested !== "neon") {
    throw new Error(
      `${persistenceEnv} must be either "neon" or "memory"; received "${requested}".`,
    );
  }
  return databaseUrl() ? "neon" : "memory";
}

/** Describe the effective boundary without opening a database connection. */
export function getIssuePersistenceInfo(): IssuePersistenceInfo {
  const mode = configuredMode();
  if (mode === "neon") {
    const configured = databaseUrl() !== undefined;
    return {
      mode,
      durable: configured,
      label: configured ? "Neon Postgres" : "Neon Postgres (not configured)",
      description: configured
        ? "Neon Postgres persistence. Issue and comment writes survive reloads, cold starts and deploys until the demo reset is used."
        : "Neon persistence is selected but DATABASE_URL is not configured.",
    };
  }
  return {
    mode,
    durable: false,
    label: "In-memory fallback",
    description:
      "In-memory fallback. Writes survive reloads on this running server and reset on cold starts, deploys or the explicit demo reset.",
  };
}

export function issuePersistenceDescription(): string {
  return getIssuePersistenceInfo().description;
}

const memoryPersistence: IssuePersistence = {
  mode: "memory",
  durable: false,
  async getIssues() {
    return getMemoryIssues();
  },
  async getIssuesPage(startAt, maxResults) {
    return getMemoryIssuesPage(startAt, maxResults);
  },
  async getIssue(key) {
    return getMemoryIssue(key);
  },
  async updateIssue(key, patch, options) {
    return updateMemoryIssue(key, patch, options);
  },
  async createIssue(input, options) {
    return createMemoryIssue(input, options);
  },
  async listComments(key) {
    return listMemoryComments(key);
  },
  async listCommentsPage(key, startAt, maxResults) {
    return listMemoryCommentsPage(key, startAt, maxResults);
  },
  async addComment(key, input, options) {
    return addMemoryComment(key, input, options);
  },
  async editComment(key, input, options) {
    return editMemoryComment(key, input, options);
  },
  async resetIssues() {
    return resetMemoryIssues();
  },
};

type Sql = NeonQueryFunction<false, false>;
type TransactionSql = NeonQueryFunctionInTransaction<false, false>;

type IssueRow = {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

type CommentRow = {
  comment_number: number | string;
  issue_key: string;
  body: string;
  author: string;
  created_at: string | Date;
};

const issueColumns =
  "key, title, type, status, priority, assignee, description" as const;

function rowToIssue(row: IssueRow): DemoIssue {
  return {
    key: row.key,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    description: row.description,
  };
}

function rowToComment(row: CommentRow): DemoComment {
  const number = String(row.comment_number);
  return {
    id: `${row.issue_key}-comment-${number}`,
    body: row.body,
    author: row.author,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    demoOnly: true,
  };
}

function seedQuery(sql: TransactionSql, seeds: readonly DemoIssue[]) {
  return sql`
    INSERT INTO jira_demo_issues
      (issue_number, title, type, status, priority, assignee, description, is_seed)
    SELECT
      regexp_replace(entry->>'key', '^ADEO-', '')::bigint,
      entry->>'title',
      entry->>'type',
      entry->>'status',
      entry->>'priority',
      entry->>'assignee',
      entry->>'description',
      true
    FROM jsonb_array_elements(${JSON.stringify(seeds)}::jsonb) AS entry
    WHERE NOT EXISTS (
      SELECT 1 FROM jira_demo_issues WHERE is_seed = true
    )
    ON CONFLICT (key) DO NOTHING
  `;
}

function resetSeedQuery(sql: TransactionSql, seeds: readonly DemoIssue[]) {
  return sql`
    INSERT INTO jira_demo_issues
      (issue_number, title, type, status, priority, assignee, description, is_seed)
    SELECT
      regexp_replace(entry->>'key', '^ADEO-', '')::bigint,
      entry->>'title',
      entry->>'type',
      entry->>'status',
      entry->>'priority',
      entry->>'assignee',
      entry->>'description',
      true
    FROM jsonb_array_elements(${JSON.stringify(seeds)}::jsonb) AS entry
    ON CONFLICT (key) DO NOTHING
  `;
}

function setIssueSequenceQuery(sql: TransactionSql) {
  return sql`
    SELECT setval(
      pg_get_serial_sequence('jira_demo_issues', 'issue_number'),
      COALESCE((SELECT MAX(issue_number) FROM jira_demo_issues), 1),
      true
    )
  `;
}

/**
 * Create a Neon-backed implementation. The SQL client is injected so this
 * boundary can be exercised without opening a real database in unit tests.
 */
export function createNeonIssuePersistence(
  sql: Sql,
  seeds: readonly DemoIssue[] = demoIssues,
): IssuePersistence {
  let ready: Promise<void> | undefined;

  async function ensureReady(): Promise<void> {
    if (!ready) {
      ready = sql
        .transaction((tx) => [
          tx`
            CREATE TABLE IF NOT EXISTS jira_demo_issues (
              issue_number bigint GENERATED BY DEFAULT AS IDENTITY,
              key text GENERATED ALWAYS AS ('ADEO-' || issue_number::text) STORED PRIMARY KEY,
              title text NOT NULL,
              type text NOT NULL,
              status text NOT NULL,
              priority text NOT NULL,
              assignee text NOT NULL,
              description text NOT NULL,
              is_seed boolean NOT NULL DEFAULT false,
              created_at timestamptz NOT NULL DEFAULT now(),
              UNIQUE (issue_number)
            )
          `,
          tx`
            CREATE TABLE IF NOT EXISTS jira_demo_comments (
              comment_number bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              issue_key text NOT NULL REFERENCES jira_demo_issues(key) ON DELETE CASCADE,
              body text NOT NULL,
              author text NOT NULL,
              created_at timestamptz NOT NULL DEFAULT now()
            )
          `,
          tx`
            CREATE INDEX IF NOT EXISTS jira_demo_comments_issue_key_idx
            ON jira_demo_comments(issue_key, comment_number)
          `,
          seedQuery(tx, seeds),
          setIssueSequenceQuery(tx),
        ])
        .then(() => undefined)
        .catch((error) => {
          ready = undefined;
          throw error;
        });
    }
    await ready;
  }

  async function findIssue(key: string): Promise<DemoIssue | undefined> {
    const rows = await sql`
      SELECT ${sql.unsafe(issueColumns)}
      FROM jira_demo_issues
      WHERE key = ${key}
    `;
    const row = rows[0] as IssueRow | undefined;
    return row ? rowToIssue(row) : undefined;
  }

  async function readIssues(): Promise<DemoIssue[]> {
    const rows = await sql`
      SELECT ${sql.unsafe(issueColumns)}, issue_number
      FROM jira_demo_issues
      ORDER BY issue_number
    `;
    return (rows as unknown as IssueRow[]).map(rowToIssue);
  }

  async function readComments(key: string): Promise<DemoComment[]> {
    const rows = await sql`
      SELECT comment_number, issue_key, body, author, created_at
      FROM jira_demo_comments
      WHERE issue_key = ${key}
      ORDER BY comment_number
    `;
    return (rows as unknown as CommentRow[]).map(rowToComment);
  }

  return {
    mode: "neon",
    durable: true,
    async getIssues() {
      await ensureReady();
      return readIssues();
    },
    async getIssuesPage(startAt, maxResults) {
      await ensureReady();
      const offset = Math.max(0, Math.floor(startAt));
      const limit = Math.max(1, Math.floor(maxResults));
      const totalRows = await sql`
        SELECT COUNT(*)::bigint AS count
        FROM jira_demo_issues
      `;
      const totalRaw = (totalRows[0] as { count?: number | string } | undefined)?.count ?? 0;
      const total = typeof totalRaw === "string" ? Number(totalRaw) : Number(totalRaw);
      const rows = await sql`
        SELECT ${sql.unsafe(issueColumns)}
        FROM jira_demo_issues
        ORDER BY issue_number
        LIMIT ${limit} OFFSET ${offset}
      `;
      return {
        total: Number.isFinite(total) ? total : 0,
        issues: (rows as unknown as IssueRow[]).map(rowToIssue),
      };
    },
    async getIssue(key) {
      await ensureReady();
      return findIssue(key);
    },
    async updateIssue(key, patch, options) {
      if (options?.fail) {
        return validateIssuePatch(key, undefined, patch, options)!;
      }
      await ensureReady();
      const current = await findIssue(key);
      const validation = validateIssuePatch(key, current, patch, options);
      if (validation) return validation;
      const rows = await sql`
        UPDATE jira_demo_issues
        SET
          status = COALESCE(${patch.status === undefined ? null : patch.status}, status),
          priority = COALESCE(${patch.priority === undefined ? null : patch.priority}, priority),
          title = COALESCE(${patch.title === undefined ? null : String(patch.title).trim()}, title),
          assignee = COALESCE(${patch.assignee === undefined ? null : String(patch.assignee).trim()}, assignee),
          description = COALESCE(${patch.description === undefined ? null : patch.description}, description)
        WHERE key = ${key}
        RETURNING ${sql.unsafe(issueColumns)}
      `;
      const row = rows[0] as IssueRow | undefined;
      if (!row) {
        return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
      }
      return { ok: true, issue: rowToIssue(row) };
    },
    async createIssue(input, options) {
      const normalized = normalizeIssueCreateInput(input, options);
      if (!normalized.ok) return normalized;
      await ensureReady();
      const rows = await sql`
        INSERT INTO jira_demo_issues
          (title, type, status, priority, assignee, description, is_seed)
        VALUES
          (${normalized.value.title}, ${normalized.value.type}, ${normalized.value.status},
           ${normalized.value.priority}, ${normalized.value.assignee},
           ${normalized.value.description}, false)
        RETURNING ${sql.unsafe(issueColumns)}
      `;
      const row = rows[0] as IssueRow | undefined;
      if (!row) {
        throw new Error("Neon did not return the created Jira issue.");
      }
      return { ok: true, issue: rowToIssue(row) };
    },
    async listComments(key) {
      await ensureReady();
      const issue = await findIssue(key);
      return issue ? readComments(key) : undefined;
    },
    async listCommentsPage(key, startAt, maxResults) {
      await ensureReady();
      const issue = await findIssue(key);
      if (!issue) {
        return undefined;
      }
      const offset = Math.max(0, Math.floor(startAt));
      const limit = Math.max(1, Math.floor(maxResults));
      const totalRows = await sql`
        SELECT COUNT(*)::bigint AS count
        FROM jira_demo_comments
        WHERE issue_key = ${key}
      `;
      const totalRaw = (totalRows[0] as { count?: number | string } | undefined)?.count ?? 0;
      const total = typeof totalRaw === "string" ? Number(totalRaw) : Number(totalRaw);
      const rows = await sql`
        SELECT comment_number, issue_key, body, author, created_at
        FROM jira_demo_comments
        WHERE issue_key = ${key}
        ORDER BY comment_number
        LIMIT ${limit} OFFSET ${offset}
      `;
      return {
        total: Number.isFinite(total) ? total : 0,
        comments: (rows as unknown as CommentRow[]).map(rowToComment),
      };
    },
    async addComment(key, input, options) {
      const normalized = normalizeCommentBody(input, options);
      if (!normalized.ok) return normalized;
      await ensureReady();
      const issue = await findIssue(key);
      if (!issue) {
        return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
      }
      const rows = await sql`
        INSERT INTO jira_demo_comments (issue_key, body, author)
        VALUES (${key}, ${normalized.body}, ${DEMO_COMMENT_AUTHOR})
        RETURNING comment_number, issue_key, body, author, created_at
      `;
      const row = rows[0] as CommentRow | undefined;
      if (!row) {
        throw new Error("Neon did not return the created Jira comment.");
      }
      return { ok: true, comment: rowToComment(row) };
    },
    async editComment(key, input, options) {
      if (options?.fail) {
        return {
          ok: false,
          error:
            "Demo-only comment edit failure (deterministic test path). No comment was changed.",
          statusCode: 500,
        };
      }
      const normalized = normalizeCommentBody(input, options);
      if (!normalized.ok) {
        const message =
          "statusCode" in normalized && normalized.statusCode === 500
            ? normalized.error
            : `${normalized.error} Nothing was written.`;
        return {
          ok: false,
          error: message,
          statusCode: normalized.statusCode,
        };
      }
      if (typeof input.commentId !== "string" || input.commentId.trim() === "") {
        return {
          ok: false,
          error: "A demo comment id is required. Nothing was written.",
          statusCode: 400,
        };
      }
      await ensureReady();
      const issue = await findIssue(key);
      if (!issue) {
        return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
      }
      const existing = await readComments(key);
      const target = existing.find((comment) => comment.id === input.commentId);
      if (!target) {
        return {
          ok: false,
          error: `Unknown demo comment id: ${input.commentId}. Nothing was written.`,
          statusCode: 404,
        };
      }
      if (normalized.body === target.body) {
        return {
          ok: false,
          error:
            "Demo comment is already that text (replay): provide a changed body. Nothing was written.",
          statusCode: 409,
        };
      }
      const commentNumberText = String(input.commentId).slice(`${key}-comment-`.length);
      const commentNumber = Number(commentNumberText);
      const rows = Number.isInteger(commentNumber)
        ? await sql`
          UPDATE jira_demo_comments
          SET body = ${normalized.body}
          WHERE issue_key = ${key} AND comment_number = ${commentNumber}
          RETURNING comment_number, issue_key, body, author, created_at
        `
        : [];
      const row = rows[0] as CommentRow | undefined;
      if (!row) {
        return {
          ok: false,
          error: `Unknown demo comment id: ${input.commentId}. Nothing was written.`,
          statusCode: 404,
        };
      }
      return { ok: true, comment: rowToComment(row) };
    },
    async resetIssues() {
      await ensureReady();
      await sql.transaction((tx) => [
        tx`TRUNCATE TABLE jira_demo_comments, jira_demo_issues RESTART IDENTITY`,
        resetSeedQuery(tx, seeds),
        setIssueSequenceQuery(tx),
      ]);
      return readIssues();
    },
  };
}

let neonUrl: string | undefined;
let neonSql: Sql | undefined;
let neonPersistence: IssuePersistence | undefined;

function getNeonPersistence(): IssuePersistence {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      `Neon persistence requires DATABASE_URL. Set DATABASE_URL or use ${persistenceEnv}=memory for the local fallback.`,
    );
  }
  if (!neonSql || neonUrl !== url || !neonPersistence) {
    neonUrl = url;
    neonSql = neon(url);
    neonPersistence = createNeonIssuePersistence(neonSql);
  }
  return neonPersistence;
}

export function getIssuePersistence(): IssuePersistence {
  return configuredMode() === "neon" ? getNeonPersistence() : memoryPersistence;
}

export async function getPersistentIssues(): Promise<DemoIssue[]> {
  return getIssuePersistence().getIssues();
}

export async function getPersistentIssuesPage(
  startAt: number,
  maxResults: number,
): Promise<IssuePage> {
  return getIssuePersistence().getIssuesPage(startAt, maxResults);
}

export async function getPersistentIssue(
  key: string,
): Promise<DemoIssue | undefined> {
  return getIssuePersistence().getIssue(key);
}

export async function updatePersistentIssue(
  key: string,
  patch: IssuePatch,
  options?: { fail?: boolean },
): Promise<UpdateResult> {
  return getIssuePersistence().updateIssue(key, patch, options);
}

export async function createPersistentIssue(
  input: IssueCreateInput,
  options?: { fail?: boolean },
): Promise<UpdateResult> {
  return getIssuePersistence().createIssue(input, options);
}

export async function listPersistentComments(
  key: string,
): Promise<DemoComment[] | undefined> {
  return getIssuePersistence().listComments(key);
}

export async function listPersistentCommentsPage(
  key: string,
  startAt: number,
  maxResults: number,
): Promise<CommentPage | undefined> {
  return getIssuePersistence().listCommentsPage(key, startAt, maxResults);
}

export async function addPersistentComment(
  key: string,
  input: CommentCreateInput,
  options?: { fail?: boolean },
): Promise<CommentResult> {
  return getIssuePersistence().addComment(key, input, options);
}

export async function editPersistentComment(
  key: string,
  input: CommentEditInput,
  options?: { fail?: boolean },
): Promise<CommentEditResult> {
  return getIssuePersistence().editComment(key, input, options);
}

export async function resetPersistentIssues(): Promise<DemoIssue[]> {
  return getIssuePersistence().resetIssues();
}
