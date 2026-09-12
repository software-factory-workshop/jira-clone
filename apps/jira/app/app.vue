<script setup lang="ts">
import { demoIssues } from "@jira-clone/context";
import {
  OBSERVED_STATUSES,
  PRIORITIES,
  changePriority,
  columnIssues,
  moveIssue,
  moveTargets,
  type BoardIssue,
} from "~/utils/boardMove";

const config = useRuntimeConfig();
const view = ref("list");
const search = ref("");
const status = ref("All statuses");
const statuses: string[] = [...OBSERVED_STATUSES];
const priorities: string[] = [...PRIORITIES];
const selectedKey = ref<string | null>(null);
const issues = ref<BoardIssue[]>(demoIssues.map((issue) => ({ ...issue })));
const loading = ref(true);
const loadError = ref<string | null>(null);
const moveError = ref<string | null>(null);
const priorityError = ref<string | null>(null);
const saveNotice = ref<string | null>(null);
const pendingKeys = ref<string[]>([]);
const draggedKey = ref<string | null>(null);
const dropColumn = ref<string | null>(null);

const selected = computed(
  () => issues.value.find((issue) => issue.key === selectedKey.value) ?? null,
);
const selectedTargets = computed(() =>
  selected.value ? moveTargets(statuses, selected.value.status) : [],
);
const selectedTarget = ref("");
const selectedPriority = ref("");

watch(selected, (issue) => {
  selectedTarget.value = issue ? moveTargets(statuses, issue.status)[0] ?? "" : "";
  selectedPriority.value = issue ? issue.priority : "";
});

const filtered = computed(() =>
  issues.value.filter(
    (issue) =>
      `${issue.key} ${issue.title}`
        .toLowerCase()
        .includes(search.value.toLowerCase()) &&
      (status.value === "All statuses" || issue.status === status.value),
  ),
);

async function saveStatus(
  key: string,
  next: string,
  fail = false,
): Promise<BoardIssue> {
  const saved = await $fetch<{ issue: BoardIssue }>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { status: next, ...(fail ? { fail: true } : {}) },
  });
  return saved.issue;
}

async function savePriority(key: string, next: string): Promise<BoardIssue> {
  const saved = await $fetch<{ issue: BoardIssue }>(`/api/issues/${key}`, {
    method: "PATCH",
    body: { priority: next },
  });
  return saved.issue;
}

async function refresh() {
  loading.value = true;
  loadError.value = null;
  try {
    const data = await $fetch<{ issues: BoardIssue[] }>("/api/issues");
    issues.value = data.issues;
  } catch (error) {
    loadError.value =
      error instanceof Error
        ? error.message
        : "Could not load demo issues. Showing labelled fixtures.";
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

async function resetBoard() {
  moveError.value = null;
  priorityError.value = null;
  saveNotice.value = null;
  try {
    const data = await $fetch<{ issues: BoardIssue[] }>("/api/issues/reset", {
      method: "POST",
    });
    issues.value = data.issues;
    saveNotice.value =
      "Demo board reset to labelled fixture identities. Reset only affects this demo-only store.";
  } catch (error) {
    moveError.value =
      error instanceof Error ? error.message : "Demo reset failed.";
  }
}

function cardMoveLabel(issue: BoardIssue) {
  return `Move ${issue.key} to another column`;
}

function priorityLabel(issue: BoardIssue) {
  return `Change priority for ${issue.key}`;
}

await refresh();
</script>
<template>
  <UApp
    ><div class="jira-shell">
      <header class="jira-header">
        <a class="brand" href="/">ADEO</a
        ><span class="product-name">Jira workspace</span
        ><UBadge color="neutral" variant="subtle">Stage-zero shell</UBadge
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
              <strong>Synthetic demo data.</strong> Review the layout and open
              an issue. Status moves and priority edits use a labelled
              <strong>demo-only save path</strong>: they persist across reload
              on this server and reset on redeploy. Allowed demo statuses are
              To Do, In Progress, In Review and Done; allowed demo priorities
              are Highest, High, Medium, Low and Lowest. No Jira transition
              enforcement is claimed.
            </p>
          </div>
          <div class="demo-save-bar">
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
      <USlideover
        :open="!!selected"
        :title="selected?.key"
        :description="selected?.title"
        @update:open="
          (value) => {
            if (!value) selectedKey = null;
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
            <label class="move-row">
              <span class="move-label">
                <UIcon name="i-lucide-move" />Move
                {{ selected.key }} to another column
              </span>
              <USelect
                v-model="selectedTarget"
                :items="selectedTargets"
                :aria-label="`Move ${selected.key} to another column`"
                :disabled="
                  !selectedTargets.length ||
                  pendingKeys.includes(selected.key)
                "
                size="sm"
              />
            </label>
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
            <UButton :to="config.public.factoryUrl" variant="outline"
              >Shape the next capability in the cockpit</UButton
            >
          </div></template
        ></USlideover
      >
    </div></UApp
  >
</template>
