<script setup lang="ts">
import { demoIssues } from "@jira-clone/context";
import { applySavedIssue, filterIssues } from "~/utils/issue-client";
import type { TeachingIssueView } from "~/utils/issue-client";

const config = useRuntimeConfig();
const view = ref("list");
const search = ref("");
const status = ref("All statuses");
const assignee = ref("All assignees");
const statuses = ["To Do", "In Progress", "In Review", "Done"];
const priorities = ["Lowest", "Low", "Medium", "High", "Highest"];

type LoadedIssue = TeachingIssueView;

const serverIssues = ref<LoadedIssue[]>(demoIssues.map((issue) => ({ ...issue })));
const loadError = ref<string | null>(null);
const selectedKey = ref<string | null>(null);
const draftPriority = ref("");
const detailError = ref<string | null>(null);
const detailSaving = ref(false);
const rowSaving = ref<Record<string, boolean>>({});
const rowError = ref<Record<string, string | null>>({});
const simulateFailure = ref(false);
const notice = ref<{ kind: "success" | "error"; text: string } | null>(null);

const assignees = computed(() => [
  "All assignees",
  ...Array.from(new Set(serverIssues.value.map((issue) => issue.assignee))).sort(),
]);

const issues = computed(() =>
  filterIssues(serverIssues.value, search.value, status.value, assignee.value),
);

const selected = computed(
  () => serverIssues.value.find((issue) => issue.key === selectedKey.value) ?? null,
);

function openIssue(issue: LoadedIssue) {
  selectedKey.value = issue.key;
  draftPriority.value = issue.priority;
  detailError.value = null;
}

function closeIssue() {
  selectedKey.value = null;
  detailError.value = null;
}

async function loadIssues() {
  loadError.value = null;
  try {
    const data = await $fetch<{ issues: LoadedIssue[] }>("/api/issues");
    serverIssues.value = data.issues;
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "Could not load demo issues.";
  }
}

async function savePriority(key: string, priority: string) {
  rowSaving.value = { ...rowSaving.value, [key]: true };
  rowError.value = { ...rowError.value, [key]: null };
  notice.value = null;
  try {
    const data = await $fetch<{ issue: LoadedIssue }>(
      `/api/issues/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        body: { priority, failSave: simulateFailure.value },
      },
    );
    const applied = applySavedIssue(serverIssues.value, {
      key,
      priority,
      appliedPriority: data.issue.priority,
    });
    serverIssues.value = applied.issues;
    if (selectedKey.value === key) draftPriority.value = data.issue.priority;
    notice.value = { kind: "success", text: `${key} priority saved.` };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Save failed; draft kept.";
    const kept = applySavedIssue(serverIssues.value, {
      key,
      priority,
      saveError: message,
    });
    serverIssues.value = kept.issues;
    rowError.value = { ...rowError.value, [key]: message };
    notice.value = { kind: "error", text: message };
  } finally {
    rowSaving.value = { ...rowSaving.value, [key]: false };
  }
}

async function saveDetailPriority() {
  if (!selected.value) return;
  detailSaving.value = true;
  detailError.value = null;
  notice.value = null;
  const key = selected.value.key;
  const attempted = draftPriority.value;
  try {
    const data = await $fetch<{ issue: LoadedIssue }>(
      `/api/issues/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        body: { priority: attempted, failSave: simulateFailure.value },
      },
    );
    const applied = applySavedIssue(serverIssues.value, {
      key,
      priority: attempted,
      appliedPriority: data.issue.priority,
    });
    serverIssues.value = applied.issues;
    draftPriority.value = data.issue.priority;
    notice.value = { kind: "success", text: `${key} priority saved.` };
  } catch (error) {
    // Keep the user's draft visible; displayed list state is unchanged.
    detailError.value =
      error instanceof Error ? error.message : "Save failed; draft kept.";
    notice.value = { kind: "error", text: detailError.value };
  } finally {
    detailSaving.value = false;
  }
}

async function resetDemo() {
  notice.value = null;
  try {
    const data = await $fetch<{ issues: LoadedIssue[] }>("/api/issues-reset", {
      method: "POST",
    });
    serverIssues.value = data.issues;
    assignee.value = "All assignees";
    simulateFailure.value = false;
    if (selected.value) draftPriority.value = selected.value.priority;
    notice.value = { kind: "success", text: "Demo data reset to fixtures." };
  } catch (error) {
    notice.value = {
      kind: "error",
      text: error instanceof Error ? error.message : "Reset failed.",
    };
  }
}

onMounted(() => {
  void loadIssues();
});
</script>
<template>
  <UApp
    ><div class="jira-shell">
      <header class="jira-header">
        <a class="brand" href="/">ADEO</a
        ><span class="product-name">Jira workspace</span
        ><UBadge color="neutral" variant="subtle">Teaching slice</UBadge
        ><UButton
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
              <strong>Synthetic demo data.</strong> All issues, assignees and
              edits are fixtures. Edits persist in
              <strong>demo-only in-memory server state</strong>: reloading the
              page keeps saved changes, restarting the server (or Reset below)
              restores the seeded fixtures. No Jira API parity, no real
              permissions, no production persistence.
            </p>
          </div>
          <div v-if="notice" class="save-notice" :class="notice.kind" role="status">
            <UIcon
              :name="
                notice.kind === 'success'
                  ? 'i-lucide-check-circle-2'
                  : 'i-lucide-alert-triangle'
              "
            />
            <p>{{ notice.text }}</p>
          </div>
          <p v-if="loadError" class="save-notice error" role="alert">
            {{ loadError }}
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
            /><span>{{ issues.length }} issues</span>
          </div>
          <div class="demo-controls">
            <USwitch
              v-model="simulateFailure"
              label="Simulate save failure"
              description="Next saves fail on purpose so you can check the draft is kept."
            />
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-rotate-ccw"
              @click="resetDemo"
            >
              Reset demo data
            </UButton>
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
                <tr v-for="issue in issues" :key="issue.key">
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
                    <button class="issue-title" @click="openIssue(issue)">
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
                      :aria-label="`Priority for ${issue.key}`"
                      :loading="rowSaving[issue.key]"
                      @update:model-value="
                        (value) => savePriority(issue.key, String(value))
                      "
                    />
                    <p v-if="rowError[issue.key]" class="row-error" role="alert">
                      {{ rowError[issue.key] }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!issues.length" class="empty">
              No issues match your filters.
            </p>
          </div>
          <div v-else class="board">
            <section
              v-for="column in statuses"
              :key="column"
              class="board-column"
            >
              <header>
                <h2>{{ column }}</h2>
                <span>{{
                  issues.filter((issue) => issue.status === column).length
                }}</span>
              </header>
              <button
                v-for="issue in issues.filter(
                  (issue) => issue.status === column,
                )"
                :key="issue.key"
                class="issue-card"
                @click="openIssue(issue)"
              >
                <strong>{{ issue.title }}</strong
                ><span
                  >{{ issue.key }}
                  <em class="card-priority">{{ issue.priority }}</em
                  ><UIcon
                    :name="
                      issue.type === 'Bug'
                        ? 'i-lucide-bug'
                        : 'i-lucide-square-check'
                    "
                /></span>
              </button>
            </section>
          </div>
          <p class="footer-note">
            Observed Jira statuses · ADEO Nuxt UI v0.1.1 · Fixture content ·
            demo-only in-memory persistence (see docs/jira-teaching-slice.md)
          </p>
        </main>
      </div>
      <USlideover
        :open="!!selected"
        :title="selected?.key"
        :description="selected?.title"
        @update:open="
          (value) => {
            if (!value) closeIssue();
          }
        "
        ><template #body
          ><div v-if="selected" class="issue-details">
            <UBadge color="warning" variant="soft">Synthetic issue</UBadge>
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
            <UFormField label="Edit priority" name="priority">
              <USelect
                v-model="draftPriority"
                :items="priorities"
                aria-label="Edit issue priority"
              />
            </UFormField>
            <p v-if="detailError" class="row-error" role="alert">
              {{ detailError }} Your draft (“{{ draftPriority }}”) is kept.
            </p>
            <div class="detail-actions">
              <UButton
                icon="i-lucide-save"
                :loading="detailSaving"
                :disabled="!draftPriority || draftPriority === selected.priority"
                @click="saveDetailPriority"
              >
                Save priority
              </UButton>
              <UButton :to="config.public.factoryUrl" variant="outline"
                >Shape the next capability in the cockpit</UButton
              >
            </div>
          </div></template
        ></USlideover
      >
    </div></UApp
  >
</template>
