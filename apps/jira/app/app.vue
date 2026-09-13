<script setup lang="ts">
import {
  fetchIssueComments,
  submitIssueComment,
  type DemoComment,
  type IssueCommentsResponse,
} from "~/utils/issueComments";
import {
  failedDetail,
  fetchIssueDetail,
  loadedDetail,
  type IssueDetailResponse,
} from "~/utils/issueDetail";
import {
  fetchBoardIssues,
  type RestSearchShape,
} from "~/utils/restIssues";
import {
  ALL_ASSIGNEES,
  OBSERVED_STATUSES,
  PRIORITIES,
  allowedMoveHint,
  assigneeOptions,
  changePriority,
  columnIssues,
  filterIssues,
  moveIssue,
  moveTargets,
  type BoardIssue,
} from "~/utils/boardMove";

const config = useRuntimeConfig();
function demoErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const message = (error as { data?: { message?: unknown } }).data?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}


const DEMO_USER_STORAGE_KEY = "adeo-demo-user";
const DEFAULT_DEMO_USER_ID = "demo-member";
const DEMO_ROLE_MATRIX_LABEL =
  "Demo-only role matrix: admin (read, write, reset) · member (read, write) · viewer (read-only).";
type DemoAccountOption = {
  id: string;
  label: string;
  role: "admin" | "member" | "viewer";
  blurb: string;
};
const DEMO_ACCOUNT_OPTIONS: DemoAccountOption[] = [
  { id: "demo-admin", label: "Demo Admin", role: "admin", blurb: "read, write, reset" },
  { id: "demo-member", label: "Demo Member", role: "member", blurb: "read, write" },
  { id: "demo-viewer", label: "Demo Viewer", role: "viewer", blurb: "read-only" },
];
const demoUserId = ref(DEFAULT_DEMO_USER_ID);
const demoAccount = ref<DemoAccountOption>(DEMO_ACCOUNT_OPTIONS[1]!);
const demoMeError = ref<string | null>(null);
/** Resolved account display from /api/me: passport-derived identity when present, else the synthetic fallback. */
const meIdentitySource = ref<"passport" | "demoFallback">("demoFallback");
const meAccountId = ref<string>(DEFAULT_DEMO_USER_ID);
const meDisplayName = ref<string>(DEMO_ACCOUNT_OPTIONS[1]!.label);
const meRole = ref<DemoAccountOption["role"]>("member");
const meIsFallback = computed(() => meIdentitySource.value === "demoFallback");
const demoAccountItems = DEMO_ACCOUNT_OPTIONS.map((account) => ({
  label: `${account.label} — ${account.role} · ${account.blurb}`,
  value: account.id,
}));
function demoHeaders(): Record<string, string> {
  return { "x-demo-user": demoUserId.value };
}
function readStoredDemoUser(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(DEMO_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}
type MeResponse = {
  account: {
    id: string;
    label: string;
    displayName?: string | null;
    role: DemoAccountOption["role"];
    identitySource: "passport" | "demoFallback";
    explicit: boolean;
  };
  identitySource: "passport" | "demoFallback";
  explicit: boolean;
};
async function loadMe() {
  demoMeError.value = null;
  try {
    const data = await $fetch<MeResponse>("/api/me", { headers: demoHeaders() });
    meIdentitySource.value = data.identitySource;
    meAccountId.value = data.account.id;
    meDisplayName.value = data.account.displayName ?? data.account.label;
    meRole.value = data.account.role;
    // The synthetic switcher only drives the explicit local/demo fallback:
    // a Passport-derived identity keeps its own display and never maps onto
    // the synthetic options.
    if (data.identitySource === "demoFallback") {
      const known = DEMO_ACCOUNT_OPTIONS.find((option) => option.id === data.account.id);
      if (known) demoAccount.value = known;
    }
  } catch (error) {
    demoMeError.value =
      error instanceof Error ? error.message : "Could not load the demo account.";
  }
}
try {
  const stored = readStoredDemoUser();
  if (stored && DEMO_ACCOUNT_OPTIONS.some((option) => option.id === stored)) {
    demoUserId.value = stored;
    const known = DEMO_ACCOUNT_OPTIONS.find((option) => option.id === stored);
    if (known) demoAccount.value = known;
  }
} catch {
  // Session-scoped demo selection stays on the default when storage is unavailable.
}
watch(demoUserId, (next) => {
  const known = DEMO_ACCOUNT_OPTIONS.find((option) => option.id === next);
  if (known && meIsFallback.value) demoAccount.value = known;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(DEMO_USER_STORAGE_KEY, next);
    }
  } catch {
    // Demo-only preference; storage failures keep the in-memory selection.
  }
  void loadMe();
});
const view = ref("list");
const search = ref("");
const status = ref("All statuses");
const assignee = ref(ALL_ASSIGNEES);
const statuses: string[] = [...OBSERVED_STATUSES];
const priorities: string[] = [...PRIORITIES];
const selectedKey = ref<string | null>(null);
const detailIssue = ref<BoardIssue | null>(null);
const detailLoading = ref(false);
const detailError = ref<string | null>(null);
const detailDemoOnly = ref(false);
const comments = ref<DemoComment[]>([]);
const commentsLoading = ref(false);
const commentsError = ref<string | null>(null);
const commentsDemoOnly = ref(false);
const commentDraft = ref("");
const commentSaving = ref(false);
const commentError = ref<string | null>(null);
const issues = ref<BoardIssue[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const moveError = ref<string | null>(null);
const priorityError = ref<string | null>(null);
const saveNotice = ref<string | null>(null);
const pendingKeys = ref<string[]>([]);
const draggedKey = ref<string | null>(null);
const dropColumn = ref<string | null>(null);

const assignees = computed(() => assigneeOptions(issues.value));

const selected = computed(() => detailIssue.value);
const selectedTargets = computed(() =>
  selected.value ? moveTargets(statuses, selected.value.status) : [],
);
const selectedTarget = ref("");
const selectedPriority = ref("");
const createOpen = ref(false);
const createSaving = ref(false);
const createError = ref<string | null>(null);
const draftTitle = ref("");
const draftType = ref("Task");
const draftStatus = ref("To Do");
const draftPriority = ref("Medium");
const draftAssignee = ref("Unassigned");
const draftDescription = ref("");
const createTypes = ["Story", "Task", "Bug"];

watch(selected, (issue) => {
  selectedTarget.value = issue ? moveTargets(statuses, issue.status)[0] ?? "" : "";
  selectedPriority.value = issue ? issue.priority : "";
});

async function loadDetail(key: string) {
  detailLoading.value = true;
  try {
    const result = await fetchIssueDetail(key, (url) =>
      $fetch<IssueDetailResponse>(url),
    );
    if (selectedKey.value !== key) return;
    const loaded = loadedDetail(result);
    detailIssue.value = loaded.issue;
    detailDemoOnly.value = loaded.demoOnly;
    detailError.value = loaded.error;
  } catch (error) {
    if (selectedKey.value !== key) return;
    const failed = failedDetail(error);
    detailIssue.value = failed.issue;
    detailDemoOnly.value = failed.demoOnly;
    detailError.value = failed.error;
  } finally {
    if (selectedKey.value === key) detailLoading.value = false;
  }
}

async function loadComments(key: string) {
  commentsLoading.value = true;
  try {
    const result = await fetchIssueComments(key, (url) =>
      $fetch<IssueCommentsResponse>(url),
    );
    if (selectedKey.value !== key) return;
    comments.value = result.comments;
    commentsDemoOnly.value = result.demoOnly;
    commentsError.value = null;
  } catch (error) {
    if (selectedKey.value !== key) return;
    comments.value = [];
    commentsDemoOnly.value = false;
    commentsError.value = demoErrorMessage(
      error,
      "Could not load demo comments.",
    );
  } finally {
    if (selectedKey.value === key) commentsLoading.value = false;
  }
}

async function postComment() {
  if (!selectedKey.value || commentSaving.value) return;
  const key = selectedKey.value;
  commentError.value = null;
  commentSaving.value = true;
  try {
    const result = await submitIssueComment(
      comments.value,
      commentDraft.value,
      async (body) => {
        const saved = await $fetch<{ comment: DemoComment }>(
          `/api/issues/${key}/comments`,
          { method: "POST", body: { body }, headers: demoHeaders() },
        );
        return saved.comment;
      },
    );
    if (selectedKey.value !== key) return;
    comments.value = result.comments;
    commentDraft.value = result.draft;
    commentError.value = result.ok ? null : result.error;
  } finally {
    if (selectedKey.value === key) commentSaving.value = false;
  }
}

watch(selectedKey, (key) => {
  detailIssue.value = null;
  detailDemoOnly.value = false;
  detailError.value = null;
  detailLoading.value = false;
  comments.value = [];
  commentsDemoOnly.value = false;
  commentsError.value = null;
  commentsLoading.value = false;
  commentDraft.value = "";
  commentError.value = null;
  commentSaving.value = false;
  if (key) {
    void loadDetail(key);
    void loadComments(key);
  }
});

const filtered = computed(() =>
  filterIssues(issues.value, {
    search: search.value,
    status: status.value,
    assignee: assignee.value,
  }),
);

async function saveStatus(
  key: string,
  next: string,
  fail = false,
): Promise<BoardIssue> {
  const saved = await $fetch<{ issue: BoardIssue }>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { status: next, ...(fail ? { fail: true } : {}) },
    headers: demoHeaders(),
  });
  return saved.issue;
}

async function savePriority(key: string, next: string): Promise<BoardIssue> {
  const saved = await $fetch<{ issue: BoardIssue }>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { priority: next },
    headers: demoHeaders(),
  });
  return saved.issue;
}

async function refresh() {
  loading.value = true;
  loadError.value = null;
  try {
    const data = await fetchBoardIssues((url) =>
      $fetch<RestSearchShape>(url),
    );
    issues.value = data.issues;
  } catch (error) {
    issues.value = [];
    loadError.value = demoErrorMessage(
      error,
      "Could not load board issues through the REST search read.",
    );
  } finally {
    loading.value = false;
  }
}

async function moveCard(key: string, toStatus: string) {
  if (pendingKeys.value.includes(key)) return;
  pendingKeys.value = [...pendingKeys.value, key];
  moveError.value = null;
  saveNotice.value = null;
  const before = selectedKey.value;
  const result = await moveIssue(issues.value, key, toStatus, (k, next) =>
    saveStatus(k, next),
  );
  issues.value = result.issues;
  if (result.ok) {
    saveNotice.value = `Demo-only save: ${key} moved to ${toStatus}. Reload to confirm it persists on this server.`;
  } else {
    moveError.value = result.error;
  }
  selectedKey.value = before;
  if (selectedKey.value === key && result.ok) void loadDetail(key);
  pendingKeys.value = pendingKeys.value.filter((pending) => pending !== key);
}

async function changePriorityCard(key: string, next: string) {
  if (pendingKeys.value.includes(key)) return;
  pendingKeys.value = [...pendingKeys.value, key];
  priorityError.value = null;
  saveNotice.value = null;
  const before = selectedKey.value;
  const result = await changePriority(issues.value, key, next, (k, priority) =>
    savePriority(k, priority),
  );
  issues.value = result.issues;
  if (result.ok) {
    saveNotice.value = `Demo-only save: ${key} priority set to ${next}. Reload to confirm it persists on this server.`;
  } else {
    priorityError.value = result.error;
  }
  selectedKey.value = before;
  if (selectedKey.value === key && result.ok) void loadDetail(key);
  pendingKeys.value = pendingKeys.value.filter((pending) => pending !== key);
}

function onDragStart(event: DragEvent, key: string) {
  draggedKey.value = key;
  dropColumn.value = null;
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", key);
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragEnd() {
  draggedKey.value = null;
  dropColumn.value = null;
}

function onDropColumn(toStatus: string) {
  const key = draggedKey.value;
  dropColumn.value = null;
  draggedKey.value = null;
  if (key) void moveCard(key, toStatus);
}

function openCreate() {
  createError.value = null;
  createOpen.value = true;
}

function closeCreate() {
  if (!createSaving.value) {
    createOpen.value = false;
  }
}

async function createCard() {
  if (createSaving.value) return;
  createError.value = null;
  saveNotice.value = null;
  if (draftTitle.value.trim() === "") {
    createError.value = "A nonblank demo title is required.";
    return;
  }
  createSaving.value = true;
  try {
    const saved = await $fetch<{ issue: BoardIssue }>("/api/issues", {
      method: "POST",
      headers: demoHeaders(),
      body: {
        title: draftTitle.value.trim(),
        type: draftType.value,
        status: draftStatus.value,
        priority: draftPriority.value,
        assignee: draftAssignee.value.trim() === "" ? "Unassigned" : draftAssignee.value.trim(),
        description: draftDescription.value,
      },
    });
    issues.value = [...issues.value, saved.issue];
    createOpen.value = false;
    draftTitle.value = "";
    draftType.value = "Task";
    draftStatus.value = "To Do";
    draftPriority.value = "Medium";
    draftAssignee.value = "Unassigned";
    draftDescription.value = "";
    saveNotice.value = `Demo-only create: ${saved.issue.key} added. Reload to confirm it persists on this server.`;
  } catch (error) {
    createError.value = demoErrorMessage(error, "Demo create failed.");
  } finally {
    createSaving.value = false;
  }
}

async function resetBoard() {
  moveError.value = null;
  priorityError.value = null;
  saveNotice.value = null;
  try {
    await $fetch("/api/issues/reset", {
      method: "POST",
      headers: demoHeaders(),
    });
    await refresh();
    if (!loadError.value) {
      saveNotice.value =
        "Demo board reset to labelled fixture identities. Reset only affects this demo-only store.";
    }
  } catch (error) {
    moveError.value = demoErrorMessage(error, "Demo reset failed.");
  }
}

function cardMoveLabel(issue: BoardIssue) {
  return `Move ${issue.key} to another column`;
}

function priorityLabel(issue: BoardIssue) {
  return `Change priority for ${issue.key}`;
}

await loadMe();
await refresh();
</script>
<template>
  <UApp
    ><div class="jira-shell">
      <header class="jira-header">
        <a class="brand" href="/">ADEO</a
        ><span class="product-name">Jira workspace</span
        ><UBadge color="neutral" variant="subtle">Stage-zero shell</UBadge>
        <div class="demo-account-switcher">
          <UBadge v-if="meIdentitySource === 'passport'" color="primary" variant="soft">Passport identity</UBadge>
          <UBadge v-else color="warning" variant="soft">Demo-only identity</UBadge>
          <span v-if="meIdentitySource === 'passport'" class="demo-account-passport" role="status">
            {{ meDisplayName }} · {{ meRole }}
          </span>
          <USelect
            v-else
            v-model="demoUserId"
            :items="demoAccountItems"
            value-key="value"
            aria-label="Demo account"
            size="sm"
            class="demo-account-select"
          />
          <UBadge color="neutral" variant="subtle"
            >{{ meIdentitySource === "passport" ? `${meDisplayName} · ${meRole}` : `${demoAccount.label} · ${demoAccount.role}` }}</UBadge
          >
        </div>
        <UButton
          :to="config.public.factoryUrl"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-up-right"
          >Open factory cockpit</UButton
        >
      </header>
      <div class="jira-body">
        <aside class="project-sidebar">
          <div class="project-avatar">A</div>
          <h2>ADEO demo</h2>
          <p>Software project</p>
          <nav aria-label="Project views">
            <button :class="{ active: view === 'list' }" @click="view = 'list'">
              <UIcon name="i-lucide-list" />List</button
            ><button
              :class="{ active: view === 'board' }"
              @click="view = 'board'"
            >
              <UIcon name="i-lucide-columns-3" />Board
            </button>
          </nav>
          <div class="sidebar-note">
            <UIcon name="i-lucide-sprout" />
            <p>
              The factory will grow this workspace one capability at a time.
            </p>
          </div>
        </aside>
        <main class="jira-main">
          <div class="breadcrumb">Projects / ADEO demo</div>
          <AdeoPageHeader
            :title="view === 'list' ? 'Issue list' : 'Kanban board'"
            description="A recognizable starting point, ready to shape together."
          />
          <div class="fixture-notice">
            <UIcon name="i-lucide-info" />
            <p>
              <strong>Synthetic demo data.</strong> Review the layout and open
              an issue. Status moves and priority edits use a labelled
              <strong>demo-only save path</strong>: they persist across reload
              on this server and reset on redeploy. Status moves follow a
              fixed <strong>demo-only transition matrix</strong> (To Do →
              In Progress → In Review → Done → To Do); other moves are
              rejected and save nothing. <span v-if="meIdentitySource === 'passport'">Acting as
              <strong>{{ meDisplayName }} ({{ meRole }})</strong
              > via the platform Passport identity (<strong>{{ meAccountId }}</strong
              >); Passport deployment protection is an external prerequisite
              and this demo reads only the platform-injected verified token
              header.</span><span v-else>Acting as
              <strong>{{ demoAccount.label }} ({{ demoAccount.role }})</strong
              > — a labelled synthetic fallback with no real login or production
              permissions; the synthetic account switcher applies only to this
              local/demo fallback.</span> {{ DEMO_ROLE_MATRIX_LABEL }} Unknown or blank
              x-demo-user values are rejected before any write, while reads
              stay available as demo reads. Malformed or unrecognised Passport
              identities fail closed with 401 before any mutation.
            </p>
          </div>
          <p v-if="demoMeError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" /> Could not confirm the
            demo identity: {{ demoMeError }} Writes still send the selected
            demo account, and the API remains the permission authority.
          </p>
          <div class="demo-save-bar">
            <UButton
              icon="i-lucide-plus"
              size="sm"
              @click="openCreate()"
            >
              Create issue
            </UButton>
            <UButton
              icon="i-lucide-rotate-ccw"
              variant="outline"
              color="neutral"
              size="sm"
              @click="resetBoard()"
            >
              Reset demo board
            </UButton>
            <span class="demo-save-hint">
              Reset restores the labelled fixture identities and only affects
              the demo-only store.
            </span>
          </div>
          <p v-if="loading" class="empty" role="status">Loading demo board…</p>
          <p v-if="loadError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" /> {{ loadError }}
          </p>
          <p v-if="moveError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" /> Demo save failed:
            {{ moveError }} The card stays in its original column and your
            selection is preserved.
          </p>
          <p v-if="priorityError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" /> Demo save failed:
            {{ priorityError }} The priority stays unchanged and your draft
            selection is preserved for retry.
          </p>
          <p v-if="saveNotice" class="save-note" role="status">
            <UIcon name="i-lucide-check" /> {{ saveNotice }}
          </p>
          <div class="filters">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search issues"
              aria-label="Search issues"
            /><USelect
              v-model="status"
              :items="['All statuses', ...statuses]"
              aria-label="Filter by status"
            /><USelect
              v-model="assignee"
              :items="assignees"
              aria-label="Filter by assignee"
            /><span>{{ filtered.length }} issues</span>
          </div>
          <div v-if="view === 'list'" class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="issue in filtered" :key="issue.key">
                  <td>
                    <UIcon
                      :name="
                        issue.type === 'Bug'
                          ? 'i-lucide-bug'
                          : issue.type === 'Story'
                            ? 'i-lucide-bookmark'
                            : 'i-lucide-square-check'
                      "
                      :aria-label="issue.type"
                      class="type-icon"
                    />
                  </td>
                  <td class="issue-key">{{ issue.key }}</td>
                  <td>
                    <button
                      class="issue-title"
                      @click="selectedKey = issue.key"
                    >
                      {{ issue.title }}
                    </button>
                  </td>
                  <td>
                    <UBadge
                      :color="
                        issue.status === 'In Progress'
                          ? 'primary'
                          : issue.status === 'In Review'
                            ? 'secondary'
                            : 'neutral'
                      "
                      variant="soft"
                      >{{ issue.status }}</UBadge
                    >
                  </td>
                  <td class="assignee">{{ issue.assignee }}</td>
                  <td>
                    <USelect
                      :model-value="issue.priority"
                      :items="priorities"
                      :aria-label="priorityLabel(issue)"
                      :disabled="pendingKeys.includes(issue.key)"
                      size="sm"
                      @update:model-value="
                        (next) => {
                          if (typeof next === 'string' && next !== issue.priority)
                            void changePriorityCard(issue.key, next);
                        }
                      "
                    />
                    <span
                      v-if="pendingKeys.includes(issue.key)"
                      class="saving"
                    >
                      Saving demo edit…
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!filtered.length" class="empty">
              No issues match your filters.
            </p>
          </div>
          <div v-else class="board">
            <section
              v-for="column in statuses"
              :key="column"
              class="board-column"
              :class="{ 'drop-active': dropColumn === column }"
              :aria-label="`${column} column. Drop cards here to move them.`"
              @dragover.prevent="dropColumn = column"
              @dragleave="dropColumn = null"
              @drop.prevent="onDropColumn(column)"
            >
              <header>
                <h2>{{ column }}</h2>
                <span>{{
                  columnIssues(filtered, column).length
                }}</span>
              </header>
              <article
                v-for="issue in columnIssues(filtered, column)"
                :key="issue.key"
                class="issue-card"
                :class="{ dragging: draggedKey === issue.key }"
                draggable="true"
                :aria-label="`${issue.key} ${issue.title}`"
                @dragstart="onDragStart($event, issue.key)"
                @dragend="onDragEnd()"
              >
                <button class="issue-title" @click="selectedKey = issue.key">
                  <strong>{{ issue.title }}</strong>
                </button>
                <span
                  >{{ issue.key
                  }}<UIcon
                    :name="
                      issue.type === 'Bug'
                        ? 'i-lucide-bug'
                        : 'i-lucide-square-check'
                    "
                /></span>
                <label class="move-row">
                  <span class="move-label">
                    <UIcon name="i-lucide-move" />{{ cardMoveLabel(issue) }}
                  </span>
                  <USelect
                    :model-value="issue.status"
                    :items="statuses"
                    :aria-label="cardMoveLabel(issue)"
                    :aria-describedby="`allowed-${issue.key}`"
                    :disabled="pendingKeys.includes(issue.key)"
                    size="sm"
                    @update:model-value="
                      (next) => {
                        if (typeof next === 'string' && next !== issue.status)
                          void moveCard(issue.key, next);
                      }
                    "
                  />
                </label>
                <p :id="`allowed-${issue.key}`" class="demo-save-hint">
                  {{ allowedMoveHint(issue.status) }}
                </p>
                <span v-if="pendingKeys.includes(issue.key)" class="saving">
                  Saving demo move…
                </span>
              </article>
              <p
                v-if="!columnIssues(filtered, column).length"
                class="empty drop-hint"
              >
                Drop cards here to move them to {{ column }}.
              </p>
            </section>
          </div>
          <p class="footer-note">
            Observed Jira statuses · ADEO Nuxt UI v0.1.1 · Fixture content ·
            Demo-only saves reset on redeploy
          </p>
        </main>
      </div>
      <UModal
        v-model:open="createOpen"
        title="Create demo issue"
        description="Demo-only create on this server. The draft is kept when saving fails."
      >
        <template #body>
          <form class="create-form" @submit.prevent="void createCard()">
            <label class="create-field">
              <span>Summary (required)</span>
              <UInput
                v-model="draftTitle"
                placeholder="What needs doing?"
                aria-label="Issue summary"
                autofocus
                :disabled="createSaving"
              />
            </label>
            <div class="create-row">
              <label class="create-field">
                <span>Type</span>
                <USelect
                  v-model="draftType"
                  :items="createTypes"
                  aria-label="Issue type"
                  :disabled="createSaving"
                />
              </label>
              <label class="create-field">
                <span>Status</span>
                <USelect
                  v-model="draftStatus"
                  :items="statuses"
                  aria-label="Issue status"
                  :disabled="createSaving"
                />
              </label>
            </div>
            <div class="create-row">
              <label class="create-field">
                <span>Priority</span>
                <USelect
                  v-model="draftPriority"
                  :items="priorities"
                  aria-label="Issue priority"
                  :disabled="createSaving"
                />
              </label>
              <label class="create-field">
                <span>Assignee</span>
                <UInput
                  v-model="draftAssignee"
                  placeholder="Unassigned"
                  aria-label="Issue assignee"
                  :disabled="createSaving"
                />
              </label>
            </div>
            <label class="create-field">
              <span>Description</span>
              <UTextarea
                v-model="draftDescription"
                placeholder="Demo-only description"
                aria-label="Issue description"
                :disabled="createSaving"
              />
            </label>
            <p v-if="createError" class="save-error" role="alert">
              <UIcon name="i-lucide-triangle-alert" /> Demo create failed:
              {{ createError }} Your draft is kept for retry.
            </p>
            <div class="create-actions">
              <UButton
                type="submit"
                icon="i-lucide-plus"
                :loading="createSaving"
                :disabled="!draftTitle.trim()"
              >
                Create demo issue
              </UButton>
              <UButton
                variant="outline"
                color="neutral"
                :disabled="createSaving"
                @click="closeCreate()"
              >
                Cancel
              </UButton>
            </div>
            <p class="demo-save-hint">
              Demo-only save: the next ADEO-n key is allocated on this
              server and the issue resets on redeploy.
            </p>
          </form>
        </template>
      </UModal>
      <USlideover
        :open="!!selectedKey"
        :title="selected?.key ?? selectedKey ?? undefined"
        :description="selected?.title"
        @update:open="
          (value) => {
            if (!value) selectedKey = null;
          }
        "
        ><template #body
          ><p v-if="detailLoading" class="empty" role="status">
            Loading issue detail…
          </p>
          <p v-else-if="detailError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" /> Could not load
            {{ selectedKey }}: {{ detailError }} List data is unchanged and
            nothing was saved.
          </p>
          <div v-else-if="selected" class="issue-details">
            <UBadge color="warning" variant="soft">Synthetic issue</UBadge>
            <UBadge v-if="detailDemoOnly" color="neutral" variant="subtle"
              >Demo-only read</UBadge
            >
            <h2>{{ selected.title }}</h2>
            <p>{{ selected.description }}</p>
            <dl>
              <dt>Status</dt>
              <dd>{{ selected.status }}</dd>
              <dt>Type</dt>
              <dd>{{ selected.type }}</dd>
              <dt>Priority</dt>
              <dd>{{ selected.priority }}</dd>
              <dt>Assignee</dt>
              <dd>{{ selected.assignee }}</dd>
            </dl>
            <label class="move-row">
              <span class="move-label">
                <UIcon name="i-lucide-move" />Move
                {{ selected.key }} to another column
              </span>
              <USelect
                v-model="selectedTarget"
                :items="selectedTargets"
                :aria-label="`Move ${selected.key} to another column`"
                aria-describedby="allowed-detail"
                :disabled="
                  !selectedTargets.length ||
                  pendingKeys.includes(selected.key)
                "
                size="sm"
              />
            </label>
            <p id="allowed-detail" class="demo-save-hint">
              {{ allowedMoveHint(selected.status) }}
            </p>
            <UButton
              icon="i-lucide-move"
              :loading="pendingKeys.includes(selected.key)"
              :disabled="!selectedTarget"
              @click="
                selected &&
                  selectedTarget &&
                  void moveCard(selected.key, selectedTarget)
              "
            >
              Move to {{ selectedTarget || "…" }}
            </UButton>
            <label class="move-row">
              <span class="move-label">
                <UIcon name="i-lucide-flag" />Demo-only priority for
                {{ selected.key }}
              </span>
              <USelect
                v-model="selectedPriority"
                :items="priorities"
                :aria-label="`Change priority for ${selected.key}`"
                :disabled="pendingKeys.includes(selected.key)"
                size="sm"
              />
            </label>
            <UButton
              icon="i-lucide-flag"
              :loading="pendingKeys.includes(selected.key)"
              :disabled="!selectedPriority || selectedPriority === selected.priority"
              @click="
                selected &&
                  selectedPriority &&
                  void changePriorityCard(selected.key, selectedPriority)
              "
            >
              Save priority{{ selectedPriority && selectedPriority !== selected.priority ? ` (${selectedPriority})` : "" }}
            </UButton>
            <section aria-label="Demo-only comments">
              <h3>Comments · demo-only</h3>
              <p class="demo-save-hint">
                Demo-only discussion on this server. Comments are synthetic,
                reset with the board, and never leave this demo store.
              </p>
              <p v-if="commentsLoading" class="empty" role="status">
                Loading demo comments…
              </p>
              <p v-else-if="commentsError" class="save-error" role="alert">
                <UIcon name="i-lucide-triangle-alert" /> Could not load
                demo comments: {{ commentsError }}
              </p>
              <div v-else>
                <UBadge
                  v-if="commentsDemoOnly"
                  color="neutral"
                  variant="subtle"
                  >Demo-only comments</UBadge
                >
                <p v-if="!comments.length" class="empty">
                  No demo comments yet. Start the discussion below.
                </p>
                <ul v-else class="comment-list">
                  <li
                    v-for="comment in comments"
                    :key="comment.id"
                    class="comment-item"
                  >
                    <p class="comment-meta">
                      <strong>{{ comment.author }}</strong>
                      <UBadge color="neutral" variant="subtle"
                        >Demo-only</UBadge
                      >
                    </p>
                    <p class="comment-body">{{ comment.body }}</p>
                  </li>
                </ul>
              </div>
              <form class="comment-form" @submit.prevent="void postComment()">
                <label class="create-field">
                  <span>Add a demo comment</span>
                  <UTextarea
                    v-model="commentDraft"
                    placeholder="Write a demo-only comment"
                    aria-label="Add a demo comment"
                    :disabled="commentSaving"
                  />
                </label>
                <p v-if="commentError" class="save-error" role="alert">
                  <UIcon name="i-lucide-triangle-alert" /> Demo comment
                  failed: {{ commentError }} Your draft is kept for retry.
                </p>
                <UButton
                  type="submit"
                  icon="i-lucide-message-square-plus"
                  :loading="commentSaving"
                  :disabled="!commentDraft.trim()"
                >
                  Add demo comment
                </UButton>
              </form>
            </section>
            <UButton :to="config.public.factoryUrl" variant="outline"
              >Shape the next capability in the cockpit</UButton
            >
          </div></template
        ></USlideover
      >
    </div></UApp
  >
</template>
