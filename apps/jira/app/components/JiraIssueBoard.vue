<script setup lang="ts">
import { computed, ref } from "vue";
import { allowedMoveHint, columnIssues, type BoardIssue } from "~/utils/boardMove";

const props = defineProps<{
  issues: readonly BoardIssue[];
  columns: readonly string[];
  canWrite: boolean;
  pendingKeys: readonly string[];
  filtersActive: boolean;
  countLabel: string;
}>();

const emit = defineEmits<{
  select: [key: string];
  move: [key: string, status: string];
}>();

const draggedKey = ref<string | null>(null);
const dropColumn = ref<string | null>(null);
const issuesByColumn = computed<Record<string, BoardIssue[]>>(() => {
  const grouped: Record<string, BoardIssue[]> = {};
  for (const column of props.columns) {
    grouped[column] = columnIssues(props.issues, column);
  }
  return grouped;
});
const columnItems = computed(() => [...props.columns]);

function issuesForColumn(column: string): BoardIssue[] {
  return issuesByColumn.value[column] ?? [];
}

function cardMoveLabel(issue: BoardIssue): string {
  return `Move ${issue.key} to another column`;
}

function typeIcon(type: string): string {
  if (type === "Bug") return "i-lucide-bug";
  if (type === "Story") return "i-lucide-bookmark";
  return "i-lucide-square-check";
}

function onDragStart(event: DragEvent, key: string): void {
  if (!props.canWrite) return;
  draggedKey.value = key;
  dropColumn.value = null;
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", key);
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragEnd(): void {
  draggedKey.value = null;
  dropColumn.value = null;
}

function onDropColumn(status: string): void {
  const key = draggedKey.value;
  onDragEnd();
  if (key) emit("move", key, status);
}

function selectIssue(key: string): void {
  emit("select", key);
}

function updateStatus(issue: BoardIssue, value: unknown): void {
  if (typeof value === "string" && value !== issue.status) {
    emit("move", issue.key, value);
  }
}
</script>

<template>
  <p class="issue-count" role="status" data-testid="issue-count">{{ props.countLabel }}</p>
  <div class="board">
    <section
      v-for="column in props.columns"
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
        <span>{{ issuesForColumn(column).length }}</span>
      </header>
      <article
        v-for="issue in issuesForColumn(column)"
        :key="issue.key"
        class="issue-card"
        :class="{ dragging: draggedKey === issue.key }"
        :draggable="props.canWrite"
        :aria-label="`${issue.key} ${issue.title}`"
        @dragstart="onDragStart($event, issue.key)"
        @dragend="onDragEnd"
      >
        <button class="issue-title" @click="selectIssue(issue.key)">
          <strong>{{ issue.title }}</strong>
        </button>
        <span>
          {{ issue.key }}
          <span class="issue-type inline-flex items-center gap-1">
            <UIcon :name="typeIcon(issue.type)" aria-hidden="true" class="type-icon" />
            <span>{{ issue.type }}</span>
          </span>
        </span>
        <label class="move-row">
          <span class="move-label">
            <UIcon name="i-lucide-move" aria-hidden="true" />{{ cardMoveLabel(issue) }}
          </span>
          <USelect
            :model-value="issue.status"
            :items="columnItems"
            :aria-label="cardMoveLabel(issue)"
            :aria-describedby="`allowed-${issue.key}`"
            :disabled="!props.canWrite || props.pendingKeys.includes(issue.key)"
            size="sm"
            @update:model-value="updateStatus(issue, $event)"
          />
        </label>
        <p :id="`allowed-${issue.key}`" class="demo-save-hint">
          {{ allowedMoveHint(issue.status) }}
        </p>
        <span v-if="props.pendingKeys.includes(issue.key)" class="saving">
          Saving demo move…
        </span>
      </article>
      <p v-if="!issuesForColumn(column).length" class="empty drop-hint">
        <span v-if="props.filtersActive"
          >No matches in this column for the current filters in this
          window.</span
        ><span v-else>Drop cards here to move them to {{ column }}.</span>
      </p>
    </section>
  </div>
</template>
