/**
 * Role-to-affordance mapping for the Jira demo workspace.
 *
 * The API remains the final authorization authority; this module only derives
 * the already loaded `/api/me` capability (`canWrite`/`canReset`) into clear
 * UI affordances so the existing role matrix is visible before a mutation is
 * attempted. Reads, search, filters, issue detail and draft-safe messaging
 * stay available for every role.
 *
 * Matrix semantics (mirrors `server/utils/demoAccounts.ts`):
 * - admin: read, write, reset.
 * - member: read, write; cannot reset.
 * - viewer: read-only; every mutation affordance is unavailable.
 */

export type WorkspaceRole = "admin" | "member" | "viewer";

export type MutationKind = "create" | "update" | "comment" | "reset";

export type WorkspaceCapabilities = {
  canWrite: boolean;
  canReset: boolean;
  /** True when no mutation affordance is available (viewer). */
  readOnly: boolean;
};

export type MeCapabilityAccount = {
  role?: unknown;
  canWrite?: unknown;
  canReset?: unknown;
} | null | undefined;

/** Capabilities for a known role string; unknown roles fail closed to read-only. Pure; never writes. */
export function capabilitiesForRole(role: unknown): WorkspaceCapabilities {
  if (role === "admin") {
    return { canWrite: true, canReset: true, readOnly: false };
  }
  if (role === "member") {
    return { canWrite: true, canReset: false, readOnly: false };
  }
  return { canWrite: false, canReset: false, readOnly: true };
}

/**
 * Capabilities for an already loaded `/api/me` account. Explicit boolean
 * `canWrite`/`canReset` fields win; otherwise the role mapping applies.
 * Missing accounts fail closed to read-only. Pure; never writes.
 */
export function capabilitiesForAccount(account: MeCapabilityAccount): WorkspaceCapabilities {
  if (!account || typeof account !== "object") {
    return capabilitiesForRole(undefined);
  }
  const fallback = capabilitiesForRole(account.role);
  const canWrite =
    typeof account.canWrite === "boolean" ? account.canWrite : fallback.canWrite;
  const canReset =
    typeof account.canReset === "boolean" ? account.canReset : fallback.canReset;
  return { canWrite, canReset, readOnly: !canWrite };
}

/** Whether the UI may invoke a mutation kind for these capabilities. Pure; never writes. */
export function canInvokeMutation(kind: MutationKind, capabilities: WorkspaceCapabilities): boolean {
  if (kind === "reset") {
    return capabilities.canReset;
  }
  return capabilities.canWrite;
}

/** Accessible explanation used wherever a mutation affordance is unavailable. */
export function readOnlyMutationHint(kind: MutationKind): string {
  if (kind === "reset") {
    return "Only Demo Admin can reset the demo board. This workspace is read-only for your role.";
  }
  return "This workspace is read-only for your role. Switch to Demo Member or Demo Admin to write.";
}
