<script setup lang="ts">
import {
  repository,
  references,
  stages,
  starterRequests,
  parseDrafts,
  type Draft,
} from "@jira-clone/context";

type DraftApiResponse = {
  apiVersion: string;
  data: { draft?: Draft; drafts: Draft[] };
};

const config = useRuntimeConfig();
const section = ref("mining");
const drafts = ref<Draft[]>([]);
const activeId = ref<string | null>(null);
const title = ref("");
const request = ref("");
const notice = ref("");
const editor = ref<HTMLElement | null>(null);
const selectedReference = ref(references[0]!);
const {
  data: github,
  status: githubStatus,
  refresh: refreshGithub,
} = useFetch("/api/github", { server: false, immediate: false });
const storageKey = "adeo-factory-drafts-v1";
onMounted(() => {
  void refreshGithub();
  void restoreDrafts();
});

async function restoreDrafts() {
  let stored: unknown = [];
  try {
    stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    notice.value =
      "Browser storage is unavailable. You can still compose a request.";
  }
  try {
    const response = await $fetch<DraftApiResponse>("/api/cockpit/drafts", {
      method: "PUT",
      body: { drafts: stored },
    });
    drafts.value = response.data.drafts;
    try {
      localStorage.setItem(storageKey, JSON.stringify(drafts.value));
    } catch {
      notice.value =
        "Browser storage is unavailable. You can still compose a request.";
    }
  } catch {
    drafts.value = parseDrafts(stored);
    notice.value =
      "The draft API is unavailable. Restored the last browser copy instead.";
  }
}
async function compose(starter?: { title: string; body: string }) {
  activeId.value = null;
  title.value = starter?.title || "";
  request.value = starter?.body || "";
  section.value = "work";
  notice.value = "";
  await focusEditor();
}
async function openDraft(draft: Draft) {
  activeId.value = draft.id;
  title.value = draft.title;
  request.value = draft.request;
  notice.value = "";
  await focusEditor();
}
async function focusEditor() {
  await nextTick();
  editor.value?.scrollIntoView({ block: "start", behavior: "instant" });
  editor.value?.querySelector("input")?.focus({ preventScroll: true });
}
async function save() {
  if (!title.value.trim() || !request.value.trim()) return;
  try {
    const response = await $fetch<DraftApiResponse>("/api/cockpit/drafts", {
      method: "POST",
      body: {
        draft: {
          id: activeId.value || undefined,
          title: title.value,
          request: request.value,
        },
        drafts: drafts.value,
      },
    });
    const next = response.data.drafts;
    drafts.value = next;
    activeId.value = response.data.draft?.id || null;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      notice.value = "Draft saved in this browser.";
    } catch {
      notice.value = "Draft saved for this session. Browser storage is unavailable.";
    }
  } catch {
    notice.value = "Could not save the draft through the cockpit API.";
  }
}
const issueUrl = computed(
  () =>
    `${repository.url}/issues/new?title=${encodeURIComponent(title.value)}&body=${encodeURIComponent(request.value)}`,
);
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
                <p class="muted small">Saved in this browser</p>
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
                  <UBadge color="secondary" variant="soft">Draft</UBadge>
                </div>
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
                    :disabled="!title.trim() || !request.trim()"
                    icon="i-lucide-save"
                    @click="save"
                    >Save draft</UButton
                  ><UButton
                    :disabled="!title.trim() || !request.trim()"
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
                <p class="small muted">
                  GitHub opens a prefilled issue for you to review and submit.
                  Saving a draft does not run an agent.
                </p>
                <div class="stage-note">
                  <UIcon name="i-lucide-sprout" />
                  <div>
                    <strong>Start with an investigation</strong>
                    <p>
                      Task mining reads the goal, code and current GitHub work. Review its proposals here before opening an issue.
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
            <section class="starters">
              <h2>Start with a concrete problem</h2>
              <p class="muted">
                Examples to edit, not work already in progress.
              </p>
              <div class="starter-grid">
                <button
                  v-for="starter in starterRequests"
                  :key="starter.title"
                  class="starter-card"
                  @click="compose(starter)"
                >
                  <UIcon :name="starter.icon" />
                  <h3>{{ starter.title }}</h3>
                  <p>{{ starter.body }}</p>
                  <span
                    >Use this starting point <UIcon name="i-lucide-arrow-right"
                  /></span>
                </button>
              </div>
            </section>
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
