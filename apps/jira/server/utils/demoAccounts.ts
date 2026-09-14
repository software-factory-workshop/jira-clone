/**
 * Demo-only synthetic accounts for the Jira teaching demo.
 *
 * This is a deterministic demo simulation that prepares the actor model for
 * later Passport/OAuth and REST/MCP work. It must not claim real
 * authentication or production authorization: there are no passwords,
 * tokens, sessions or durable accounts. The UI keeps the selected account
 * id in session storage and sends it as the `x-demo-user` request header;
 * the API routes remain the permission authority and label every decision
 * demo-only.
 *
 * Fixed role matrix for this slice:
 * - Demo admin: read all demo issues/comments, create and update issues,
 *   add comments, and reset the demo store.
 * - Demo member: read, create/update issues, and add comments; cannot reset.
 * - Demo viewer: read only; every create/update/comment/reset write returns
 *   403 and does not mutate state.
 * - Unknown or malformed `x-demo-user` is rejected with 401/400 before any
 *   write. Reads remain available as demo reads.
 */

export type DemoRole = "admin" | "member" | "viewer";

export type DemoAccount = {
  id: string;
  label: string;
  role: DemoRole;
  canWrite: boolean;
  canReset: boolean;
  demoOnly: true;
};

/** The three labelled synthetic demo accounts. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "demo-admin",
    label: "Demo Admin",
    role: "admin",
    canWrite: true,
    canReset: true,
    demoOnly: true,
  },
  {
    id: "demo-member",
    label: "Demo Member",
    role: "member",
    canWrite: true,
    canReset: false,
    demoOnly: true,
  },
  {
    id: "demo-viewer",
    label: "Demo Viewer",
    role: "viewer",
    canWrite: false,
    canReset: false,
    demoOnly: true,
  },
];

/**
 * Explicit default demo account used when no `x-demo-user` header is sent.
 * Demo Member can read and write but cannot reset, so the default keeps the
 * board editable while leaving the admin-only reset boundary visible.
 */
export const DEFAULT_DEMO_USER_ID = "demo-member";

/** Short matrix label shared by the UI and demoOnly API responses. */
export const DEMO_ROLE_MATRIX_LABEL =
  "Demo-only role matrix: admin (read, write, reset) · member (read, write) · viewer (read-only).";

/** Look up a synthetic account by id. Trims surrounding whitespace; anything else is not an account. */
export function lookupDemoAccount(id: unknown): DemoAccount | undefined {
  if (typeof id !== "string") {
    return undefined;
  }
  const normalized = id.trim();
  if (normalized === "") {
    return undefined;
  }
  return DEMO_ACCOUNTS.find((account) => account.id === normalized);
}

export type DemoActorResolution =
  | { ok: true; account: DemoAccount; explicit: boolean }
  | { ok: false; statusCode: 401 | 400 | 500; error: string };

/**
 * Resolve the demo actor from an `x-demo-user` header value.
 *
 * A missing header falls back to the explicit default account. A blank or
 * non-string value is malformed (400); a well-formed but unknown id is
 * rejected (401). Resolution never writes.
 */
export function resolveDemoActor(header: unknown): DemoActorResolution {
  if (header === undefined || header === null) {
    const fallback = lookupDemoAccount(DEFAULT_DEMO_USER_ID);
    if (!fallback) {
      return {
        ok: false,
        statusCode: 500,
        error:
          "Demo-only identity is misconfigured: the default demo account is unknown.",
      };
    }
    return { ok: true, account: fallback, explicit: false };
  }
  if (typeof header !== "string" || header.trim() === "") {
    return {
      ok: false,
      statusCode: 400,
      error: `Malformed demo identity. Send one of: ${DEMO_ACCOUNTS.map((account) => account.id).join(", ")}. ${DEMO_ROLE_MATRIX_LABEL}`,
    };
  }
  const account = lookupDemoAccount(header);
  if (!account) {
    return {
      ok: false,
      statusCode: 401,
      error: `Unknown demo identity "${header.trim()}". Send one of: ${DEMO_ACCOUNTS.map((account) => account.id).join(", ")}. ${DEMO_ROLE_MATRIX_LABEL}`,
    };
  }
  return { ok: true, account, explicit: true };
}

export type DemoWriteAction = "create" | "update" | "comment" | "delete" | "reset";

const ACTION_VERBS: Record<DemoWriteAction, string> = {
  create: "create issues",
  update: "update issues",
  comment: "add comments",
  delete: "delete issues",
  reset: "reset the demo store",
};

export type DemoAuthorization =
  | { ok: true; account: DemoAccount }
  | {
      ok: false;
      statusCode: 401 | 400 | 403 | 500;
      error: string;
      account?: DemoAccount;
    };

/**
 * Authorize a demo write for the resolved actor. Identity failures (401/400)
 * come first; viewer writes and non-admin resets are denied with 403. A
 * denial must never mutate state: routes return before touching the store.
 */
export function authorizeDemoWrite(
  header: unknown,
  action: DemoWriteAction,
): DemoAuthorization {
  const resolved = resolveDemoActor(header);
  if (!resolved.ok) {
    return resolved;
  }
  const { account } = resolved;
  if (action === "reset") {
    if (!account.canReset) {
      return {
        ok: false,
        statusCode: 403,
        account,
        error:
          `Demo-only permission denied: ${account.label} (${account.role}) cannot reset the demo store. ` +
          `This write was rejected and changed nothing. Switch to Demo Admin to reset. ${DEMO_ROLE_MATRIX_LABEL}`,
      };
    }
    return { ok: true, account };
  }
  if (!account.canWrite) {
    return {
      ok: false,
      statusCode: 403,
      account,
      error:
        `Demo-only permission denied: ${account.label} (${account.role}) cannot ${ACTION_VERBS[action]}. ` +
        `This write was rejected and changed nothing. Switch to Demo Member or Demo Admin to write. ${DEMO_ROLE_MATRIX_LABEL}`,
    };
  }
  return { ok: true, account };
}

/** Small actor label for demoOnly API responses and permission errors. */
export function actorLabel(account: DemoAccount): {
  id: string;
  label: string;
  role: DemoRole;
} {
  return { id: account.id, label: account.label, role: account.role };
}
