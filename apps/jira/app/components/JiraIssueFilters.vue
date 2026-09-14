<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from "vue";
import { ALL_STATUSES } from "~/utils/boardMove";

const props = defineProps<{
  search: string;
  status: string;
  assignee: string;
  statuses: readonly string[];
  assignees: readonly string[];
  summary: string;
  filtersActive: boolean;
}>();

const emit = defineEmits<{
  "update:search": [value: string];
  "update:status": [value: string];
  "update:assignee": [value: string];
  clear: [];
}>();

const filtersRoot = useTemplateRef<HTMLElement>("filtersRoot");

function clearFilters(): void {
  // One keyboard-friendly step back to the full window; return focus to the
  // search field so tab order stays predictable after the action unmounts.
  emit("clear");
  void nextTick(() => {
    filtersRoot.value?.querySelector("input")?.focus();
  });
}

const statusItems = computed(() => [ALL_STATUSES, ...props.statuses]);
const assigneeItems = computed(() => [...props.assignees]);

function updateSearch(value: string): void {
  emit("update:search", value);
}

function updateStatus(value: unknown): void {
  if (typeof value === "string") emit("update:status", value);
}

function updateAssignee(value: unknown): void {
  if (typeof value === "string") emit("update:assignee", value);
}
</script>

<template>
  <div ref="filtersRoot" class="filters" aria-label="Issue filters">
    <UInput
      :model-value="props.search"
      icon="i-lucide-search"
      placeholder="Search issues"
      aria-label="Search issues"
      @update:model-value="updateSearch"
    />
    <USelect
      :model-value="props.status"
      :items="statusItems"
      aria-label="Filter by status"
      @update:model-value="updateStatus"
    />
    <USelect
      :model-value="props.assignee"
      :items="assigneeItems"
      aria-label="Filter by assignee"
      @update:model-value="updateAssignee"
    />
    <UButton
      v-if="props.filtersActive"
      icon="i-lucide-x"
      variant="outline"
      color="neutral"
      size="sm"
      aria-label="Clear filters"
      @click="clearFilters"
    >
      Clear filters
    </UButton>
    <span>{{ props.summary }}</span>
  </div>
</template>
