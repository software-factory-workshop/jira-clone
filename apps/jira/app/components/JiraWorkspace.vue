<!-- JiraWorkspace owns the Jira demo surface; app.vue composes it. -->
<script setup lang="ts">
import {
  clearCommentDraftAfterSave,
  fetchIssueComments,
  isCommentDraftStorageAvailable,
  postIssueComment,
  readCommentDraft,
  submitIssueComment,
  writeCommentDraft,
  type DemoComment,
  type IssueCommentsResponse,
  type RestCommentWriteResponse,
} from "~/utils/issueComments";
import {
  failedDetail,
  fetchIssueDetail,
  loadedDetail,
  type IssueDetailResponse,
} from "~/utils/issueDetail";
import {
  fetchBoardIssues,
  type RestPersistenceShape,
  type RestIssueWriteShape,
  type RestSearchShape,
} from "~/utils/restIssues";
import {
  ALL_ASSIGNEES,
  ALL_STATUSES,
  OBSERVED_STATUSES,
  PRIORITIES,
  assigneeOptions,
  changePriority,
  dragDropTargets,
  filterIssues,
  moveIssue,
  moveTargets,
  type BoardIssue,
} from "~/utils/boardMove";
import {
  canInvokeMutation,
  readOnlyMutationHint,
} from "~/utils/roleAffordances";
import {
  DEMO_ROLE_MATRIX_LABEL,
  useDemoAccount,
} from "~/composables/useDemoAccount";
import {
  detailDraftFromIssue,
  isDetailDraftDirty,
  saveDetailFields,
  validateDetailDraft,
  type DetailFieldDraft,
} from "~/utils/issueFields";
import { serverMessage } from "~/utils/errorMessage";
import type { CreateIssueDraft } from "~/components/JiraCreateIssueModal.vue";

const config = useRuntimeConfig();

const {
  demoUserId,
  demoAccount,
  demoAccountItems,
  demoMeError,
  meIdentitySource,
  meAccountId,
  meDisplayName,
  meRole,
  workspaceCapabilities,
  canWrite,
  canReset,
  readOnly,
  refreshAccount,
  selectDemoAccount,
  demoHeaders,
} = useDemoAccount();
const view = ref<"list" | "board">("list");
const search = ref("");
const status = ref(ALL_STATUSES);
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
const commentDraftLocal = ref(false);
const commentDraftReloadable = ref(true);
const commentSaving = ref(false);
const commentError = ref<string | null>(null);
function refreshCommentDraftStorage(): void {
  commentDraftReloadable.value = isCommentDraftStorageAvailable();
}
const issues = ref<BoardIssue[]>([]);
const persistence = ref<RestPersistenceShape | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const moveError = ref<string | null>(null);
const priorityError = ref<string | null>(null);
const saveNotice = ref<string | null>(null);
const pendingKeys = ref<string[]>([]);

const assignees = computed(() => assigneeOptions(issues.value));

const selected = computed(() => detailIssue.value);
const selectedTargets = computed(() =>
  selected.value ? moveTargets(statuses, selected.value.status) : [],
);
const selectedTarget = ref("");
const selectedPriority = ref("");
const detailSummary = ref("");
const detailAssignee = ref("");
const detailDescription = ref("");
const detailSaving = ref(false);
const detailFieldsError = ref<string | null>(null);
const detailFieldsNotice = ref<string | null>(null);
const detailWriteForbidden = ref<string | null>(null);
const createOpen = ref(false);
const createSaving = ref(false);
const createError = ref<string | null>(null);
const createTypes = ["Story", "Task", "Bug"];

const persistenceLabel = computed(
  () => persistence.value?.label ?? "Jira demo persistence",
);
const persistenceDescription = computed(
  () =>
    persistence.value?.description ??
    "The active persistence boundary is loading from the canonical REST read.",
);
const persistenceReloadHint = computed(() =>
  persistence.value?.mode === "neon"
    ? "Reload to confirm it remains in Neon Postgres."
    : "Reload to confirm it remains on this server.",
);

watch(selected, (issue) => {
  selectedTarget.value = issue ? moveTargets(statuses, issue.status)[0] ?? "" : "";
  selectedPriority.value = issue ? issue.priority : "";
  const draft = issue ? detailDraftFromIssue(issue) : { summary: "", assignee: "", description: "" };
  detailSummary.value = draft.summary;
  detailAssignee.value = draft.assignee;
  detailDescription.value = draft.description;
  detailFieldsError.value = null;
  detailFieldsNotice.value = null;
  detailSaving.value = false;
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
    commentsError.value = serverMessage(
      error,
      "Could not load demo comments.",
    );
  } finally {
    if (selectedKey.value === key) commentsLoading.value = false;
  }
}

async function postComment() {
  if (!selectedKey.value || commentSaving.value) return;
  if (!canInvokeMutation("comment", workspaceCapabilities.value)) return;
  const key = selectedKey.value;
  const submittedDraft = commentDraft.value;
  commentError.value = null;
  commentSaving.value = true;
  try {
    const result = await submitIssueComment(
      comments.value,
      submittedDraft,
      (body) =>
        postIssueComment(key, body, (url, request) =>
          $fetch<RestCommentWriteResponse>(url, {
            method: "POST",
            body: request,
            headers: demoHeaders(),
          }),
        ),
    );
    if (!result.ok) {
      // A failed save re-persists the originating draft; the stored copy is
      // only rewritten when it still matches the submitted text, so newer
      // keystrokes typed while saving are never overwritten.
      if (readCommentDraft(key).trim() === submittedDraft.trim()) {
        writeCommentDraft(key, result.draft);
      }
      refreshCommentDraftStorage();
      if (selectedKey.value === key) {
        commentDraft.value = result.draft;
        if (result.draft.trim() !== "") commentDraftLocal.value = true;
        commentError.value = result.error;
      } else {
        commentError.value = null;
      }
      return;
    }
    // A deferred REST POST can resolve after dialog close or after the user
    // switched issues: clear only the originating draft when it still
    // matches the submitted text and preserve any newer draft. Dialog state
    // is touched only when the originating issue is still selected, so late
    // responses never overwrite the newly selected issue.
    clearCommentDraftAfterSave(key, submittedDraft);
    if (selectedKey.value === key) {
      const stored = readCommentDraft(key);
      comments.value = result.comments;
      commentDraft.value = stored;
      commentDraftLocal.value = stored !== "";
      commentError.value = null;
      // Refresh through the canonical comment-list read so the dialog
      // renders exactly what the REST GET returns after the REST POST.
      void loadComments(key);
    }
    refreshCommentDraftStorage();
  } finally {
    commentSaving.value = false;
  }
}

watch(commentDraft, (next) => {
  // Per-issue draft retention: every keystroke is kept locally under the
  // open issue key so the draft survives dialog close and reload. Blank
  // drafts clear the stored entry. When web storage is unavailable the
  // per-issue draft stays session-only and the UI labels it honestly.
  if (selectedKey.value) writeCommentDraft(selectedKey.value, next);
  commentDraftLocal.value = next !== "";
  refreshCommentDraftStorage();
});

watch(selectedKey, (key, previous) => {
  // Keep the previous issue's draft before switching: the keystroke watcher
  // already persists it, but a programmatic draft change must not leak
  // across issues.
  if (previous && commentDraft.value.trim() !== "") {
    writeCommentDraft(previous, commentDraft.value);
  }
  detailIssue.value = null;
  detailDemoOnly.value = false;
  detailError.value = null;
  detailLoading.value = false;
  comments.value = [];
  commentsDemoOnly.value = false;
  commentsError.value = null;
  commentsLoading.value = false;
  const restored = key ? readCommentDraft(key) : "";
  commentDraft.value = restored;
  commentDraftLocal.value = restored !== "";
  refreshCommentDraftStorage();
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
  const saved = await $fetch<RestIssueWriteShape>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { status: next, ...(fail ? { fail: true } : {}) },
    headers: demoHeaders(),
  });
  if (saved.persistence) persistence.value = saved.persistence;
  return saved.issue;
}

async function savePriority(key: string, next: string): Promise<BoardIssue> {
  const saved = await $fetch<RestIssueWriteShape>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { priority: next },
    headers: demoHeaders(),
  });
  if (saved.persistence) persistence.value = saved.persistence;
  return saved.issue;
}

async function saveDetailFieldPatch(
  key: string,
  patch: { title: string; assignee: string; description: string },
): Promise<BoardIssue> {
  const saved = await $fetch<Pick<RestIssueWriteShape, "issue">>(`/api/issues/${key}`, {
    method: "PATCH",
    body: patch,
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
    persistence.value = data.persistence ?? null;
  } catch (error) {
    issues.value = [];
    persistence.value = null;
    loadError.value = serverMessage(
      error,
      "Could not load board issues through the REST search read.",
    );
  } finally {
    loading.value = false;
  }
}

const dropColumns = computed(() => dragDropTargets(statuses));

async function moveCard(key: string, toStatus: string) {
  if (pendingKeys.value.includes(key)) return;
  if (!canInvokeMutation("update", workspaceCapabilities.value)) return;
  // A drag dropped back onto its own column is a no-op: report nothing so
  // the board never shows false success for a save that did not happen.
  const currentStatus = issues.value.find((issue) => issue.key === key)?.status;
  if (currentStatus !== undefined && currentStatus === toStatus) return;
  pendingKeys.value = [...pendingKeys.value, key];
  moveError.value = null;
  saveNotice.value = null;
  const before = selectedKey.value;
  const result = await moveIssue(issues.value, key, toStatus, (k, next) =>
    saveStatus(k, next),
  );
  issues.value = result.issues;
  if (result.ok) {
    saveNotice.value = `Demo-only save: ${key} moved to ${toStatus}. ${persistenceReloadHint.value}`;
  } else {
    moveError.value = result.error;
  }
  selectedKey.value = before;
  if (selectedKey.value === key && result.ok) void loadDetail(key);
  pendingKeys.value = pendingKeys.value.filter((pending) => pending !== key);
}

async function changePriorityCard(key: string, next: string) {
  if (pendingKeys.value.includes(key)) return;
  if (!canInvokeMutation("update", workspaceCapabilities.value)) return;
  pendingKeys.value = [...pendingKeys.value, key];
  priorityError.value = null;
  saveNotice.value = null;
  const before = selectedKey.value;
  const result = await changePriority(issues.value, key, next, (k, priority) =>
    savePriority(k, priority),
  );
  issues.value = result.issues;
  if (result.ok) {
    saveNotice.value = `Demo-only save: ${key} priority set to ${next}. ${persistenceReloadHint.value}`;
  } else {
    priorityError.value = result.error;
  }
  selectedKey.value = before;
  if (selectedKey.value === key && result.ok) void loadDetail(key);
  pendingKeys.value = pendingKeys.value.filter((pending) => pending !== key);
}

const detailDraftInvalid = computed(() =>
  selected.value
    ? validateDetailDraft({
        summary: detailSummary.value,
        assignee: detailAssignee.value,
        description: detailDescription.value,
      })
    : "Select an issue to edit its fields.",
);
const detailDraftDirty = computed(() =>
  selected.value
    ? isDetailDraftDirty(
        {
          summary: detailSummary.value,
          assignee: detailAssignee.value,
          description: detailDescription.value,
        },
        selected.value,
      )
    : false,
);

async function saveDetailEdits() {
  if (detailSaving.value || !selected.value || !selectedKey.value) return;
  if (!canInvokeMutation("update", workspaceCapabilities.value)) {
    detailWriteForbidden.value =
      selected.value && readOnly.value
        ? readOnlyMutationHint("update")
        : "Demo-only save blocked: your role cannot write. Nothing was saved.";
    return;
  }
  detailWriteForbidden.value = null;
  const key = selectedKey.value;
  const draft: DetailFieldDraft = {
    summary: detailSummary.value,
    assignee: detailAssignee.value,
    description: detailDescription.value,
  };
  detailFieldsError.value = null;
  detailFieldsNotice.value = null;
  detailSaving.value = true;
  try {
    const result = await saveDetailFields(issues.value, key, draft, (k, patch) =>
      saveDetailFieldPatch(k, patch),
    );
    issues.value = result.issues;
    if (result.ok) {
      // Reload through the canonical detail read first: it replaces the
      // selected issue, which resets the draft state. The notice is set
      // after the reload so it survives and names what was saved.
      if (selectedKey.value === key) await loadDetail(key);
      if (selectedKey.value === key) {
        detailFieldsNotice.value = `Demo-only save: ${key} summary, assignee and description saved. Reload to confirm they persist on this server.`;
      }
    } else {
      // A failed save keeps the submitted draft for retry; the list keeps
      // the last saved values and nothing was written.
      detailSummary.value = result.draft.summary;
      detailAssignee.value = result.draft.assignee;
      detailDescription.value = result.draft.description;
      detailFieldsError.value = result.error;
    }
  } finally {
    detailSaving.value = false;
  }
}

function resetDetailDraft() {
  if (!selected.value || detailSaving.value) return;
  const draft = detailDraftFromIssue(selected.value);
  detailSummary.value = draft.summary;
  detailAssignee.value = draft.assignee;
  detailDescription.value = draft.description;
  detailFieldsError.value = null;
  detailFieldsNotice.value = null;
}

function openCreate() {
  if (!canInvokeMutation("create", workspaceCapabilities.value)) return;
  createError.value = null;
  createOpen.value = true;
}

async function createCard(draft: CreateIssueDraft) {
  if (createSaving.value) return;
  if (!canInvokeMutation("create", workspaceCapabilities.value)) return;
  createError.value = null;
  saveNotice.value = null;
  if (draft.title.trim() === "") {
    createError.value = "A nonblank demo title is required.";
    return;
  }
  createSaving.value = true;
  try {
    const saved = await $fetch<RestIssueWriteShape>("/api/issues", {
      method: "POST",
      headers: demoHeaders(),
      body: {
        title: draft.title.trim(),
        type: draft.type,
        status: draft.status,
        priority: draft.priority,
        assignee: draft.assignee.trim() === "" ? "Unassigned" : draft.assignee.trim(),
        description: draft.description,
      },
    });
    if (saved.persistence) persistence.value = saved.persistence;
    issues.value = [...issues.value, saved.issue];
    createOpen.value = false;
    saveNotice.value = `Demo-only create: ${saved.issue.key} added. ${persistenceReloadHint.value}`;
  } catch (error) {
    createError.value = serverMessage(error, "Demo create failed.");
  } finally {
    createSaving.value = false;
  }
}

async function resetBoard() {
  if (!canInvokeMutation("reset", workspaceCapabilities.value)) return;
  moveError.value = null;
  priorityError.value = null;
  saveNotice.value = null;
  try {
    const reset = await $fetch<{ persistence?: RestPersistenceShape }>("/api/issues/reset", {
      method: "POST",
      headers: demoHeaders(),
    });
    if (reset.persistence) persistence.value = reset.persistence;
    await refresh();
    if (!loadError.value) {
      saveNotice.value =
        `Demo board reset to labelled fixture identities. Reset affects ${persistenceLabel.value}.`;
    }
  } catch (error) {
    moveError.value = serverMessage(error, "Demo reset failed.");
  }
}

await Promise.all([refreshAccount(), refresh()]);
</script>
<template>
  <UApp
    ><div class="jira-shell">
      <JiraWorkspaceHeader
        :identity-source="meIdentitySource"
        :display-name="meDisplayName"
        :role="meRole"
        :account="demoAccount"
        :account-items="demoAccountItems"
        :model-value="demoUserId"
        :factory-url="config.public.factoryUrl"
        @update:model-value="selectDemoAccount"
      />
      <div class="jira-body">
        <JiraProjectSidebar v-model:view="view" />
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
              an issue. The active issue and comment store is
              <strong>{{ persistenceLabel }}</strong>: {{ persistenceDescription }}
              Status moves and priority edits use a labelled
              <strong>demo-only save path</strong>. Status moves follow a
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
            <UBadge v-if="readOnly" color="warning" variant="solid">Read-only workspace</UBadge>
            <UButton
              icon="i-lucide-plus"
              size="sm"
              :disabled="!canWrite"
              :aria-describedby="readOnly ? 'workspace-access-hint' : undefined"
              @click="openCreate()"
            >
              Create issue
            </UButton>
            <UButton
              icon="i-lucide-rotate-ccw"
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="!canReset"
              :aria-describedby="readOnly ? 'workspace-access-hint' : undefined"
              @click="resetBoard()"
            >
              Reset demo board
            </UButton>
            <span class="demo-save-hint">
              Reset restores the labelled fixture identities and clears the
              active issue and comment store.
            </span>
          </div>
          <p v-if="readOnly" id="workspace-access-hint" class="save-note" role="status">
            <UIcon name="i-lucide-eye" /> Read-only workspace: reading, search,
            filters and issue detail stay available, while priority edits,
            status moves, create, reset and comment submission are unavailable.
            The API remains the permission authority.
          </p>
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
          <JiraIssueFilters
            :search="search"
            :status="status"
            :assignee="assignee"
            :statuses="statuses"
            :assignees="assignees"
            :count="filtered.length"
            @update:search="search = $event"
            @update:status="status = $event"
            @update:assignee="assignee = $event"
          />
          <JiraIssueList
            v-if="view === 'list'"
            :issues="filtered"
            :priorities="priorities"
            :can-write="canWrite"
            :pending-keys="pendingKeys"
            @select="selectedKey = $event"
            @priority-change="changePriorityCard"
          />
          <JiraIssueBoard
            v-else
            :issues="filtered"
            :columns="dropColumns"
            :can-write="canWrite"
            :pending-keys="pendingKeys"
            @select="selectedKey = $event"
            @move="moveCard"
          />
          <p class="footer-note">
            Observed Jira statuses · ADEO Nuxt UI v0.1.1 · Fixture content ·
            {{ persistenceLabel }}
          </p>
        </main>
      </div>
      <JiraCreateIssueModal
        :open="createOpen"
        :saving="createSaving"
        :error="createError"
        :types="createTypes"
        :statuses="statuses"
        :priorities="priorities"
        :persistence-label="persistenceLabel"
        :persistence-description="persistenceDescription"
        @update:open="createOpen = $event"
        @submit="createCard"
      />
      <JiraIssueDetails
        :open="!!selectedKey"
        :issue="selected"
        :selected-key="selectedKey"
        :loading="detailLoading"
        :error="detailError"
        :demo-only="detailDemoOnly"
        :can-write="canWrite"
        :read-only-hint="readOnlyMutationHint('update')"
        :detail-summary="detailSummary"
        :detail-assignee="detailAssignee"
        :detail-description="detailDescription"
        :detail-saving="detailSaving"
        :detail-draft-invalid="detailDraftInvalid"
        :detail-draft-dirty="detailDraftDirty"
        :detail-write-forbidden="detailWriteForbidden"
        :detail-fields-error="detailFieldsError"
        :detail-fields-notice="detailFieldsNotice"
        :selected-target="selectedTarget"
        :selected-targets="selectedTargets"
        :selected-priority="selectedPriority"
        :priorities="priorities"
        :pending="selected ? pendingKeys.includes(selected.key) : false"
        :comments="comments"
        :comments-loading="commentsLoading"
        :comments-error="commentsError"
        :comments-demo-only="commentsDemoOnly"
        :comment-draft="commentDraft"
        :comment-draft-local="commentDraftLocal"
        :comment-draft-reloadable="commentDraftReloadable"
        :comment-saving="commentSaving"
        :comment-error="commentError"
        :persistence-label="persistenceLabel"
        :factory-url="config.public.factoryUrl"
        @update:open="selectedKey = $event ? selectedKey : null"
        @update:detail-summary="detailSummary = $event"
        @update:detail-assignee="detailAssignee = $event"
        @update:detail-description="detailDescription = $event"
        @update:selected-target="selectedTarget = $event"
        @update:selected-priority="selectedPriority = $event"
        @update:comment-draft="commentDraft = $event"
        @save-detail="saveDetailEdits"
        @reset-detail="resetDetailDraft"
        @move="moveCard"
        @priority-change="changePriorityCard"
        @submit-comment="postComment"
      />
    </div></UApp
  >
</template>
