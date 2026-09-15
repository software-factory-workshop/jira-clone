<script setup lang="ts">
import { computed } from "vue";
import { boardTypeLabel, type JiraBoard } from "~/utils/jiraBoards";

type JiraView = "list" | "board";

const props = defineProps<{
  boards: readonly JiraBoard[];
  boardsLoading: boolean;
  boardsError: string | null;
}>();
const view = defineModel<JiraView>("view", { required: true });
const boardId = defineModel<string>("boardId", { required: true });

function selectView(next: JiraView): void {
  view.value = next;
}

const boardItems = computed(() =>
  props.boards.map((board) => ({
    label: `${board.name} · ${boardTypeLabel(board.type)}`,
    value: board.id,
  })),
);
const selectedBoard = computed(
  () =>
    props.boards.find((board) => board.id === boardId.value) ??
    props.boards[0] ??
    null,
);
</script>

<template>
  <aside class="project-sidebar">
    <div class="project-avatar">A</div>
    <h2>ADEO demo</h2>
    <p>Software project · KAN</p>
    <div class="board-selector">
      <span id="board-selector-label">Board</span>
      <USelect
        v-model="boardId"
        :items="boardItems"
        value-key="value"
        :disabled="props.boardsLoading || boardItems.length === 0"
        aria-labelledby="board-selector-label"
        size="sm"
      />
    </div>
    <p v-if="props.boardsLoading" class="board-selector-status" role="status">
      Loading boards…
    </p>
    <p v-else-if="props.boardsError" class="board-selector-error" role="alert">
      {{ props.boardsError }}
    </p>
    <p v-else-if="selectedBoard" class="board-selector-status" role="status">
      {{ boardTypeLabel(selectedBoard.type) }} board · {{ selectedBoard.projectKey }} project
    </p>
    <nav aria-label="Project views">
      <button :class="{ active: view === 'list' }" @click="selectView('list')">
        <UIcon name="i-lucide-list" aria-hidden="true" />List
      </button>
      <button :class="{ active: view === 'board' }" @click="selectView('board')">
        <UIcon name="i-lucide-columns-3" aria-hidden="true" />Board
      </button>
    </nav>
    <div class="sidebar-note">
      <UIcon name="i-lucide-sprout" aria-hidden="true" />
      <p>All demo boards currently share the bounded KAN issue set.</p>
    </div>
  </aside>
</template>
