/**
 * Shared request-to-application-account resolver: the single authority for
 * demo identity in the ADEO Jira demo.
 *
 * Two identity sources, one account shape:
 * - `passport`: a present Vercel Passport identity (trusted
 *   `x-vercel-oidc-passport-token` header decoded by `./passportIdentity`,
 *   verified by the platform). The stable account id is derived only from
 *   `external_sub` (`passport:<external_sub>`); the role comes from an
 *   explicit claims/groups mapping (admin/member/viewer, documented default
 *   below). Accounts are never keyed by email.
 * - `demoFallback`: the existing labelled synthetic `x-demo-user` matrix
 *   from `./demoAccounts`, preserved so the local workshop still runs when
 *   no Passport identity is present.
 *
 * Passport role mapping (explicit, least-privilege default):
 * - An explicit `role` claim of `admin`, `member` or `viewer`
 *   (case-insensitive) wins. Any other non-empty `role` value is
 *   unrecognised and fails closed with 401.
 * - Otherwise the `groups` (or `roles`) claim is scanned: any admin-group
 *   token maps to admin, else any member-group token maps to member, else
 *   any viewer-group token maps to viewer. A non-empty groups claim with no
 *   recognised token fails closed with 401.
 * - A Passport identity with no role/groups claims defaults to `viewer`
 *   (read-only). This default is documented here and in
 *   `PASSPORT_ROLE_MAPPING_LABEL`.
 *
 * Matrix semantics match the demo matrix exactly: admin can reset; member
 * can create/update/comment but cannot reset; viewer is read-only. A present
 * but malformed or unrecognised Passport identity fails closed before any
 * mutation and never falls back to a synthetic account. The raw token is
 * never returned, logged, or sent to the browser.
 *
 * Deployment prerequisite (external): Vercel Passport deployment protection
 * is managed outside this demo and is not enabled by this code; without that
 * platform protection there is no trusted Passport header to read.
 */

import {
  DEMO_ROLE_MATRIX_LABEL,
  resolveDemoActor,
  type DemoAccount,
  type DemoRole,
  type DemoWriteAction,
} from "./demoAccounts.ts";
import {
  PASSPORT_DEPLOYMENT_NOTE,
  readPassportIdentity,
  type PassportClaims,
} from "./passportIdentity.ts";

export type AppIdentitySource = "passport" | "demoFallback";

/** Documented default role for Passport identities without role/groups claims. */
export const PASSPORT_DEFAULT_ROLE: DemoRole = "viewer";

/** Shared label describing the explicit Passport claims/groups -> role mapping. */
export const PASSPORT_ROLE_MAPPING_LABEL =
  "Passport role mapping: explicit role claim (admin/member/viewer) wins; " +
  "otherwise groups/roles map admin-like groups to admin, member-like groups to member, " +
  "viewer-like groups to viewer; identities without role/groups claims default to viewer (read-only). " +
  "Unrecognised role/groups values fail closed with 401.";

export const PASSPORT_ACCOUNT_ID_PREFIX = "passport:";

export type AppAccount = {
  id: string;
  label: string;
  role: DemoRole;
  canWrite: boolean;
  canReset: boolean;
  demoOnly: true;
  identitySource: AppIdentitySource;
  /** Stable platform subject for passport accounts; null for the demo fallback. */
  externalSub: string | null;
  email: string | null;
  displayName: string | null;
  /** True only for the non-production PASSPORT_DEV_USER stand-in. */
  dev: boolean;
  /** True when the caller explicitly selected this identity (header present). */
  explicit: boolean;
};

export type AppRequestIdentity = {
  /** Raw `x-vercel-oidc-passport-token` header value. */
  passportToken?: unknown;
  /** Raw `x-demo-user` header value (local/demo fallback only). */
  demoUser?: unknown;
  /** Raw `PASSPORT_DEV_USER` value; honoured only outside production. */
  devUser?: unknown;
  /** `process.env.NODE_ENV` from the caller; tests pass this explicitly. */
  nodeEnv?: unknown;
};

export type AppActorResolution =
  | { ok: true; account: AppAccount }
  | {
      ok: false;
      statusCode: 401 | 400 | 500;
      error: string;
      identitySource?: AppIdentitySource;
    };

export type AppAuthorization =
  | { ok: true; account: AppAccount }
  | {
      ok: false;
      statusCode: 401 | 400 | 403 | 500;
      error: string;
      account?: AppAccount;
    };

const ADMIN_GROUP_TOKENS = new Set([
  "admin",
  "admins",
  "administrator",
  "administrators",
  "jira-admin",
  "jira-admins",
  "jira-administrator",
  "jira-administrators",
  "adeo-admin",
  "adeo-admins",
]);

const MEMBER_GROUP_TOKENS = new Set([
  "member",
  "members",
  "user",
  "users",
  "developer",
  "developers",
  "editor",
  "editors",
  "contributor",
  "contributors",
  "jira-user",
  "jira-users",
  "jira-member",
  "jira-members",
  "jira-developer",
  "jira-developers",
]);

const VIEWER_GROUP_TOKENS = new Set([
  "viewer",
  "viewers",
  "reader",
  "readers",
  "guest",
  "guests",
  "jira-viewer",
  "jira-viewers",
  "jira-reader",
  "jira-readers",
  "jira-guest",
]);

function recognizedRole(value: unknown): DemoRole | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "member" || normalized === "viewer") {
    return normalized;
  }
  return null;
}

function collectClaimTokens(claims: PassportClaims, names: string[]): string[] {
  const tokens: string[] = [];
  for (const name of names) {
    const value = claims[name];
    if (typeof value === "string") {
      for (const part of value.split(/[\s,]+/)) {
        const trimmed = part.trim();
        if (trimmed !== "") {
          tokens.push(trimmed);
        }
      }
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim() !== "") {
          tokens.push(entry.trim());
        }
      }
    }
  }
  return tokens;
}

type RoleMapResult =
  | { ok: true; role: DemoRole }
  | { ok: false; error: string };

/**
 * Map Passport claims to a demo role. Pure; never writes. An explicit,
 * non-empty `role` claim must be recognised; otherwise recognised
 * groups/roles tokens decide; empty role/groups fall back to the documented
 * viewer default. Anything present-but-unrecognised fails closed.
 */
export function mapPassportRole(claims: PassportClaims): RoleMapResult {
  const roleTokens = collectClaimTokens(claims, ["role"]);
  const explicitRole = roleTokens.find((token) => token !== "");
  if (explicitRole !== undefined) {
    const role = recognizedRole(explicitRole);
    if (!role) {
      return {
        ok: false,
        error:
          `Unrecognised Passport identity: role \"${explicitRole}\" is not admin, member or viewer. ` +
          `No account was derived and nothing was written. ${PASSPORT_ROLE_MAPPING_LABEL}`,
      };
    }
    return { ok: true, role };
  }
  const groupTokens = collectClaimTokens(claims, ["groups", "roles"]);
  if (groupTokens.length === 0) {
    return { ok: true, role: PASSPORT_DEFAULT_ROLE };
  }
  const lowered = groupTokens.map((token) => token.toLowerCase());
  if (lowered.some((token) => ADMIN_GROUP_TOKENS.has(token))) {
    return { ok: true, role: "admin" };
  }
  if (lowered.some((token) => MEMBER_GROUP_TOKENS.has(token))) {
    return { ok: true, role: "member" };
  }
  if (lowered.some((token) => VIEWER_GROUP_TOKENS.has(token))) {
    return { ok: true, role: "viewer" };
  }
  return {
    ok: false,
    error:
      `Unrecognised Passport identity: groups \"${groupTokens.join(", ")}\" map to no demo role (admin/member/viewer). ` +
      `No account was derived and nothing was written. ${PASSPORT_ROLE_MAPPING_LABEL}`,
  };
}

/** Stable account id derived only from the platform subject; never email. */
export function passportAccountId(externalSub: string): string {
  return `${PASSPORT_ACCOUNT_ID_PREFIX}${externalSub}`;
}

function passportLabel(
  externalSub: string,
  displayName: string | null,
  email: string | null,
): string {
  if (displayName) {
    return displayName;
  }
  if (email) {
    return email;
  }
  const short = externalSub.length > 12 ? `${externalSub.slice(0, 12)}…` : externalSub;
  return `Passport user ${short}`;
}

function roleCapabilities(role: DemoRole): { canWrite: boolean; canReset: boolean } {
  return {
    canWrite: role === "admin" || role === "member",
    canReset: role === "admin",
  };
}

function demoAccountToAppAccount(account: DemoAccount, explicit: boolean): AppAccount {
  return {
    id: account.id,
    label: account.label,
    role: account.role,
    canWrite: account.canWrite,
    canReset: account.canReset,
    demoOnly: true,
    identitySource: "demoFallback",
    externalSub: null,
    email: null,
    displayName: account.label,
    dev: false,
    explicit,
  };
}

/**
 * Resolve one request to its application account. A present Passport
 * identity takes precedence and is mapped through the explicit role mapping;
 * a present-but-invalid Passport identity fails closed without falling back.
 * When no Passport identity is present, the labelled synthetic `x-demo-user`
 * fallback applies (explicit default, 401 unknown, 400 malformed). Pure;
 * never writes and never exposes the raw token.
 */
export function resolveAppActor(input: AppRequestIdentity): AppActorResolution {
  const passport = readPassportIdentity({
    token: input.passportToken,
    devUser: input.devUser,
    nodeEnv: input.nodeEnv,
  });
  if (passport.present) {
    if (!passport.ok) {
      return {
        ok: false,
        statusCode: passport.statusCode,
        error: passport.error,
        identitySource: "passport",
      };
    }
    const mapped = mapPassportRole(passport.identity.claims);
    if (!mapped.ok) {
      return {
        ok: false,
        statusCode: 401,
        error: mapped.error,
        identitySource: "passport",
      };
    }
    const { role } = mapped;
    const capabilities = roleCapabilities(role);
    return {
      ok: true,
      account: {
        id: passportAccountId(passport.identity.externalSub),
        label: passportLabel(
          passport.identity.externalSub,
          passport.identity.displayName,
          passport.identity.email,
        ),
        role,
        canWrite: capabilities.canWrite,
        canReset: capabilities.canReset,
        demoOnly: true,
        identitySource: "passport",
        externalSub: passport.identity.externalSub,
        email: passport.identity.email,
        displayName: passport.identity.displayName,
        dev: passport.identity.dev,
        explicit: true,
      },
    };
  }
  const fallback = resolveDemoActor(input.demoUser);
  if (!fallback.ok) {
    return { ...fallback, identitySource: "demoFallback" };
  }
  return {
    ok: true,
    account: demoAccountToAppAccount(fallback.account, fallback.explicit),
  };
}

const ACTION_VERBS: Record<DemoWriteAction, string> = {
  create: "create issues",
  update: "update issues",
  comment: "add comments",
  reset: "reset the demo store",
};

function sourceNote(account: AppAccount): string {
  return account.identitySource === "passport"
    ? `Acting as Passport identity \"${account.id}\" (${account.role}). ${PASSPORT_DEPLOYMENT_NOTE}`
    : `Acting as ${account.label} (${account.role}). ${DEMO_ROLE_MATRIX_LABEL}`;
}

/**
 * Authorize a demo write for the resolved application account. Identity
 * failures (401/400) come first; viewer writes and non-admin resets are
 * denied with 403. A denial must never mutate state: routes return before
 * touching the store.
 */
export function authorizeAppWrite(
  input: AppRequestIdentity,
  action: DemoWriteAction,
): AppAuthorization {
  const resolved = resolveAppActor(input);
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
          `This write was rejected and changed nothing. ${sourceNote(account)}`,
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
        `This write was rejected and changed nothing. ${sourceNote(account)}`,
    };
  }
  return { ok: true, account };
}

/** Small actor label for demoOnly API responses and permission errors. */
export function appActorLabel(account: AppAccount): {
  id: string;
  label: string;
  role: DemoRole;
  identitySource: AppIdentitySource;
} {
  return {
    id: account.id,
    label: account.label,
    role: account.role,
    identitySource: account.identitySource,
  };
}

/** Labels are owned by their source modules; routes import them directly. */
