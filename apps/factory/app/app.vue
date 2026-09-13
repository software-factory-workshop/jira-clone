<script setup lang="ts">
import {
  repository as initialRepository,
  references as initialReferences,
  stages as initialStages,
  starterRequests as initialStarters,
  parseDrafts,
  type Draft,
} from "@jira-clone/context";
import { stationLinkSchema } from "./utils/work-station";
import { describeStarter, starterDraft, type StarterCard } from "./utils/starters";
import { applySaveReceipt, cleanSnapshot, destinationLabel, isDraftDirty, type DraftDestination, type ProposalPayload } from "./utils/draft-guard";
const {data:manifest}=useFetch<{repository:typeof initialRepository;references:typeof initialReferences;stages:typeof initialStages;starterRequests:typeof initialStarters}>("/factory/cockpit",{server:false});
const repository=computed(()=>manifest.value?.repository??initialRepository);
const references=computed(()=>manifest.value?.references??initialReferences);
const stages=computed(()=>manifest.value?.stages??initialStages);
const starterRequests=computed(()=>manifest.value?.starterRequests??initialStarters);
const starterCards=computed(()=>starterRequests.value.map((starter)=>describeStarter(starter)));
const activeStarterTitle=ref<string|null>(null);
const workActionsAnchor=ref<HTMLElement|null>(null);
const config = useRuntimeConfig();
const route = useRoute();
const section = ref((stationLinkSchema.safeParse(route.query).success || route.query.delivery) ? "work" : "mining");
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
const unsaved = computed(() => isDraftDirty({ title: title.value, request: request.value }, savedSnapshot.value));
const selectedReference = ref(initialReferences[0]!);
const {
  data: github,
  status: githubStatus,
  refresh: refreshGithub,
} = useFetch("/api/github", { server: false, immediate: false });
const storageKey = "adeo-factory-drafts-v1";
const cockpit = useCockpit();
const draftVersions = ref<Record<string,number>>({});
async function refreshDrafts() {
 const rows=await cockpit.refresh("drafts");
 drafts.value=rows.map(row=>({id:row.id,title:String(row.value.title),request:String(row.value.request),updatedAt:row.updatedAt}));
 draftVersions.value=Object.fromEntries(rows.map(row=>[row.id,row.version]));
}
onMounted(async () => {
  void refreshGithub();
  try {
    let legacy: Draft[]=[];
    try { legacy=parseDrafts(JSON.parse(localStorage.getItem(storageKey)||"[]")); } catch { /* Retain inaccessible legacy data. */ }
    await cockpit.migrate("drafts",legacy.map(d=>({id:d.id,value:{title:d.title,request:d.request}})));
    await refreshDrafts();
    savedSnapshot.value=cleanSnapshot(activeId.value,activeVersion.value,editorText());
  } catch { notice.value="Shared drafts are unavailable. Keep your work and retry; browser drafts remain untouched."; }
});
function editorText() { return { title: title.value, request: request.value }; }
async function applyDestination(destination: DraftDestination) {
  pendingDestination.value = null;
  draftSwitchError.value = "";
  if (destination.kind === "starter") {
    const draft = starterDraft(destination.card);
    activeStarterTitle.value = destination.card.starter.title;
    activeId.value = null;
    activeVersion.value = 0;
    title.value = draft.title;
    request.value = draft.body;
  } else if (destination.kind === "proposal") {
    activeStarterTitle.value = destination.value.id ? null : destination.value.title;
    activeId.value = destination.value.id ?? null;
    activeVersion.value = destination.value.version ?? 0;
    title.value = destination.value.title;
    request.value = destination.value.body;
  } else if (destination.kind === "draft") {
    activeStarterTitle.value = null;
    activeId.value = destination.draft.id;
    activeVersion.value = draftVersions.value[destination.draft.id] ?? 0;
    title.value = destination.draft.title;
    request.value = destination.draft.request;
  } else {
    activeStarterTitle.value = null;
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
async function chooseStarter(card: StarterCard) {
  maybeLeave({ kind: "starter", card });
}
async function compose(starter?: ProposalPayload) {
  maybeLeave(starter ? { kind: "proposal", value: starter } : { kind: "new" });
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
    await refreshDrafts();
    notice.value = "Draft saved in the shared cockpit.";
    await applyDestination(destination);
  } catch {
    draftSwitchError.value = "Could not save. This draft may have changed elsewhere. Your text is retained; reload shared drafts before retrying.";
  } finally { confirmSaving.value = false; }
}
async function focusEditor() {
  await nextTick();
  editor.value?.scrollIntoView({ block: "start", behavior: "instant" });
  // UInput renders a native input; prefer the Title control so keyboard
  // users land in the editor rather than on the page background.
  editor.value?.querySelector<HTMLElement>('input[placeholder="An ADEO issue list"]')?.focus({ preventScroll: true });
}
async function goToWorkActions() {
  await nextTick();
  workActionsAnchor.value?.scrollIntoView({ block: "start", behavior: "smooth" });
  workActionsAnchor.value?.focus({ preventScroll: true });
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
    activeId.value=applied.activeId;activeVersion.value=applied.activeVersion;
    savedSnapshot.value=cleanSnapshot(activeId.value,activeVersion.value,editorText());
    await refreshDrafts();notice.value="Draft saved in the shared cockpit.";
  } catch { notice.value="Could not save. This draft may have changed elsewhere. Your text is retained; reload shared drafts before retrying."; }finally{saving.value=false;}
}
const issueUrl=ref("");let issueSequence=0;
watch([title,request],async()=>{const sequence=++issueSequence;issueUrl.value="";try{const result=await $fetch<{url:string}>("/factory/cockpit/issue-link",{method:"POST",body:{title:title.value,request:request.value}});if(sequence===issueSequence)issueUrl.value=result.url;}catch{if(sequence===issueSequence)issueUrl.value="";}});
</script>

<template>
  <UApp>
    <div class="factory-layout">
      <aside class="sidebar">
        <a class="brand" href="/">ADEO<span>factory</span></a>
        <div class="workspace-name">
          <span class="workspace-icon">J</span>
          <div>Jira clone<small>Software factory workshop</small></div>
        </div>
        <div class="nav-label">WORKSPACE</div>
        <nav aria-label="Cockpit navigation">
          <button :class="{ active: section === 'mining' }" @click="section = 'mining'"><UIcon name="i-lucide-search" />Task mining</button>
          <button
            :class="{ active: section === 'work' }"
            @click="section = 'work'"
          >
            <UIcon name="i-lucide-inbox" />Work <span>{{ drafts.length }}</span>
          </button>
          <button
            :class="{ active: section === 'knowledge' }"
            @click="section = 'knowledge'"
          >
            <UIcon name="i-lucide-book-open" />Project knowledge
          </button>
          <button
            :class="{ active: section === 'growth' }"
            @click="section = 'growth'"
          >
            <UIcon name="i-lucide-sprout" />Factory growth
          </button>
        </nav>
        <div class="sidebar-bottom">
          <div class="stage-marker">
            <span class="status-dot" />Station 01 · Task mining
          </div>
          <p>Build the factory.<br />Learn by making something useful.</p>
          <UButton
            :to="config.public.jiraUrl"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-up-right"
            >Open Jira workspace</UButton
          ><UButton
            :to="repository.url"
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
          <span
            >Workshop /
            <strong>{{
              section === "mining"
                ? "Task mining"
                : section === "work" ? "Work"
                : section === "knowledge"
                  ? "Project knowledge"
                  : "Factory growth"
            }}</strong></span
          ><UBadge color="neutral" variant="subtle">Task mining</UBadge>
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
                  <UBadge color="neutral" variant="soft">{{
                    drafts.length
                  }}</UBadge>
                </div>
                <p class="muted small">Saved in the shared cockpit</p><UButton variant="ghost" size="xs" @click="refreshDrafts">Refresh drafts</UButton>
                <div v-if="!drafts.length" class="empty-drafts">
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
                <p v-if="unsaved" role="status" class="small unsaved-hint">You have unsaved changes. Choosing another starter or draft will ask before replacing this text.</p>
                <UFormField label="Title" name="title" required
                  ><UInput
                    v-model="title"
                    placeholder="An ADEO issue list"
                    class="full-width" /></UFormField
                ><UFormField
                  label="What do you want to achieve?"
                  name="request"
                  required
                  help="Include the user, the outcome and any constraints that matter."
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
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-github"
                    >Review in GitHub</UButton
                  >
                </div>
                <p v-if="notice" role="status" class="save-notice">
                  {{ notice }}
                </p>
                <UModal
                  :open="!!pendingDestination"
                  title="Unsaved draft changes"
                  :description="pendingDestination ? `You have unsaved changes. Save and continue to ${destinationLabel(pendingDestination)}, discard the changes, or keep editing.` : 'You have unsaved changes.'"
                  @update:open="(value) => { if (!value) void keepEditing(); }"
                >
                  <template #body>
                    <p class="small muted">Your current title and request are kept while you decide. Saving replaces the editor only after the shared cockpit confirms.</p>
                    <p v-if="draftSwitchError" role="alert" class="small confirm-error">{{ draftSwitchError }}</p>
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
                      Task mining reads the goal, code and current GitHub work. Review a proposal as a draft, then explicitly choose whether to build a PR.
                    </p>
                  </div>
                </div>
              </section>
              <aside class="context-panel">
                <div class="panel-heading">
                  <h2>Context to start from</h2>
                  <UIcon name="i-lucide-book-open" />
                </div>
                <button
                  v-for="reference in references.slice(0, 3)"
                  :key="reference.id"
                  class="reference-link"
                  @click="
                    selectedReference = reference;
                    section = 'knowledge';
                  "
                >
                  <UIcon :name="reference.icon" />
                  <div>
                    <strong>{{ reference.title }}</strong
                    ><small>{{ reference.kind }}</small>
                  </div>
                  <UIcon name="i-lucide-chevron-right" />
                </button>
                <div class="connection-card">
                  <UIcon name="i-lucide-github" /><strong
                    >GitHub connection</strong
                  ><UBadge
                    :color="
                      github?.state === 'connected' ? 'success' : 'neutral'
                    "
                    variant="soft"
                    >{{
                      (githubStatus === "pending" || githubStatus === "idle")
                        ? "Checking…"
                        : github?.state === "connected"
                          ? "Connected"
                          : "Unavailable"
                    }}</UBadge
                  >
                  <p v-if="github?.state === 'connected'">
                    Private repository · {{ github.branch }}<br />{{
                      github.openItems
                    }}
                    open issues and pull requests<br />Read through Vercel
                    Connect
                  </p>
                  <p v-else-if="githubStatus === 'pending' || githubStatus === 'idle'">Checking repository access through Vercel Connect.</p>
                  <p v-else>
                    Repository access is not available in this session. Check
                    the connection installation and project access.
                  </p>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :loading="githubStatus === 'pending'"
                    icon="i-lucide-refresh-cw"
                    @click="refreshGithub()"
                    >Refresh connection</UButton
                  ><a
                    :href="repository.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    >View jira-clone ↗</a
                  >
                </div>
              </aside>
            </div>
            <section class="starters" aria-label="Starting points">
              <h2>Start with a concrete problem</h2>
              <p class="muted">
                Shipped slices are labelled. Using a shipped card drafts an extension in the editor above, including its next step — it does not reload the already-shipped work.
              </p>
              <div class="starter-grid">
                <article
                  v-for="card in starterCards"
                  :key="card.starter.title"
                  class="starter-card"
                  :class="{ active: activeStarterTitle === card.starter.title, shipped: card.meta.state === 'shipped' }"
                >
                  <div class="starter-top">
                    <UIcon :name="card.starter.icon || 'i-lucide-sparkles'" />
                    <UBadge :color="card.meta.state === 'shipped' ? 'success' : 'primary'" variant="soft">{{ card.meta.badge }}</UBadge>
                  </div>
                  <h3>{{ card.starter.title }}</h3>
                  <p class="starter-body">{{ card.starter.body }}</p>
                  <p class="starter-note">{{ card.meta.note }}</p>
                  <p class="starter-next small muted">Next: {{ card.meta.next }}</p>
                  <div class="starter-actions">
                    <UButton
                      size="xs"
                      :variant="activeStarterTitle === card.starter.title ? 'soft' : 'solid'"
                      :aria-pressed="activeStarterTitle === card.starter.title"
                      icon="i-lucide-arrow-right"
                      @click="chooseStarter(card)"
                      >{{ activeStarterTitle === card.starter.title ? "In the editor" : "Use this starting point" }}</UButton
                    ><UButton size="xs" variant="ghost" icon="i-lucide-pencil" title="Edits the draft currently in the editor above, not this card." @click="focusEditor()">Edit active draft</UButton
                    ><UButton size="xs" variant="ghost" icon="i-lucide-git-pull-request" @click="goToWorkActions()">Work actions</UButton>
                  </div>
                  <span v-if="activeStarterTitle === card.starter.title" class="starter-active" role="status">Active in the draft editor</span>
                </article>
              </div>
            </section>
            <section ref="workActionsAnchor" aria-label="Work actions" class="work-actions-anchor" tabindex="-1">
              <WorkActions :title="title" :brief="request" /><DeliveryLoop :title="title" :brief="request" />
            </section>
            <WorkHistory />
          </template>
          <template v-else-if="section === 'knowledge'">
            <AdeoPageHeader
              eyebrow="SHARED STARTING POINT"
              title="Project knowledge"
              description="The brief, design guidance and observations that should inform the work."
            />
            <div class="knowledge-grid">
              <div class="panel reference-list">
                <button
                  v-for="reference in references"
                  :key="reference.id"
                  class="reference-link"
                  :class="{ selected: selectedReference.id === reference.id }"
                  @click="selectedReference = reference"
                >
                  <UIcon :name="reference.icon" />
                  <div>
                    <strong>{{ reference.title }}</strong
                    ><small>{{ reference.kind }}</small>
                  </div>
                </button>
              </div>
              <article class="panel knowledge-article">
                <UBadge color="primary" variant="soft">{{
                  selectedReference.kind
                }}</UBadge>
                <h2>{{ selectedReference.title }}</h2>
                <p>{{ selectedReference.content }}</p>
                <div class="stage-note">
                  <UIcon name="i-lucide-git-branch" />
                  <p>
                    This context lives in the repository. Changes to factory
                    instructions and skills should be reviewed alongside the
                    code.
                  </p>
                </div>
                <UButton
                  :to="`${repository.url}/tree/main/packages/project-context`"
                  target="_blank"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-github"
                  >View source</UButton
                >
              </article>
            </div>
          </template>
          <template v-else>
            <AdeoPageHeader
              eyebrow="THE WORKSHOP EXPERIMENT"
              title="Grow one capability at a time"
              description="Each stage should make the factory measurably better at the next piece of work."
            />
            <div class="growth-list">
              <article
                v-for="stage in stages"
                :key="stage.number"
                class="panel growth-card"
                :class="{ current: stage.number === '01' }"
              >
                <span class="stage-number">{{ stage.number }}</span>
                <div>
                  <h2>{{ stage.title }}</h2>
                  <p>{{ stage.description }}</p>
                </div>
                <UBadge
                  :color="stage.number === '01' ? 'primary' : 'neutral'"
                  variant="soft"
                  >{{ stage.status }}</UBadge
                >
              </article>
            </div>
            <p class="muted">
              The Jira demo is our test subject. The factory is what we are
              learning to build.
            </p>
          </template>
        </div>
      </main>
    </div>
  </UApp>
</template>
