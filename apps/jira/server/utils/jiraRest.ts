/**
 * Demo-only Jira-style REST adapter over the demo store (GET-only, read-only).
 *
 * Small shared formatter plus pure read helpers for the Jira-shaped surface
 * under `/api/rest/api/3/**`. Every helper reuses the existing demo store
 * (`./issues`), demo accounts (`./demoAccounts`) and the observed reference
 * metadata in `packages/project-context/src/jira-reference.json` (project KAN
 * id 10000, "My Kanban Space", simplified next-gen software project; the six
 * observed issue types; the four observed statuses). No new dependencies.
 *
 * Demo boundaries, repeated on every envelope via `demoOnly`, `roleMatrix`
 * and `boundary`: GET-only reads over the labelled in-memory demo store, no
 * JQL engine, no writes, no production auth. Reads stay open to the demo
 * viewer (no write authorization gate); unknown issue/project keys return a
 * labelled 404 without writing. Any `jql`/`JQL` query parameter is rejected
 * with a labelled demoOnly 400 naming unsupported; it is never silently
 * ignored. `startAt`/`maxResults` are bounded (documented below) for the
 * search-lite and comment list endpoints.
 *
 * A later Jira MCP toolkit wraps these contracts 1:1; see
 * `docs/jira-rest-adapter.md` for the tool mapping.
 */

import {
  OBSERVED_STATUSES,
  allowedTransitions,
  getIssue,
  getIssues,
  isObservedStatus,
  listComments,
  type DemoIssue,
} from "./issues.ts";
import { DEMO_ROLE_MATRIX_LABEL, type DemoRole } from "./demoAccounts.ts";
import {
  resolveAppActor,
  type AppIdentitySource,
  type AppRequestIdentity,
} from "./appAccounts.ts";

/** Explicit boundary note attached to every adapter response. */
export const REST_BOUNDARY =
  "Demo-only Jira-style REST subset: GET-only reads over the labelled in-memory demo store; " +
  "no JQL engine, no writes, no production auth. Unknown keys stay 404 and write nothing. " +
  "A later Jira MCP toolkit wraps these contracts 1:1.";

/** Observed reference project, mirrored from the dated jira-reference.json capture. */
export const REST_PROJECT_ID = "10000";
export const REST_PROJECT_KEY = "KAN";
export const REST_PROJECT_NAME = "My Kanban Space";
export const REST_PROJECT_TYPE = "software";
export const REST_PROJECT_SIMPLIFIED = true;
export const REST_PROJECT_STYLE = "next-gen";

/** Observed reference issue types, mirrored from the dated jira-reference.json capture. */
export const REST_ISSUE_TYPES = [
  "Epic",
  "Subtask",
  "Task",
  "Story",
  "Feature",
  "Bug",
] as const;

/** Search-lite/comment-list pagination: defaults and the documented hard bound. */
export const REST_DEFAULT_START_AT = 0;
export const REST_DEFAULT_MAX_RESULTS = 25;
export const REST_MAX_MAX_RESULTS = 50;

export type RestResult<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string };

type DemoEnvelope = {
  demoOnly: true;
  roleMatrix: string;
  boundary: string;
};

function demoEnvelope(): DemoEnvelope {
  return {
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    boundary: REST_BOUNDARY,
  };
}

export type RestUser = {
  accountId: string;
  accountType: "atlassian:passport-demo";
  displayName: string;
  active: true;
  demoRole: DemoRole;
  /** Which identity produced this Jira-shaped user: passport or demoFallback. */
  identitySource: AppIdentitySource;
  /** Stable platform subject for passport accounts; null for the demo fallback. */
  externalSub: string | null;
  emailAddress: string | null;
} & DemoEnvelope;

export type RestProject = {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  simplified: boolean;
  style: string;
} & DemoEnvelope;

export type RestProjectStatuses = {
  projectKey: string;
  issueTypes: { name: string; statuses: { name: string }[] }[];
} & DemoEnvelope;

export type RestIssue = {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    status: { name: string };
    priority: { name: string };
    assignee: { displayName: string };
    description: string;
    project: { id: string; key: string; name: string };
  };
} & DemoEnvelope;

export type RestSearchResponse = {
  startAt: number;
  maxResults: number;
  total: number;
  issues: RestIssue[];
} & DemoEnvelope;

export type RestComment = {
  id: string;
  body: string;
  author: { displayName: string };
  created: string;
  demoOnly: true;
};

export type RestCommentList = {
  startAt: number;
  maxResults: number;
  total: number;
  comments: RestComment[];
} & DemoEnvelope;

export type RestTransition = {
  id: string;
  name: string;
  to: { name: string };
};

export type RestTransitionList = {
  issueKey: string;
  from: string;
  transitions: RestTransition[];
} & DemoEnvelope;

/**
 * Jira-shaped demo user for GET /api/rest/api/3/myself. Passport-derived
 * accounts carry the stable `passport:<external_sub>` account id; the local
 * synthetic fallback keeps its labelled demo id. Never writes and never
 * exposes the raw token.
 */
export function toRestUser(account: {
  id: string;
  label: string;
  role: DemoRole;
  identitySource?: AppIdentitySource;
  externalSub?: string | null;
  email?: string | null;
  displayName?: string | null;
}): RestUser {
  return {
    accountId: account.id,
    accountType: "atlassian:passport-demo",
    displayName: account.displayName ?? account.label,
    active: true,
    demoRole: account.role,
    identitySource: account.identitySource ?? "demoFallback",
    externalSub: account.externalSub ?? null,
    emailAddress: account.email ?? null,
    ...demoEnvelope(),
  };
}

/**
 * Demo permission summary attached to read metadata: which write kinds the
 * resolved account may perform. Mirrors `authorizeAppWrite` semantics without
 * writing.
 */
export function restPermissions(account: {
  canWrite: boolean;
  canReset: boolean;
}): { canCreate: boolean; canUpdate: boolean; canComment: boolean; canReset: boolean } {
  return {
    canCreate: account.canWrite,
    canUpdate: account.canWrite,
    canComment: account.canWrite,
    canReset: account.canReset,
  };
}

/** Jira-like issue bean: title -> summary plus status/priority/assignee mapping. Pure; never writes. */
export function toRestIssue(issue: DemoIssue): RestIssue {
  return {
    id: issue.key,
    key: issue.key,
    self: `/api/rest/api/3/issue/${issue.key}`,
    fields: {
      summary: issue.title,
      issuetype: { name: issue.type },
      status: { name: issue.status },
      priority: { name: issue.priority },
      assignee: { displayName: issue.assignee },
      description: issue.description,
      project: {
        id: REST_PROJECT_ID,
        key: REST_PROJECT_KEY,
        name: REST_PROJECT_NAME,
      },
    },
    ...demoEnvelope(),
  };
}

/** Demo-only transition id. Stable per target status; not a Jira id. */
export function toRestTransitionId(to: string): string {
  return `demo-${to.toLowerCase().replace(/\s+/g, "-")}`;
}

/**
 * Reject any `jql`/`JQL` (any casing) query parameter with a labelled
 * demoOnly 400 naming unsupported. Callers return this before reading so a
 * JQL attempt is never silently ignored. Pure; never writes.
 */
export function checkNoJql(
  query: Record<string, unknown>,
): { ok: false; statusCode: number; error: string } | null {
  const found = Object.keys(query).find((name) => name.toLowerCase() === "jql");
  if (found === undefined) {
    return null;
  }
  return {
    ok: false,
    statusCode: 400,
    error:
      `Unsupported demoOnly query parameter "${found}": this demo REST subset has no JQL engine. ` +
      `Use the list-lite search without jql (startAt/maxResults only). Nothing was written.`,
  };
}

export type RestPagination = {
  startAt: number;
  maxResults: number;
};

function parsePaginationValue(
  raw: unknown,
  name: "startAt" | "maxResults",
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === undefined) {
    return {
      ok: true,
      value: name === "startAt" ? REST_DEFAULT_START_AT : REST_DEFAULT_MAX_RESULTS,
    };
  }
  const text = Array.isArray(raw) ? "" : String(raw).trim();
  const num = text === "" ? NaN : Number(text);
  if (!Number.isInteger(num)) {
    return {
      ok: false,
      error:
        `Invalid demoOnly "${name}": expected an integer ` +
        (name === "startAt"
          ? ">= 0"
          : `1..${REST_MAX_MAX_RESULTS}`) +
        `. Nothing was written.`,
    };
  }
  if (name === "startAt" ? num < 0 : num < 1 || num > REST_MAX_MAX_RESULTS) {
    return {
      ok: false,
      error:
        `Invalid demoOnly "${name}": expected an integer ` +
        (name === "startAt"
          ? ">= 0"
          : `1..${REST_MAX_MAX_RESULTS}`) +
        `. Nothing was written.`,
    };
  }
  return { ok: true, value: num };
}

/**
 * Bound and document `startAt`/`maxResults`: defaults 0/25, `startAt` must be
 * an integer >= 0, `maxResults` an integer 1..50. Anything else is a labelled
 * demoOnly 400. Pure; never writes.
 */
export function parseRestPagination(
  query: Record<string, unknown>,
): RestResult<RestPagination> {
  const startAt = parsePaginationValue(query["startAt"], "startAt");
  if (!startAt.ok) {
    return { ok: false, statusCode: 400, error: startAt.error };
  }
  const maxResults = parsePaginationValue(query["maxResults"], "maxResults");
  if (!maxResults.ok) {
    return { ok: false, statusCode: 400, error: maxResults.error };
  }
  return { ok: true, data: { startAt: startAt.value, maxResults: maxResults.value } };
}

/**
 * Identity read for the adapter through the shared request-to-account
 * resolver. A present Passport identity maps through the explicit
 * claims/groups role mapping (default viewer); otherwise the labelled
 * synthetic `x-demo-user` fallback applies (explicit default, 401 unknown,
 * 400 malformed). Pure; never writes.
 */
export function restMyself(
  header: unknown,
  passport?: Pick<AppRequestIdentity, "passportToken" | "devUser" | "nodeEnv">,
): RestResult<RestUser> {
  const resolved = resolveAppActor({
    passportToken: passport?.passportToken,
    demoUser: header,
    devUser: passport?.devUser,
    nodeEnv: passport?.nodeEnv,
  });
  if (!resolved.ok) {
    return { ok: false, statusCode: resolved.statusCode, error: resolved.error };
  }
  return { ok: true, data: toRestUser(resolved.account) };
}

/**
 * Demo project read. Only the observed reference project KAN is served;
 * anything else is a labelled 404. Pure; never writes.
 */
export function restProject(projectKey: string): RestResult<RestProject> {
  if (projectKey !== REST_PROJECT_KEY) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown demo project: ${projectKey}. This demo REST subset only serves project "KAN". Nothing was written.`,
    };
  }
  return {
    ok: true,
    data: {
      id: REST_PROJECT_ID,
      key: REST_PROJECT_KEY,
      name: REST_PROJECT_NAME,
      projectTypeKey: REST_PROJECT_TYPE,
      simplified: REST_PROJECT_SIMPLIFIED,
      style: REST_PROJECT_STYLE,
      ...demoEnvelope(),
    },
  };
}

/**
 * Observed statuses per observed issue type for project KAN. This is the
 * observed status list, not a verified transition graph; allowed moves come
 * from the transitions endpoint. Pure; never writes.
 */
export function restProjectStatuses(
  projectKey: string,
): RestResult<RestProjectStatuses> {
  if (projectKey !== REST_PROJECT_KEY) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown demo project: ${projectKey}. This demo REST subset only serves project "KAN". Nothing was written.`,
    };
  }
  return {
    ok: true,
    data: {
      projectKey: REST_PROJECT_KEY,
      issueTypes: REST_ISSUE_TYPES.map((name) => ({
        name,
        statuses: OBSERVED_STATUSES.map((status) => ({ name: status })),
      })),
      ...demoEnvelope(),
    },
  };
}

/**
 * Single-issue read with the Jira-like envelope. Unknown keys return a
 * labelled 404. Pure; never writes.
 */
export function restIssue(key: string): RestResult<RestIssue> {
  const issue = getIssue(key);
  if (!issue) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown issue key: ${key}. Demo-only REST read; nothing was written.`,
    };
  }
  return { ok: true, data: toRestIssue(issue) };
}

/**
 * Search-lite over the demo store: the full list-lite slice with bounded
 * `startAt`/`maxResults`. There is no JQL engine, so any jql/JQL parameter
 * is a labelled 400, never silently ignored. Pure; never writes.
 */
export function restSearch(
  query: Record<string, unknown> = {},
): RestResult<RestSearchResponse> {
  const jql = checkNoJql(query);
  if (jql) {
    return jql;
  }
  const page = parseRestPagination(query);
  if (!page.ok) {
    return page;
  }
  const all = getIssues().map(toRestIssue);
  const { startAt, maxResults } = page.data;
  return {
    ok: true,
    data: {
      startAt,
      maxResults,
      total: all.length,
      issues: all.slice(startAt, startAt + maxResults),
      ...demoEnvelope(),
    },
  };
}

/**
 * Comment list for one issue in a Jira-like envelope with the same bounded
 * `startAt`/`maxResults`. Unknown keys return a labelled 404. Pure; never
 * writes.
 */
export function restComments(
  key: string,
  query: Record<string, unknown> = {},
): RestResult<RestCommentList> {
  const jql = checkNoJql(query);
  if (jql) {
    return jql;
  }
  const comments = listComments(key);
  if (!comments) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown issue key: ${key}. Demo-only REST read; nothing was written.`,
    };
  }
  const page = parseRestPagination(query);
  if (!page.ok) {
    return page;
  }
  const { startAt, maxResults } = page.data;
  return {
    ok: true,
    data: {
      startAt,
      maxResults,
      total: comments.length,
      comments: comments
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          author: { displayName: comment.author },
          created: comment.createdAt,
          demoOnly: true as const,
        }))
        .slice(startAt, startAt + maxResults),
      ...demoEnvelope(),
    },
  };
}

/**
 * Allowed transition targets for one issue, derived from the same
 * `DEMO_TRANSITIONS` matrix that guards the PATCH save path. Unknown keys
 * return a labelled 404. Pure; never writes.
 */
export function restTransitions(
  key: string,
  query: Record<string, unknown> = {},
): RestResult<RestTransitionList> {
  const jql = checkNoJql(query);
  if (jql) {
    return jql;
  }
  const issue = getIssue(key);
  if (!issue) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown issue key: ${key}. Demo-only REST read; nothing was written.`,
    };
  }
  const targets = isObservedStatus(issue.status)
    ? allowedTransitions(issue.status)
    : [];
  return {
    ok: true,
    data: {
      issueKey: issue.key,
      from: issue.status,
      transitions: targets.map((to) => ({
        id: toRestTransitionId(to),
        name: to,
        to: { name: to },
      })),
      ...demoEnvelope(),
    },
  };
}
