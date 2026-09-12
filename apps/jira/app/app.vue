<script setup lang="ts">
import { demoIssues } from "@jira-clone/context";
const config = useRuntimeConfig();
const view = ref("list");
const search = ref("");
const status = ref("All statuses");
const statuses = ["To Do", "In Progress", "In Review", "Done"];
const selected = ref<(typeof demoIssues)[number] | null>(null);
const issues = computed(() =>
  demoIssues.filter(
    (issue) =>
      `${issue.key} ${issue.title}`
        .toLowerCase()
        .includes(search.value.toLowerCase()) &&
      (status.value === "All statuses" || issue.status === status.value),
  ),
);
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
              an issue. Changes, accounts and Jira-compatible APIs arrive in
              later stages.
            </p>
          </div>
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
            /><span>{{ issues.length }} issues</span>
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
                    <button class="issue-title" @click="selected = issue">
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
                  <td>{{ issue.priority }}</td>
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
                @click="selected = issue"
              >
                <strong>{{ issue.title }}</strong
                ><span
                  >{{ issue.key
                  }}<UIcon
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
            Observed Jira statuses · ADEO Nuxt UI v0.1.1 · Fixture content
          </p>
        </main>
      </div>
      <USlideover
        :open="!!selected"
        :title="selected?.key"
        :description="selected?.title"
        @update:open="
          (value) => {
            if (!value) selected = null;
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
            <UButton :to="config.public.factoryUrl" variant="outline"
              >Shape the next capability in the cockpit</UButton
            >
          </div></template
        ></USlideover
      >
    </div></UApp
  >
</template>
