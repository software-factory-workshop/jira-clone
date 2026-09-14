import { computed, readonly, ref, watch } from "vue";
import {
  capabilitiesForAccount,
  type WorkspaceCapabilities,
  type WorkspaceRole,
} from "~/utils/roleAffordances";
import { serverMessage } from "~/utils/errorMessage";

export type DemoAccountOption = {
  id: string;
  label: string;
  role: WorkspaceRole;
  blurb: string;
};

export type IdentitySource = "passport" | "demoFallback";

export type MeResponse = {
  account: {
    id: string;
    label: string;
    displayName?: string | null;
    role: WorkspaceRole;
    canWrite?: boolean;
    canReset?: boolean;
    identitySource: IdentitySource;
    explicit: boolean;
  };
  identitySource: IdentitySource;
  explicit: boolean;
};

export const DEMO_ROLE_MATRIX_LABEL =
  "Demo-only role matrix: admin (read, write, reset) · member (read, write) · viewer (read-only).";

export const DEMO_ACCOUNT_OPTIONS: readonly DemoAccountOption[] = [
  { id: "demo-admin", label: "Demo Admin", role: "admin", blurb: "read, write, reset" },
  { id: "demo-member", label: "Demo Member", role: "member", blurb: "read, write" },
  { id: "demo-viewer", label: "Demo Viewer", role: "viewer", blurb: "read-only" },
];

const DEMO_USER_STORAGE_KEY = "adeo-demo-user";
const DEFAULT_DEMO_USER_ID = "demo-member";

function readStoredDemoUser(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(DEMO_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function knownDemoAccount(id: string): DemoAccountOption | undefined {
  return DEMO_ACCOUNT_OPTIONS.find((account) => account.id === id);
}

export function useDemoAccount() {
  const storedId = readStoredDemoUser();
  const initialId = knownDemoAccount(storedId ?? "")?.id ?? DEFAULT_DEMO_USER_ID;
  const initialAccount = knownDemoAccount(initialId) ?? DEMO_ACCOUNT_OPTIONS[1]!;

  const demoUserId = ref(initialId);
  const demoAccount = ref(initialAccount);
  const demoMeError = ref<string | null>(null);
  const meIdentitySource = ref<IdentitySource>("demoFallback");
  const meAccountId = ref(DEFAULT_DEMO_USER_ID);
  const meDisplayName = ref(initialAccount.label);
  const meRole = ref<WorkspaceRole>("member");
  const meCanWrite = ref(true);
  const meCanReset = ref(false);

  const workspaceCapabilities = computed<WorkspaceCapabilities>(() =>
    capabilitiesForAccount({
      role: meRole.value,
      canWrite: meCanWrite.value,
      canReset: meCanReset.value,
    }),
  );
  const canWrite = computed(() => workspaceCapabilities.value.canWrite);
  const canReset = computed(() => workspaceCapabilities.value.canReset);
  const readOnly = computed(() => workspaceCapabilities.value.readOnly);
  const demoAccountItems = DEMO_ACCOUNT_OPTIONS.map((account) => ({
    label: `${account.label} — ${account.role} · ${account.blurb}`,
    value: account.id,
  }));

  function demoHeaders(): Record<string, string> {
    return { "x-demo-user": demoUserId.value };
  }

  async function refreshAccount(): Promise<void> {
    demoMeError.value = null;
    try {
      const data = await $fetch<MeResponse>("/api/me", {
        headers: demoHeaders(),
      });
      meIdentitySource.value = data.identitySource;
      meAccountId.value = data.account.id;
      meDisplayName.value = data.account.displayName ?? data.account.label;
      meRole.value = data.account.role;
      const accountCapabilities = capabilitiesForAccount(data.account);
      meCanWrite.value = accountCapabilities.canWrite;
      meCanReset.value = accountCapabilities.canReset;

      // A Passport identity is authoritative and must not be replaced by a
      // synthetic switcher option. The fallback can safely mirror the
      // selected demo account for the header and explanatory copy.
      if (data.identitySource === "demoFallback") {
        const known = knownDemoAccount(data.account.id);
        if (known) demoAccount.value = known;
      }
    } catch (error) {
      demoMeError.value = serverMessage(
        error,
        "Could not load the demo account.",
      );
    }
  }

  function selectDemoAccount(id: string): void {
    const known = knownDemoAccount(id);
    if (!known) return;
    demoUserId.value = known.id;
  }

  watch(demoUserId, (next) => {
    const known = knownDemoAccount(next);
    if (known && meIdentitySource.value === "demoFallback") demoAccount.value = known;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(DEMO_USER_STORAGE_KEY, next);
      }
    } catch {
      // The selection is a demo-only preference; memory remains authoritative.
    }
    void refreshAccount();
  });

  return {
    demoUserId: readonly(demoUserId),
    demoAccount: readonly(demoAccount),
    demoAccountItems,
    demoMeError: readonly(demoMeError),
    meIdentitySource: readonly(meIdentitySource),
    meAccountId: readonly(meAccountId),
    meDisplayName: readonly(meDisplayName),
    meRole: readonly(meRole),
    workspaceCapabilities,
    canWrite,
    canReset,
    readOnly,
    refreshAccount,
    selectDemoAccount,
    demoHeaders,
  };
}
