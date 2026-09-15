<script setup lang="ts">
import { onBeforeRouteLeave } from "vue-router";
import {
  parseDrafts,
  type Draft,
} from "@jira-clone/context";
import { MIN_WORK_REQUEST_LENGTH } from "../utils/work-station";
import { applySaveReceipt, cleanSnapshot, destinationLabel, isDraftDirty, type DraftDestination, type ProposalPayload } from "../utils/draft-guard";
import { cockpitFailureKind, cockpitFailureMessage, type CockpitFailureKind } from "../utils/cockpit-errors";
import { type CockpitRecord, type DraftOrigin, type WorkOrderAdmission } from "../../shared/cockpit";
import { miningAdmissionSchema } from "../utils/mining-output";

// Draft editor implementation; route pages compose this focused surface.
const { consume } = useWorkRequest();
const route = useRoute();
const router = useRouter();
const editor = ref<HTMLElement | null>(null);
type EditorDraft = Draft & { origin?: DraftOrigin; admission?: WorkOrderAdmission; version: number };
const drafts = ref<EditorDraft[]>([]);
const activeId = ref<string | null>(null);
const activeVersion = ref(0);
const saving = ref(false);
const confirmSaving = ref(false);
const title = ref("");
const request = ref("");
const origin = ref<DraftOrigin>("operator");
const admission = ref<WorkOrderAdmission>();
const admissionText = ref<{ title: string; request: string }>();
const notice = ref("");
const savedSnapshot = ref(cleanSnapshot(null, 0, { title: "", request: "" }));
const pendingDestination = ref<DraftDestination | null>(null);
const draftSwitchError = ref("");
const draftsLoading = ref(false);
const draftsLoaded = ref(false);
const draftsError = ref("");
const draftsErrorKind = ref<CockpitFailureKind>();
const draftConflict = ref<{ latest: EditorDraft; local: { title: string; request: string } }>();
const storageKey = "adeo-factory-drafts-v1";
const cockpit = useCockpit();
const draftVersions = ref<Record<string, number>>({});
const unsaved = computed(() => isDraftDirty({ title: title.value, request: request.value }, savedSnapshot.value));
const navigationApproved = ref(false);
const reviewStarting = ref(false);
const requestLength = computed(() => request.value.trim().length);
const currentAdmission = computed(() => {
  const text = admissionText.value;
  const value = admission.value;
  return value && text && text.title === title.value.trim() && text.request === request.value.trim() ? value : undefined;
});
const titleReady = computed(() => title.value.trim().length > 0 && title.value.trim().length <= 160);
const reviewReady = computed(() => titleReady.value && requestLength.value >= MIN_WORK_REQUEST_LENGTH);

function queryValue(value: unknown): string | undefined {
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
}

function applyDraftRows(rows: CockpitRecord[]) {
  drafts.value = rows.map(row => {
    const parsedAdmission = miningAdmissionSchema.safeParse(row.value.admission);
    const parsedOrigin = row.value.origin === "operator" || row.value.origin === "task-mining" ? row.value.origin : undefined;
    return { id: row.id, version: row.version, title: String(row.value.title), request: String(row.value.request), updatedAt: row.updatedAt, ...(parsedOrigin ? { origin: parsedOrigin } : {}), ...(parsedAdmission.success ? { admission: parsedAdmission.data } : {}) };
  });
  draftVersions.value = Object.fromEntries(rows.map(row => [row.id, row.version]));
  syncActiveDraftFromShared();
  if (activeId.value && unsaved.value) {
    const latest = drafts.value.find(draft => draft.id === activeId.value);
    if (latest && latest.version > activeVersion.value) draftConflict.value = { latest, local: editorText() };
  }
}

async function refreshDrafts() {
  if (draftsLoading.value) return false;
  draftsLoading.value = true;
  draftsError.value = "";
  draftsErrorKind.value = undefined;
  try {
    const rows = await cockpit.refresh("drafts");
    applyDraftRows(rows);
    draftsLoaded.value = true;
    return true;
  } catch (cause) {
    draftsErrorKind.value = cockpitFailureKind(cause);
    draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
    return false;
  } finally {
    draftsLoading.value = false;
  }
}

cockpit.watchCollection("drafts", {
  intervalMs: 10_000,
  onRefresh(rows) {
    applyDraftRows(rows);
    draftsLoaded.value = true;
    draftsError.value = "";
    draftsErrorKind.value = undefined;
  },
  onError(cause) {
    draftsErrorKind.value = cockpitFailureKind(cause);
    draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
  },
});

async function captureDraftConflict(cause: unknown) {
  if (cockpitFailureKind(cause) !== "conflict" || !activeId.value) return;
  const local = editorText();
  if (!await refreshDrafts()) return;
  const latest = drafts.value.find(draft => draft.id === activeId.value);
  if (latest) draftConflict.value = { latest, local };
}

async function reloadLatestDraft() {
  const conflict = draftConflict.value;
  if (!conflict) return;
  activeId.value = conflict.latest.id;
  activeVersion.value = draftVersions.value[conflict.latest.id] ?? 0;
  title.value = conflict.latest.title;
  request.value = conflict.latest.request;
  origin.value = conflict.latest.origin ?? (conflict.latest.admission ? "task-mining" : "operator");
  admission.value = conflict.latest.admission;
  admissionText.value = conflict.latest.admission ? { title: conflict.latest.title.trim(), request: conflict.latest.request.trim() } : undefined;
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
  draftConflict.value = undefined;
  draftSwitchError.value = "";
  pendingDestination.value = null;
  notice.value = "Loaded the latest shared version. Your previous text was not saved.";
  await focusEditor();
}

onMounted(async () => {
  let legacy: Draft[] = [];
  try { legacy = parseDrafts(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { /* Retain inaccessible legacy data. */ }
  try { await cockpit.migrate("drafts", legacy.map(draft => ({ id: draft.id, value: { title: draft.title, request: draft.request, origin: "operator" } }))); }
  catch (cause) {
    draftsErrorKind.value = cockpitFailureKind(cause);
    draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
  }
  await refreshDrafts();
  const proposal = consume();
  const linkedDraft = drafts.value.find(draft => draft.id === queryValue(route.query.draft));
  if (proposal) await applyDestination({ kind: "proposal", value: proposal });
  else if (linkedDraft) await applyDestination({ kind: "draft", draft: linkedDraft });
  else if (queryValue(route.query.draft)) notice.value = "That saved work order could not be loaded. Your other drafts were not changed.";
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
});

function editorText() { return { title: title.value, request: request.value }; }

function syncActiveDraftFromShared() {
  if (!activeId.value || unsaved.value) return;
  const latest = drafts.value.find(draft => draft.id === activeId.value);
  if (!latest) return;
  title.value = latest.title;
  request.value = latest.request;
  activeVersion.value = latest.version;
  origin.value = latest.origin ?? (latest.admission ? "task-mining" : "operator");
  setAdmission(latest.admission, latest);
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
}

function setAdmission(value: WorkOrderAdmission | undefined, text: { title: string; request: string }) {
  admission.value = value;
  admissionText.value = value ? { title: text.title.trim(), request: text.request.trim() } : undefined;
}

function draftValue() {
  const value = currentAdmission.value;
  return { title: title.value.trim(), request: request.value.trim(), origin: origin.value, ...(value ? { admission: value } : {}) };
}

function guardNavigation() {
  if (!unsaved.value) return true;
  return window.confirm("You have unsaved draft text. Leave this editor without saving?");
}

onBeforeRouteLeave(() => navigationApproved.value || guardNavigation());

function beforeUnload(event: BeforeUnloadEvent) {
  if (!unsaved.value) return;
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));

async function applyDestination(destination: DraftDestination) {
  pendingDestination.value = null;
  draftSwitchError.value = "";
  if (destination.kind === "proposal") {
    activeId.value = destination.value.id ?? null;
    activeVersion.value = destination.value.version ?? 0;
    title.value = destination.value.title;
    request.value = destination.value.body;
    origin.value = destination.value.origin ?? "task-mining";
    setAdmission(destination.value.admission, { title: destination.value.title, request: destination.value.body });
  } else if (destination.kind === "draft") {
    activeId.value = destination.draft.id;
    activeVersion.value = draftVersions.value[destination.draft.id] ?? 0;
    title.value = destination.draft.title;
    request.value = destination.draft.request;
    origin.value = destination.draft.origin ?? (destination.draft.admission ? "task-mining" : "operator");
    setAdmission(destination.draft.admission, destination.draft);
  } else {
    activeId.value = null;
    activeVersion.value = 0;
    title.value = "";
    request.value = "";
    origin.value = "operator";
    setAdmission(undefined, { title: "", request: "" });
  }
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
  notice.value = "";
  await focusEditor();
}

function maybeLeave(destination: DraftDestination) {
  draftSwitchError.value = "";
  if (isDraftDirty(editorText(), savedSnapshot.value)) {
    pendingDestination.value = destination;
    return;
  }
  void applyDestination(destination);
}

function compose(proposal?: ProposalPayload) {
  maybeLeave(proposal ? { kind: "proposal", value: proposal } : { kind: "new" });
}

const keepEditingToken = ref(0);
async function keepEditing() {
  pendingDestination.value = null;
  draftSwitchError.value = "";
  const token = ++keepEditingToken.value;
  const deadline = Date.now() + 1500;
  let settled = false;
  while (!settled && Date.now() < deadline && token === keepEditingToken.value) {
    await focusEditor();
    settled = true;
    for (let calm = 0; calm < 6; calm++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (token !== keepEditingToken.value) return;
      const titleInput = editor.value?.querySelector('input[placeholder="An ADEO issue list"]');
      if (document.activeElement === titleInput) continue;
      settled = false;
      break;
    }
  }
}

async function discardAndContinue() {
  const destination = pendingDestination.value;
  if (!destination) return;
  await applyDestination(destination);
}

async function saveAndContinue() {
  const destination = pendingDestination.value;
  if (!destination || confirmSaving.value || saving.value) return;
  if (!title.value.trim() || !request.value.trim()) {
    draftSwitchError.value = "Add a title and a request before saving, or discard to continue without saving.";
    return;
  }
  confirmSaving.value = true;
  const previousId = activeId.value;
  const id = previousId || crypto.randomUUID();
  const value = draftValue();
  try {
    const saved = await cockpit.save("drafts", id, value, activeVersion.value);
    const applied = applySaveReceipt({ activeId: activeId.value, activeVersion: activeVersion.value }, previousId, { id, version: saved.version });
    activeId.value = applied.activeId;
    activeVersion.value = applied.activeVersion;
    setAdmission(value.admission, value);
    draftConflict.value = undefined;
    await refreshDrafts();
    notice.value = "Draft saved in the shared cockpit.";
    await applyDestination(destination);
  } catch (cause) {
    draftSwitchError.value = cockpitFailureMessage(cause, "This draft");
    await captureDraftConflict(cause);
  } finally { confirmSaving.value = false; }
}

async function focusEditor() {
  await nextTick();
  editor.value?.scrollIntoView({ block: "start", behavior: "instant" });
  editor.value?.querySelector<HTMLElement>('input[placeholder="An ADEO issue list"]')?.focus({ preventScroll: true });
}

async function save(): Promise<boolean> {
  if (saving.value || confirmSaving.value || !title.value.trim() || !request.value.trim()) return false;
  saving.value = true;
  const previousId = activeId.value;
  const id = previousId || crypto.randomUUID();
  const value = draftValue();
  try {
    const saved = await cockpit.save("drafts", id, value, activeVersion.value);
    const applied = applySaveReceipt({ activeId: activeId.value, activeVersion: activeVersion.value }, previousId, { id, version: saved.version });
    activeId.value = applied.activeId;
    activeVersion.value = applied.activeVersion;
    setAdmission(value.admission, value);
    draftConflict.value = undefined;
    savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
    await refreshDrafts();
    notice.value = "Draft saved in the shared cockpit.";
    return true;
  } catch (cause) {
    notice.value = cockpitFailureMessage(cause, "This draft");
    if (cockpitFailureKind(cause) === "unavailable") draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
    await captureDraftConflict(cause);
    return false;
  } finally { saving.value = false; }
}

async function go() {
  if (saving.value || reviewStarting.value || confirmSaving.value || !title.value.trim() || !request.value.trim()) return;
  if (!titleReady.value) {
    notice.value = "The title needs to be between 1 and 160 characters before task mining can review it.";
    return;
  }
  if (requestLength.value < MIN_WORK_REQUEST_LENGTH) {
    notice.value = `The request needs at least ${MIN_WORK_REQUEST_LENGTH} characters before task mining can review it.`;
    return;
  }
  reviewStarting.value = true;
  notice.value = "Saving the work order before task mining…";
  try {
    if (await save() && activeId.value) {
      navigationApproved.value = true;
      await router.replace({ path: "/task-mining", query: { draft: activeId.value } });
    }
  } finally {
    reviewStarting.value = false;
  }
}

const issueUrl = ref("");
let issueSequence = 0;
watch([title, request], async () => {
  const sequence = ++issueSequence;
  issueUrl.value = "";
  try {
    const result = await $fetch<{ url: string }>("/factory/cockpit/issue-link", { method: "POST", body: { title: title.value, request: request.value } });
    if (sequence === issueSequence) issueUrl.value = result.url;
  } catch {
    if (sequence === issueSequence) issueUrl.value = "";
  }
});
</script>

<template>
  <AdeoPageHeader
    eyebrow="WORKSPACE · WORK ORDER"
    title="Create a work order"
    description="Describe the outcome you want. Your request is saved first, then task mining checks that it is sound before you decide whether to start the work."
  >
    <template #actions>
      <UButton icon="i-lucide-plus" @click="compose()">New draft</UButton>
    </template>
  </AdeoPageHeader>

  <div class="work-grid">
    <section ref="editor" class="editor panel">
      <div class="panel-heading">
        <h2>{{ activeId ? "Review your work order" : "A new work order" }}</h2>
        <UBadge :color="unsaved ? 'warning' : 'secondary'" variant="soft">{{ unsaved ? "Unsaved changes" : "Work order draft" }}</UBadge>
      </div>
      <UAlert v-if="draftsError" color="warning" variant="soft" title="Shared drafts are unavailable" :description="draftsError">
        <template #actions>
          <UButton size="xs" variant="outline" :loading="draftsLoading" :disabled="draftsLoading" @click="refreshDrafts">Retry shared drafts</UButton>
        </template>
      </UAlert>
      <p v-if="unsaved" role="status" class="small unsaved-hint">You have unsaved changes. Choosing another draft or request will ask before replacing this text.</p>
      <UFormField label="Title" name="title" required>
        <UInput v-model="title" maxlength="160" placeholder="An ADEO issue list" class="full-width" />
      </UFormField>
      <UFormField
        label="What do you want to achieve?"
        name="request"
        required
        :help="`Include the user, the outcome and any constraints that matter. Worker and delivery runs need at least ${MIN_WORK_REQUEST_LENGTH} characters.`"
      >
        <UTextarea v-model="request" :rows="9" autoresize class="full-width" placeholder="I want to…" />
      </UFormField>
      <div class="editor-actions">
        <UButton :disabled="saving || reviewStarting || !title.trim() || !request.trim() || !reviewReady" :loading="saving || reviewStarting" icon="i-lucide-search-check" @click="go">Review with task mining</UButton>
        <UButton
          :disabled="!title.trim() || !request.trim() || !issueUrl"
          :to="issueUrl"
          target="_blank"
          color="neutral"
          variant="outline"
          icon="i-lucide-github"
        >Create issue in GitHub</UButton>
      </div>
      <p v-if="notice" role="status" class="save-notice">{{ notice }}</p>
      <p class="small muted" role="status">Task mining reviews this exact saved request. No worker starts until you approve the investigation ({{ requestLength }}/{{ MIN_WORK_REQUEST_LENGTH }} minimum characters).</p>
      <section v-if="draftConflict" class="draft-conflict" role="alert">
        <div>
          <strong>Shared draft changed elsewhere</strong>
          <p class="small">Your text is retained. Compare it with the latest version, then choose whether to reload the shared draft.</p>
        </div>
        <details>
          <summary>Compare versions</summary>
          <div class="conflict-compare">
            <article><h3>Your unsaved text</h3><strong>{{ draftConflict.local.title || "Untitled" }}</strong><pre>{{ draftConflict.local.request || "No request text" }}</pre></article>
            <article><h3>Latest shared version</h3><strong>{{ draftConflict.latest.title }}</strong><pre>{{ draftConflict.latest.request }}</pre></article>
          </div>
        </details>
        <UButton size="xs" variant="outline" @click="reloadLatestDraft">Reload latest shared draft</UButton>
      </section>
      <UModal
        :open="!!pendingDestination"
        title="Unsaved draft changes"
        :description="pendingDestination ? `You have unsaved changes. Save and continue to ${destinationLabel(pendingDestination)}, discard the changes, or keep editing.` : 'You have unsaved changes.'"
        @update:open="(value) => { if (!value) void keepEditing(); }"
      >
        <template #body>
          <p class="small muted">Your current title and request are kept while you decide. Saving replaces the editor only after the shared cockpit confirms.</p>
          <p v-if="draftSwitchError" role="alert" class="small confirm-error">{{ draftSwitchError }}</p>
          <UButton v-if="draftConflict" size="xs" variant="outline" @click="reloadLatestDraft">Reload latest shared draft</UButton>
          <div class="confirm-actions">
            <UButton icon="i-lucide-save" :loading="confirmSaving" :disabled="confirmSaving" @click="saveAndContinue">Save and continue</UButton>
            <UButton variant="outline" color="neutral" :disabled="confirmSaving" @click="discardAndContinue">Discard changes</UButton>
            <UButton variant="ghost" color="neutral" :disabled="confirmSaving" @click="keepEditing">Keep editing</UButton>
          </div>
        </template>
      </UModal>
      <p class="small muted">Create issue in GitHub opens a prefilled issue for you to review and submit. Task mining never starts delivery by itself.</p>
      <div class="stage-note">
        <UIcon name="i-lucide-compass" />
        <div>
          <strong>Review before execution</strong>
          <p>Task mining reads the request, code and current GitHub work. You can approve the result to start a work order, or reject it and return here with the original text intact.</p>
        </div>
      </div>
    </section>
  </div>
</template>
