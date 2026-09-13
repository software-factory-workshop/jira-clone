<script setup lang="ts">
import {
  repository as initialRepository,
  parseDrafts,
  type Draft,
} from "@jira-clone/context";
import { MIN_WORK_REQUEST_LENGTH, stationLinkSchema } from "./utils/work-station";
import { applySaveReceipt, cleanSnapshot, destinationLabel, isDraftDirty, type DraftDestination, type ProposalPayload } from "./utils/draft-guard";
import { cockpitFailureKind, cockpitFailureMessage, type CockpitFailureKind } from "./utils/cockpit-errors";
const {data:manifest}=useFetch<{repository:typeof initialRepository}>("/factory/cockpit",{server:false});
const repository=computed(()=>manifest.value?.repository??initialRepository);
const sectionValues = ["mining", "work"] as const;
type CockpitSection = (typeof sectionValues)[number];
function queryValue(value: unknown): string | undefined {
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
}
function sectionValue(value: unknown): CockpitSection | undefined {
  const candidate = queryValue(value);
  return sectionValues.includes(candidate as CockpitSection) ? candidate as CockpitSection : undefined;
}
const deliveryAnchor=ref<HTMLElement|null>(null);
const config = useRuntimeConfig();
const route = useRoute();
const router = useRouter();
const section = ref<CockpitSection>((stationLinkSchema.safeParse(route.query).success || route.query.delivery) ? "work" : sectionValue(route.query.section) ?? "mining");
const drafts = ref<Draft[]>([]);
const activeId = ref<string | null>(null);
const activeVersion=ref(0);
const saving=ref(false);
const confirmSaving=ref(false);
const title = ref("");
const request = ref("");
const notice = ref("");
const editor = ref<HTMLElement | null>(null);
const savedSnapshot = ref(cleanSnapshot(null, 0, { title: "", request: "" }));
const pendingDestination = ref<DraftDestination | null>(null);
const draftSwitchError = ref("");
const draftsLoading = ref(false);
const draftsLoaded = ref(false);
const draftsError = ref("");
const draftsErrorKind = ref<CockpitFailureKind>();
const unsaved = computed(() => isDraftDirty({ title: title.value, request: request.value }, savedSnapshot.value));
const draftConflict = ref<{ latest: Draft; local: { title: string; request: string } }>();
const storageKey = "adeo-factory-drafts-v1";
const cockpit = useCockpit();
const draftVersions = ref<Record<string,number>>({});
async function refreshDrafts() {
 if (draftsLoading.value) return false;
 draftsLoading.value = true;
 draftsError.value = "";
 draftsErrorKind.value = undefined;
 try {
   const rows=await cockpit.refresh("drafts");
   drafts.value=rows.map(row=>({id:row.id,title:String(row.value.title),request:String(row.value.request),updatedAt:row.updatedAt}));
   draftVersions.value=Object.fromEntries(rows.map(row=>[row.id,row.version]));
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
async function captureDraftConflict(cause: unknown) {
  if (cockpitFailureKind(cause) !== "conflict" || !activeId.value) return;
  const local = editorText();
  if (!await refreshDrafts()) return;
  const latest = drafts.value.find((draft) => draft.id === activeId.value);
  if (latest) draftConflict.value = { latest, local };
}
async function reloadLatestDraft() {
  const conflict = draftConflict.value;
  if (!conflict) return;
  activeId.value = conflict.latest.id;
  activeVersion.value = draftVersions.value[conflict.latest.id] ?? 0;
  title.value = conflict.latest.title;
  request.value = conflict.latest.request;
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
  draftConflict.value = undefined;
  draftSwitchError.value = "";
  pendingDestination.value = null;
  notice.value = "Loaded the latest shared version. Your previous text was not saved.";
  await focusEditor();
}
onMounted(async () => {
  let legacy: Draft[]=[];
  try { legacy=parseDrafts(JSON.parse(localStorage.getItem(storageKey)||"[]")); } catch { /* Retain inaccessible legacy data. */ }
  try { await cockpit.migrate("drafts",legacy.map(d=>({id:d.id,value:{title:d.title,request:d.request}}))); }
  catch (cause) {
    draftsErrorKind.value = cockpitFailureKind(cause);
    draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
  }
  await refreshDrafts();
  savedSnapshot.value=cleanSnapshot(activeId.value,activeVersion.value,editorText());
});
function editorText() { return { title: title.value, request: request.value }; }
const sectionLabel = computed(() => ({ mining: "Task mining", work: "Work" })[section.value]);
const workCountLabel = computed(() => draftsLoaded.value ? `${drafts.value.length} saved drafts` : "Saved drafts unavailable");
function guardNavigation(event?: Event) {
  if (!unsaved.value) return true;
  const allowed = window.confirm("You have unsaved draft text. Leave this editor without saving?");
  if (!allowed) event?.preventDefault();
  return allowed;
}
function navigateSection(next: CockpitSection, event?: Event) {
  if (next === section.value || guardNavigation(event)) section.value = next;
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!unsaved.value) return;
  event.preventDefault();
  event.returnValue = "";
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
watch(section, value => {
  if (queryValue(route.query.section) === value) return;
  void router.replace({ query: { ...route.query, section: value } });
});
watch(() => route.query.section, value => {
  const next = sectionValue(value);
  if (next && next !== section.value) section.value = next;
});
watch(() => [route.query.station, route.query.run, route.query.delivery], () => {
  if ((stationLinkSchema.safeParse(route.query).success || queryValue(route.query.delivery)) && section.value !== "work") section.value = "work";
});
async function applyDestination(destination: DraftDestination) {
  pendingDestination.value = null;
  draftSwitchError.value = "";
  if (destination.kind === "proposal") {
    activeId.value = destination.value.id ?? null;
    activeVersion.value = destination.value.version ?? 0;
    title.value = destination.value.title;
    request.value = destination.value.body;
  } else if (destination.kind === "draft") {
    activeId.value = destination.draft.id;
    activeVersion.value = draftVersions.value[destination.draft.id] ?? 0;
    title.value = destination.draft.title;
    request.value = destination.draft.request;
  } else {
    activeId.value = null;
    activeVersion.value = 0;
    title.value = "";
    request.value = "";
  }
  savedSnapshot.value = cleanSnapshot(activeId.value, activeVersion.value, editorText());
  section.value = "work";
  notice.value = "";
  await focusEditor();
}
function maybeLeave(destination: DraftDestination) {
  // Keep Editing must be able to return to the exact text, draft identity
  // and focus, so the selected destination stays parked while deciding.
  draftSwitchError.value = "";
  if (isDraftDirty(editorText(), savedSnapshot.value)) { pendingDestination.value = destination; return; }
  void applyDestination(destination);
}
async function compose(proposal?: ProposalPayload) {
  maybeLeave(proposal ? { kind: "proposal", value: proposal } : { kind: "new" });
}
async function openDraft(draft: Draft) {
  maybeLeave({ kind: "draft", draft });
}
const keepEditingToken = ref(0);
async function keepEditing() {
  pendingDestination.value = null;
  draftSwitchError.value = "";
  // UModal returns focus to its trigger on close; keep reasserting the
  // Title input briefly so Keep editing resumes where the user left off.
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
  try {
    const saved = await cockpit.save("drafts", id, { title: title.value.trim(), request: request.value.trim() }, activeVersion.value);
    // The shared API confirms first; only then does the editor move on.
    // A delayed receipt for another draft cannot claim this editor.
    const applied = applySaveReceipt({ activeId: activeId.value, activeVersion: activeVersion.value }, previousId, { id, version: saved.version });
    activeId.value = applied.activeId;
    activeVersion.value = applied.activeVersion;
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
  // UInput renders a native input; prefer the Title control so keyboard
  // users land in the editor rather than on the page background.
  editor.value?.querySelector<HTMLElement>('input[placeholder="An ADEO issue list"]')?.focus({ preventScroll: true });
}
async function goToDelivery() {
  await nextTick();
  deliveryAnchor.value?.scrollIntoView({ block: "start", behavior: "smooth" });
  deliveryAnchor.value?.focus({ preventScroll: true });
}
async function save() {
  if (saving.value || confirmSaving.value || !title.value.trim() || !request.value.trim()) return;
  saving.value=true;
  const previousId=activeId.value;
  const id=previousId||crypto.randomUUID();
  try {
    const saved=await cockpit.save("drafts",id,{title:title.value.trim(),request:request.value.trim()},activeVersion.value);
    // A delayed receipt for another draft cannot claim this editor.
    const applied=applySaveReceipt({activeId:activeId.value,activeVersion:activeVersion.value},previousId,{id,version:saved.version});
    activeId.value=applied.activeId;activeVersion.value=applied.activeVersion;draftConflict.value=undefined;
    savedSnapshot.value=cleanSnapshot(activeId.value,activeVersion.value,editorText());
    await refreshDrafts();notice.value="Draft saved in the shared cockpit.";
  } catch (cause) {
    notice.value = cockpitFailureMessage(cause, "This draft");
    if (cockpitFailureKind(cause) === "unavailable") draftsError.value = cockpitFailureMessage(cause, "Shared drafts");
    await captureDraftConflict(cause);
  }finally{saving.value=false;}
}
const issueUrl=ref("");let issueSequence=0;
watch([title,request],async()=>{const sequence=++issueSequence;issueUrl.value="";try{const result=await $fetch<{url:string}>("/factory/cockpit/issue-link",{method:"POST",body:{title:title.value,request:request.value}});if(sequence===issueSequence)issueUrl.value=result.url;}catch{if(sequence===issueSequence)issueUrl.value="";}});
</script>

<template>
  <UApp>
    <div class="factory-layout">
      <aside class="sidebar">
        <a class="brand" href="/" @click="guardNavigation">ADEO<span>factory</span></a>
        <div class="workspace-name">
          <span class="workspace-icon">J</span>
          <div>Jira clone<small>Software factory workshop</small></div>
        </div>
        <div class="nav-label">WORKSPACE</div>
        <nav aria-label="Cockpit navigation">
          <button :class="{ active: section === 'mining' }" :aria-current="section === 'mining' ? 'page' : undefined" @click="navigateSection('mining', $event)"><UIcon name="i-lucide-search" aria-hidden="true" />Task mining</button>
          <button
            :class="{ active: section === 'work' }"
            :aria-current="section === 'work' ? 'page' : undefined"
            :aria-label="`Work, ${workCountLabel}`"
            @click="navigateSection('work', $event)"
          >
            <UIcon name="i-lucide-inbox" aria-hidden="true" />Work <span aria-hidden="true">{{ draftsLoaded ? `${drafts.length} drafts` : "—" }}</span>
          </button>
        </nav>
        <div class="sidebar-bottom">
          <UButton
            :to="config.public.jiraUrl"
            @click="guardNavigation"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-up-right"
            >Open Jira workspace</UButton
          ><UButton
            :to="repository.url"
            @click="guardNavigation"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-lucide-github"
            >Repository</UButton
          >
        </div>
      </aside>
      <main>
        <header class="topbar">
          <span>Workshop / <strong>{{ sectionLabel }}</strong></span>
          <div class="topbar-actions">
            <UButton :to="config.public.jiraUrl" @click="guardNavigation" color="neutral" variant="ghost" size="xs" icon="i-lucide-arrow-up-right">Jira</UButton>
            <UButton :to="repository.url" @click="guardNavigation" target="_blank" color="neutral" variant="ghost" size="xs" icon="i-lucide-github">Repo</UButton>
          </div>
          <UBadge color="neutral" variant="subtle">{{ sectionLabel }}</UBadge>
        </header>
        <div class="page-content">
          <MiningStation v-if="section === 'mining'" @draft="compose" />
          <template v-else-if="section === 'work'">
            <AdeoPageHeader
              eyebrow="THE FACTORY STARTS HERE"
              title="What should we work on?"
              description="Give the factory a useful problem. Start with the outcome you want and what would make it worth shipping."
              ><template #actions
                ><UButton icon="i-lucide-plus" @click="compose()"
                  >New request</UButton
                ></template
              ></AdeoPageHeader
            >
            <div class="work-grid">
              <section class="drafts-panel panel">
                <div class="panel-heading">
                  <h2>Draft requests</h2>
                  <UBadge color="neutral" variant="soft">{{ draftsLoaded ? drafts.length : "—" }}</UBadge>
                </div>
                <p class="muted small">Saved in the shared cockpit</p><UButton variant="ghost" size="xs" :loading="draftsLoading" :disabled="draftsLoading" @click="refreshDrafts">Refresh drafts</UButton>
                <UAlert v-if="draftsError" color="warning" variant="soft" title="Drafts need attention" :description="draftsError">
                  <template #actions><UButton size="xs" variant="outline" :loading="draftsLoading" @click="refreshDrafts">Retry</UButton></template>
                </UAlert>
                <p v-if="!draftsLoaded && !draftsError" role="status" class="muted small">Loading saved drafts…</p>
                <div v-if="draftsLoaded && !drafts.length" class="empty-drafts">
                  <UIcon name="i-lucide-file-pen-line" />
                  <h3>A little context goes a long way</h3>
                  <p>
                    Your saved requests will live here while we shape the first
                    factory capability.
                  </p>
                </div>
                <button
                  v-for="draft in drafts"
                  :key="draft.id"
                  class="draft-item"
                  :class="{ selected: activeId === draft.id }"
                  :aria-pressed="activeId === draft.id"
                  @click="openDraft(draft)"
                >
                  <strong>{{ draft.title }}</strong
                  ><span>{{ draft.request }}</span
                  ><small
                    >Draft ·
                    {{ new Date(draft.updatedAt).toLocaleDateString() }}</small
                  >
                </button>
              </section>
              <section ref="editor" class="editor panel">
                <div class="panel-heading">
                  <h2>
                    {{ activeId ? "Review your request" : "A new request" }}
                  </h2>
                  <UBadge :color="unsaved ? 'warning' : 'secondary'" variant="soft">{{ unsaved ? "Unsaved changes" : "Draft" }}</UBadge>
                </div>
                <p v-if="unsaved" role="status" class="small unsaved-hint">You have unsaved changes. Choosing another draft or request will ask before replacing this text.</p>
                <UFormField label="Title" name="title" required
                  ><UInput
                    v-model="title"
                    placeholder="An ADEO issue list"
                    class="full-width" /></UFormField
                ><UFormField
                  label="What do you want to achieve?"
                  name="request"
                  required
                  :help="`Include the user, the outcome and any constraints that matter. Worker and delivery runs need at least ${MIN_WORK_REQUEST_LENGTH} characters.`"
                  ><UTextarea
                    v-model="request"
                    :rows="9"
                    autoresize
                    class="full-width"
                    placeholder="I want to…"
                /></UFormField>
                <div class="editor-actions">
                  <UButton
                    :disabled="saving || !title.trim() || !request.trim()"
                    :loading="saving"
                    icon="i-lucide-save"
                    @click="save"
                    >Save draft</UButton
                  ><UButton
                    :disabled="!title.trim() || !request.trim() || !issueUrl"
                    :to="issueUrl"
                    target="_blank"
                    @click="guardNavigation"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-github"
                    >Review in GitHub</UButton
                  >
                </div>
                <p v-if="notice" role="status" class="save-notice">
                  {{ notice }}
                </p>
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
                <p class="small muted">
                  GitHub opens a prefilled issue for you to review and submit.
                  Saving a draft does not run an agent.
                </p>
                <div class="stage-note">
                  <UIcon name="i-lucide-sprout" />
                  <div>
                    <strong>Start with an investigation</strong>
                    <p>
                      Task mining reads the goal, code and current GitHub work. Review a proposal, then edit the draft or start the durable delivery.
                    </p>
                  </div>
                </div>
                <div class="mobile-work-jump">
                  <UButton icon="i-lucide-arrow-down" variant="outline" @click="goToDelivery">Continue to delivery</UButton>
                  <span class="small muted">Skip the context cards and jump to the durable delivery.</span>
                </div>
              </section>
            </div>
            <section ref="deliveryAnchor" aria-label="Durable delivery" class="work-actions-anchor" tabindex="-1">
              <WorkActions /><DeliveryLoop :title="title" :brief="request" />
            </section>
            <WorkHistory />
          </template>
        </div>
      </main>
    </div>
  </UApp>
</template>
