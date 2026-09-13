/**
 * Demo-only Jira-style REST adapter over the demo store (bounded reads plus
 * the four explicit demo-only write contracts).
 *
 * Small shared formatter plus pure helpers for the Jira-shaped surface
 * under `/api/rest/api/3/**`. Every helper reuses the existing demo store
 * (`./issues`), application accounts (`./appAccounts`), demo accounts
 * (`./demoAccounts`) and the observed reference metadata in
 * `packages/project-context/src/jira-reference.json` (project KAN id 10000,
 * "My Kanban Space", simplified next-gen software project; the six observed
 * issue types; the four observed statuses). No new dependencies.
 *
 * Demo boundaries, repeated on every envelope via `demoOnly`, `roleMatrix`
 * and `boundary`: reads plus the four explicit write contracts over the
 * labelled in-memory demo store, no JQL engine, no production auth. Reads
 * stay open to the demo viewer (no write authorization gate); writes run
 * the shared `authorizeAppWrite` authority first and change nothing on
 * denial. Unknown issue/project keys return a labelled 404 without
 * writing. Any `jql`/`JQL` query parameter is rejected with a labelled
 * demoOnly 400 naming unsupported; it is never silently ignored.
 * `startAt`/`maxResults` are bounded (documented below) for the search-lite
 * and comment list endpoints.
 *
 * The Jira MCP toolkit wraps these contracts 1:1; see
 * `docs/jira-rest-adapter.md` for the route mapping and
 * `docs/jira-mcp-tools.md` for the tool mapping.
 */

import {
  OBSERVED_STATUSES,
  PRIORITIES,
  addComment,
  allowedTransitions,
  createIssue,
  getIssue,
  getIssues,
  isDemoTransition,
  isObservedStatus,
  isPriority,
  listComments,
  updateIssue,
  type DemoIssue,
  type DemoPriority,
  type ObservedStatus,
} from "./issues.ts";
import {
  DEMO_ROLE_MATRIX_LABEL,
  type DemoRole,
  type DemoWriteAction,
} from "./demoAccounts.ts";
import {
  appActorLabel,
  authorizeAppWrite,
  resolveAppActor,
  type AppAccount,
  type AppIdentitySource,
  type AppRequestIdentity,
} from "./appAccounts.ts";
import {
  authorizeOAuthBearerWrite,
  resolveOAuthIssuer,
  validateOAuthBearer,
} from "./jiraOAuth.ts";

/** Explicit boundary note attached to every adapter response. */
export const REST_BOUNDARY =
  "Demo-only Jira-style REST subset: reads plus the bounded writes POST /api/rest/api/3/issue, " +
  "PUT /api/rest/api/3/issue/:key, POST /api/rest/api/3/issue/:key/comment and " +
  "POST /api/rest/api/3/issue/:key/transitions over the labelled in-memory demo store; " +
  "no JQL engine, no production auth. Unknown keys stay 404 and write nothing. " +
  "This is not full Jira parity and persistence is the existing in-memory demo store. " +
  "The Jira MCP toolkit wraps these contracts 1:1.";

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

/** Bounded Jira-shaped request for POST /api/rest/api/3/issue. */
export type RestCreateIssueInput = {
  fields?: unknown;
  fail?: unknown;
};

/** Bounded Jira-shaped request for PUT /api/rest/api/3/issue/:key. */
export type RestUpdateIssueInput = {
  fields?: unknown;
  fail?: unknown;
};

/** Bounded Jira-shaped request for POST /api/rest/api/3/issue/:key/comment. */
export type RestAddCommentInput = {
  body?: unknown;
  fail?: unknown;
};

/** Bounded Jira-shaped request for POST /api/rest/api/3/issue/:key/transitions. */
export type RestTransitionIssueInput = {
  transition?: unknown;
  fail?: unknown;
};

export type RestWriteResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      statusCode: number;
      error: string;
      allowedFrom?: string[];
      /** Present on denials where an account resolved (e.g. viewer 403s). */
      account?: AppAccount;
    };


/**
 * Shared demo-only write gate for the four Jira-shaped write contracts.
 * Calls `authorizeAppWrite` through one path so HTTP routes and MCP tools
 * share the exact admin/member/viewer and malformed/unknown identity
 * semantics as the native routes. When an OAuth bearer validation is
 * passed, it is enforced first instead: a present bearer (valid or not)
 * never falls through to the demo fallback, and writes additionally
 * require the `write` scope. Returns the authorized account; callers
 * attach it as `actor`/`identitySource` metadata. Pure; never writes.
 */
export function authorizeRestWrite(
  identity: AppRequestIdentity,
  action: DemoWriteAction,
  bearer?: ReturnType<typeof validateOAuthBearer> | null,
): RestWriteResult<AppAccount> {
  if (bearer !== undefined && bearer !== null) {
    return authorizeBearerWrite(bearer);
  }
  const authorized = authorizeAppWrite(identity, action);
  if (!authorized.ok) {
    return {
      ok: false,
      statusCode: authorized.statusCode,
      error: `${authorized.error} Nothing was written.`,
      ...("account" in authorized && authorized.account
        ? { account: authorized.account }
        : {}),
    };
  }
  return { ok: true, data: authorized.account };
}

const REST_WRITE_FIELDS_LABEL =
  "Supported demo fields: summary, priority, assignee, description " +
  "(creation also accepts issuetype and the fixture-defaulted status). Any other field is rejected and writes nothing.";

function readFieldsObject(fields: unknown): {
  ok: true;
  fields: Record<string, unknown>;
} | { ok: false; error: string } {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    return {
      ok: false,
      error:
        "Invalid demoOnly request: expected an object with a Jira-shaped `fields` object. " +
        `${REST_WRITE_FIELDS_LABEL} Nothing was written.`,
    };
  }
  return { ok: true, fields: fields as Record<string, unknown> };
}

function failFlag(value: unknown): boolean {
  return value === true;
}

function toStorePriorityName(value: unknown): DemoPriority | null {
  if (typeof value === "string" && isPriority(value.trim())) {
    return value.trim() as DemoPriority;
  }
  return null;
}

function extractAssigneeName(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const name of ["displayName", "name", "accountId"]) {
      const entry = record[name];
      if (typeof entry === "string" && entry.trim() !== "") {
        return entry.trim();
      }
    }
  }
  return null;
}

function extractDescriptionText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    // Accept the plain Jira document shape the demo UI sends ({ content }) by
    // joining nested text runs best-effort; anything else stays unsupported.
    const texts: string[] = [];
    const visit = (node: unknown): void => {
      if (typeof node === "string") {
        texts.push(node);
        return;
      }
      if (typeof node === "object" && node !== null) {
        if (Array.isArray(node)) {
          for (const entry of node) visit(entry);
          return;
        }
        const entry = node as Record<string, unknown>;
        if (typeof entry["text"] === "string") {
          texts.push(entry["text"] as string);
        }
        if (entry["content"] !== undefined) visit(entry["content"]);
      }
    };
    visit(record["content"] ?? record);
    if (texts.length > 0 || "content" in record) {
      return texts.join("");
    }
  }
  return null;
}

/**
 * Demo-only Jira-shaped issue creation: POST /api/rest/api/3/issue.
 *
 * Accepts the bounded `fields` subset (`summary` required; `priority`,
 * `assignee`, `description`, `issuetype`, fixture-defaulted `status`
 * optional). Unknown fields, blank summaries, invalid values and the
 * deterministic `{fail:true}` path fail closed with labelled demoOnly
 * errors that write nothing. Actor checks run first via `authorizeRestWrite`.
 */
export function restCreateIssue(
  identity: AppRequestIdentity,
  body: RestCreateIssueInput = {},
  options?: { bearer?: ReturnType<typeof validateOAuthBearer> | null },
): RestWriteResult<{ issue: ReturnType<typeof toRestIssue>; actor: ReturnType<typeof appActorLabel>; identitySource: AppIdentitySource }> {
  const authorized = authorizeRestWrite(identity, "create", options?.bearer ?? null);
  if (!authorized.ok) {
    return authorized;
  }
  const account = authorized.data;
  const parsed = readFieldsObject(body?.fields);
  if (!parsed.ok) {
    return { ok: false, statusCode: 400, error: parsed.error };
  }
  const raw = parsed.fields;
  const supported = new Set([
    "summary",
    "priority",
    "assignee",
    "description",
    "issuetype",
    "status",
    "project",
  ]);
  const unsupported = Object.keys(raw).filter((name) => !supported.has(name));
  if (unsupported.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      error:
        `Unsupported demoOnly field(s): ${unsupported.join(", ")}. ` +
        `${REST_WRITE_FIELDS_LABEL} Nothing was written.`,
    };
  }
  const summary = raw["summary"];
  if (typeof summary !== "string" || summary.trim() === "") {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Invalid demoOnly request: `fields.summary` is required and must be nonblank. " +
        `${REST_WRITE_FIELDS_LABEL} Nothing was written.`,
    };
  }
  let status: ObservedStatus | undefined;
  if (raw["status"] !== undefined) {
    const name =
      typeof raw["status"] === "object" && raw["status"] !== null && !Array.isArray(raw["status"])
        ? (raw["status"] as Record<string, unknown>)["name"]
        : raw["status"];
    if (!isObservedStatus(typeof name === "string" ? name.trim() : name)) {
      return {
        ok: false,
        statusCode: 400,
        error:
          `Unknown status. Allowed demo statuses: ${OBSERVED_STATUSES.join(", ")}. Nothing was written.`,
      };
    }
    status = (typeof name === "string" ? name.trim() : name) as ObservedStatus;
  }
  let priority: DemoPriority | undefined;
  if (raw["priority"] !== undefined) {
    const name =
      typeof raw["priority"] === "object" && raw["priority"] !== null && !Array.isArray(raw["priority"])
        ? (raw["priority"] as Record<string, unknown>)["name"]
        : raw["priority"];
    const mapped = toStorePriorityName(name);
    if (!mapped) {
      return {
        ok: false,
        statusCode: 400,
        error:
          `Unknown priority. Allowed demo priorities: ${PRIORITIES.join(", ")}. Nothing was written.`,
      };
    }
    priority = mapped;
  }
  const assignee =
    raw["assignee"] === undefined ? undefined : extractAssigneeName(raw["assignee"]);
  if (raw["assignee"] !== undefined && assignee === null) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Invalid demoOnly `fields.assignee`: expected a nonblank string or an object with displayName/name/accountId. Nothing was written.",
    };
  }
  const description =
    raw["description"] === undefined
      ? undefined
      : extractDescriptionText(raw["description"]);
  if (raw["description"] !== undefined && description === null) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Invalid demoOnly `fields.description`: expected a string or a Jira document object with text content. Nothing was written.",
    };
  }
  let type: string | undefined;
  if (raw["issuetype"] !== undefined) {
    const name =
      typeof raw["issuetype"] === "object" && raw["issuetype"] !== null && !Array.isArray(raw["issuetype"])
        ? (raw["issuetype"] as Record<string, unknown>)["name"]
        : raw["issuetype"];
    if (typeof name !== "string" || name.trim() === "") {
      return {
        ok: false,
        statusCode: 400,
        error:
          "Invalid demoOnly `fields.issuetype`: expected an object with a nonblank `name`. Nothing was written.",
      };
    }
    type = name.trim();
  }
  if (raw["project"] !== undefined) {
    const key =
      typeof raw["project"] === "object" && raw["project"] !== null && !Array.isArray(raw["project"])
        ? (raw["project"] as Record<string, unknown>)["key"]
        : raw["project"];
    if (key !== undefined && key !== REST_PROJECT_KEY) {
      return {
        ok: false,
        statusCode: 404,
        error: `Unknown demo project: ${String(key)}. This demo REST subset only serves project "KAN". Nothing was written.`,
      };
    }
  }
  const created = createIssue(
    {
      title: summary.trim(),
      ...(type === undefined ? {} : { type }),
      ...(status === undefined ? {} : { status }),
      ...(priority === undefined ? {} : { priority }),
      ...(assignee === undefined ? {} : { assignee }),
      ...(description === undefined ? {} : { description }),
    },
    { fail: failFlag(body?.fail) },
  );
  if (!created.ok) {
    return { ok: false, statusCode: created.statusCode, error: created.error };
  }
  return {
    ok: true,
    data: {
      issue: toRestIssue(created.issue),
      actor: appActorLabel(account),
      identitySource: account.identitySource,
    },
  };
}

/**
 * Demo-only Jira-shaped issue update: PUT /api/rest/api/3/issue/:key.
 *
 * Accepts the bounded `fields` subset (`summary`, `priority`, `assignee`,
 * `description`). Unknown fields, unknown keys and invalid values fail
 * closed with labelled demoOnly errors that write nothing. Status moves are
 * not part of this route: send `fields.status` and it is rejected with a
 * hint to use the transitions route instead. The deterministic `{fail:true}`
 * path writes nothing. Actor checks run first via `authorizeRestWrite`.
 */
export function restUpdateIssue(
  identity: AppRequestIdentity,
  key: string,
  body: RestUpdateIssueInput = {},
  options?: { bearer?: ReturnType<typeof validateOAuthBearer> | null },
): RestWriteResult<{ issue: ReturnType<typeof toRestIssue>; actor: ReturnType<typeof appActorLabel>; identitySource: AppIdentitySource }> {
  const authorized = authorizeRestWrite(identity, "update", options?.bearer ?? null);
  if (!authorized.ok) {
    return authorized;
  }
  const account = authorized.data;
  const parsed = readFieldsObject(body?.fields);
  if (!parsed.ok) {
    return { ok: false, statusCode: 400, error: parsed.error };
  }
  const raw = parsed.fields;
  const supported = new Set(["summary", "priority", "assignee", "description"]);
  if (raw["status"] !== undefined) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Unsupported demoOnly field `status` on this route: status moves use " +
        "POST /api/rest/api/3/issue/:key/transitions with a demo transition id. " +
        "Nothing was written.",
    };
  }
  const unsupported = Object.keys(raw).filter((name) => !supported.has(name));
  if (unsupported.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      error:
        `Unsupported demoOnly field(s): ${unsupported.join(", ")}. ` +
        `${REST_WRITE_FIELDS_LABEL} Nothing was written.`,
    };
  }
  if (Object.keys(raw).length === 0) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Nothing to save. Provide demo `fields` with summary, priority, assignee and/or description. " +
        "Nothing was written.",
    };
  }
  if (raw["summary"] !== undefined) {
    const summary = raw["summary"];
    if (typeof summary !== "string" || summary.trim() === "") {
      return {
        ok: false,
        statusCode: 400,
        error:
          "Invalid demoOnly `fields.summary`: expected a nonblank string. Nothing was written.",
      };
    }
  }
  let priority: DemoPriority | undefined;
  if (raw["priority"] !== undefined) {
    const name =
      typeof raw["priority"] === "object" && raw["priority"] !== null && !Array.isArray(raw["priority"])
        ? (raw["priority"] as Record<string, unknown>)["name"]
        : raw["priority"];
    const mapped = toStorePriorityName(name);
    if (!mapped) {
      return {
        ok: false,
        statusCode: 400,
        error:
          `Unknown priority. Allowed demo priorities: ${PRIORITIES.join(", ")}. Nothing was written.`,
      };
    }
    priority = mapped;
  }
  let assignee: string | undefined;
  if (raw["assignee"] !== undefined) {
    const mapped = extractAssigneeName(raw["assignee"]);
    if (mapped === null) {
      return {
        ok: false,
        statusCode: 400,
        error:
          "Invalid demoOnly `fields.assignee`: expected a nonblank string or an object with displayName/name/accountId. Nothing was written.",
      };
    }
    assignee = mapped;
  }
  let description: string | undefined;
  if (raw["description"] !== undefined) {
    const mapped = extractDescriptionText(raw["description"]);
    if (mapped === null) {
      return {
        ok: false,
        statusCode: 400,
        error:
          "Invalid demoOnly `fields.description`: expected a string or a Jira document object with text content. Nothing was written.",
      };
    }
    description = mapped;
  }
  const updated = updateIssue(
    key,
    {
      ...(raw["summary"] === undefined
        ? {}
        : { title: (raw["summary"] as string).trim() }),
      ...(priority === undefined ? {} : { priority }),
      ...(assignee === undefined ? {} : { assignee }),
      ...(description === undefined ? {} : { description }),
    },
    { fail: failFlag(body?.fail) },
  );
  if (!updated.ok) {
    return {
      ok: false,
      statusCode: updated.statusCode,
      error: updated.error,
      ...(updated.statusCode === 409 && updated.allowedFrom
        ? { allowedFrom: [...updated.allowedFrom] }
        : {}),
    };
  }
  return {
    ok: true,
    data: {
      issue: toRestIssue(updated.issue),
      actor: appActorLabel(account),
      identitySource: account.identitySource,
    },
  };
}

/**
 * Resolve the target status for a demo transition request. Accepts the
 * deterministic demo transition id (`demo-<kebab-status>` from the read
 * transitions route), the plain status name, or `{id}`/`{name}`/`{to.name}`
 * objects. Unknown ids fail closed with the allowed demo transition ids
 * named; nothing is written here.
 */
export function resolveRestTransitionTarget(
  key: string,
  transition: unknown,
): RestWriteResult<ObservedStatus> {
  const issue = getIssue(key);
  if (!issue) {
    return {
      ok: false,
      statusCode: 404,
      error: `Unknown issue key: ${key}. Demo-only REST write; nothing was written.`,
    };
  }
  const targets = isObservedStatus(issue.status)
    ? allowedTransitions(issue.status)
    : [];
  const allowedIds = targets.map((to) => toRestTransitionId(to));
  let candidate: string | null = null;
  if (typeof transition === "string") {
    candidate = transition.trim();
  } else if (typeof transition === "object" && transition !== null && !Array.isArray(transition)) {
    const record = transition as Record<string, unknown>;
    const nested =
      typeof record["to"] === "object" && record["to"] !== null && !Array.isArray(record["to"])
        ? (record["to"] as Record<string, unknown>)["name"]
        : undefined;
    for (const entry of [record["id"], record["name"], nested]) {
      if (typeof entry === "string" && entry.trim() !== "") {
        candidate = entry.trim();
        break;
      }
    }
  }
  if (candidate === null || candidate === "") {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Invalid demoOnly request: expected `transition` with an `id` from " +
        "GET /api/rest/api/3/issue/:key/transitions " +
        `(allowed demo transition id(s) from "${issue.status}": ${allowedIds.join(", ") || "none"}). ` +
        "Nothing was written.",
    };
  }
  const byId = targets.find((to) => toRestTransitionId(to) === candidate);
  if (byId) {
    return { ok: true, data: byId };
  }
  if (isObservedStatus(candidate)) {
    if (isDemoTransition(issue.status as ObservedStatus, candidate)) {
      return { ok: true, data: candidate };
    }
    return {
      ok: false,
      statusCode: 409,
      error:
        `Demo-only transition rejected: "${issue.status}" -> "${candidate}" is not in the demo matrix. ` +
        `Allowed demo target(s) from "${issue.status}": ${targets.join(", ")}. ` +
        `Allowed demo transition id(s): ${allowedIds.join(", ")}. ` +
        "Nothing was saved. This is a teaching guard, not verified Jira workflow parity.",
      allowedFrom: [...targets],
    };
  }
  return {
    ok: false,
    statusCode: 400,
    error:
      `Unknown demo transition id: "${candidate}". ` +
      `Allowed demo transition id(s) from "${issue.status}": ${allowedIds.join(", ") || "none"}. ` +
      "Nothing was written.",
  };
}

/**
 * Demo-only Jira-shaped transition: POST /api/rest/api/3/issue/:key/transitions.
 *
 * Moves one issue along the existing `DEMO_TRANSITIONS` matrix using the
 * deterministic demo transition ids from the read transitions route. Rejects
 * unknown keys, unknown transition ids and off-matrix moves without writing;
 * the deterministic `{fail:true}` path writes nothing. Actor checks run
 * first via `authorizeRestWrite`. Does not duplicate matrix logic: the
 * target resolves through the shared read helpers and the move applies via
 * the shared `updateIssue` store path.
 */
export function restTransitionIssue(
  identity: AppRequestIdentity,
  key: string,
  body: RestTransitionIssueInput = {},
  options?: { bearer?: ReturnType<typeof validateOAuthBearer> | null },
): RestWriteResult<{ issue: ReturnType<typeof toRestIssue>; transition: { id: string; name: string; to: { name: string } }; actor: ReturnType<typeof appActorLabel>; identitySource: AppIdentitySource }> {
  const authorized = authorizeRestWrite(identity, "update", options?.bearer ?? null);
  if (!authorized.ok) {
    return authorized;
  }
  const account = authorized.data;
  const target = resolveRestTransitionTarget(key, body?.transition);
  if (!target.ok) {
    return target;
  }
  const moved = updateIssue(key, { status: target.data }, { fail: failFlag(body?.fail) });
  if (!moved.ok) {
    return {
      ok: false,
      statusCode: moved.statusCode,
      error: moved.error,
      ...(moved.statusCode === 409 && moved.allowedFrom
        ? { allowedFrom: [...moved.allowedFrom] }
        : {}),
    };
  }
  return {
    ok: true,
    data: {
      issue: toRestIssue(moved.issue),
      transition: {
        id: toRestTransitionId(target.data),
        name: target.data,
        to: { name: target.data },
      },
      actor: appActorLabel(account),
      identitySource: account.identitySource,
    },
  };
}

/**
 * Demo-only Jira-shaped comment creation: POST /api/rest/api/3/issue/:key/comment.
 *
 * Accepts the Jira comment `body` (a plain string, the shape the demo sends)
 * and writes through the shared demo comment store. Unknown keys, blank
 * bodies and the deterministic `{fail:true}` path fail closed with labelled
 * demoOnly errors that write nothing. Actor checks run first via
 * `authorizeRestWrite`.
 */
export function restAddComment(
  identity: AppRequestIdentity,
  key: string,
  body: RestAddCommentInput = {},
  options?: { bearer?: ReturnType<typeof validateOAuthBearer> | null },
): RestWriteResult<{ comment: { id: string; body: string; author: { displayName: string }; created: string; demoOnly: true }; actor: ReturnType<typeof appActorLabel>; identitySource: AppIdentitySource }> {
  const authorized = authorizeRestWrite(identity, "comment", options?.bearer ?? null);
  if (!authorized.ok) {
    return authorized;
  }
  const account = authorized.data;
  const text =
    typeof body?.body === "string"
      ? body.body
      : extractDescriptionText(body?.body) ?? null;
  if (text === null || text.trim() === "") {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Invalid demoOnly request: a nonblank comment `body` string is required. Nothing was written.",
    };
  }
  const created = addComment(key, { body: text.trim() }, { fail: failFlag(body?.fail) });
  if (!created.ok) {
    return { ok: false, statusCode: created.statusCode, error: created.error };
  }
  return {
    ok: true,
    data: {
      comment: {
        id: created.comment.id,
        body: created.comment.body,
        author: { displayName: created.comment.author },
        created: created.comment.createdAt,
        demoOnly: true as const,
      },
      actor: appActorLabel(account),
      identitySource: account.identitySource,
    },
  };
}

/**
 * Resolve a demo OAuth bearer identity from an `Authorization` header for
 * the Jira-shaped HTTP routes. Returns null when no `Authorization` header
 * was sent (callers keep the existing Passport/demo resolution); otherwise
 * returns the bearer validation result, which callers enforce fail-closed
 * (an invalid bearer never falls through to the demo fallback).
 */
export function restBearerIdentity(
  authorization: unknown,
  issuerInput?: { envIssuer?: unknown; proto?: unknown; host?: unknown },
): ReturnType<typeof validateOAuthBearer> | null {
  if (typeof authorization !== "string" || authorization.trim() === "") {
    return null;
  }
  return validateOAuthBearer(
    authorization,
    resolveOAuthIssuer({
      envIssuer: issuerInput?.envIssuer ?? process.env.JIRA_OAUTH_ISSUER,
      proto: issuerInput?.proto,
      host: issuerInput?.host,
    }),
  );
}

/**
 * Shared OAuth bearer write gate for REST/MCP writes: the bearer
 * validation must succeed and the grant must carry the `write` scope (see
 * `authorizeOAuthBearerWrite`, which reuses the snapshotted viewer/member/
 * admin semantics). Callers run this before `authorizeRestWrite` when an
 * `Authorization` header is present; any bearer outcome (missing, invalid
 * or under-scoped) fails closed and never falls through to the demo
 * fallback.
 */
export function authorizeBearerWrite(
  bearer: ReturnType<typeof validateOAuthBearer> | null,
): RestWriteResult<AppAccount> {
  if (!bearer) {
    return {
      ok: false,
      statusCode: 401,
      error: "No demo OAuth bearer identity was provided. Nothing was written.",
    };
  }
  if (!bearer.ok) {
    return { ok: false, statusCode: bearer.statusCode, error: `${bearer.error} Nothing was written.` };
  }
  const checked = authorizeOAuthBearerWrite(bearer);
  if (!checked.ok) {
    return {
      ok: false,
      statusCode: checked.statusCode,
      error: `${checked.error} Nothing was written.`,
      account: bearer.account,
    };
  }
  return { ok: true, data: checked.account };
}

/**
 * Identity reader for the Jira-shaped HTTP write routes: only the trusted
 * `x-vercel-oidc-passport-token` header plus the existing explicit
 * `x-demo-user` fallback. Mirrors the native write routes exactly.
 */
export function restWriteIdentity(headers: {
  passportToken?: unknown;
  demoUser?: unknown;
  devUser?: unknown;
  nodeEnv?: unknown;
}): AppRequestIdentity {
  return {
    passportToken: headers.passportToken,
    demoUser: headers.demoUser,
    devUser: headers.devUser,
    nodeEnv: headers.nodeEnv,
  };
}

/**
 * Identity for the MCP write tools. MCP inputs cannot carry the raw
 * Passport header (it only exists on the HTTP request boundary), so the
 * tools accept the same explicit labelled `demoUser` fallback the REST
 * adapter reads accept. They never claim Passport auth: `identitySource` in
 * the result always reports `demoFallback`.
 */
export function mcpWriteIdentity(demoUser: unknown): AppRequestIdentity {
  return {
    passportToken: undefined,
    demoUser,
    devUser: undefined,
    nodeEnv: "test",
  };
}

