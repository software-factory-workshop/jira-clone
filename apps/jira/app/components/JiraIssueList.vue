<script setup lang="ts">
import { computed } from "vue";
import type { BoardIssue } from "~/utils/boardMove";

const props = defineProps<{
  issues: readonly BoardIssue[];
  priorities: readonly string[];
  canWrite: boolean;
  pendingKeys: readonly string[];
  filtersActive: boolean;
  emptyHint: string;
}>();

const emit = defineEmits<{
  select: [key: string];
  "priority-change": [key: string, priority: string];
}>();

const priorityItems = computed(() => [...props.priorities]);

function typeIcon(type: string): string {
  if (type === "Bug") return "i-lucide-bug";
  if (type === "Story") return "i-lucide-bookmark";
  return "i-lucide-square-check";
}

function statusColor(status: string): "primary" | "secondary" | "neutral" {
  if (status === "In Progress") return "primary";
  if (status === "In Review") return "secondary";
  return "neutral";
}

function priorityLabel(issue: BoardIssue): string {
  return `Change priority for ${issue.key}`;
}

function updatePriority(issue: BoardIssue, value: unknown): void {
  if (typeof value === "string" && value !== issue.priority) {
    emit("priority-change", issue.key, value);
  }
}
</script>

<template>
  <div class="table-wrap">
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
        <tr v-for="issue in props.issues" :key="issue.key">
          <td>
            <UIcon
              :name="typeIcon(issue.type)"
              :aria-label="issue.type"
              class="type-icon"
            />
          </td>
          <td class="issue-key">{{ issue.key }}</td>
          <td>
            <button class="issue-title" @click="emit('select', issue.key)">
              {{ issue.title }}
            </button>
          </td>
          <td>
            <UBadge :color="statusColor(issue.status)" variant="soft">
              {{ issue.status }}
            </UBadge>
          </td>
          <td class="assignee">{{ issue.assignee }}</td>
          <td>
            <USelect
              :model-value="issue.priority"
              :items="priorityItems"
              :aria-label="priorityLabel(issue)"
              :disabled="!props.canWrite || props.pendingKeys.includes(issue.key)"
              size="sm"
              @update:model-value="updatePriority(issue, $event)"
            />
            <span v-if="props.pendingKeys.includes(issue.key)" class="saving">
              Saving demo edit…
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!props.issues.length" class="empty">{{ props.emptyHint }}</p>
  </div>
</template>
