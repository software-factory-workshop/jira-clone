<script setup lang="ts">
import { computed, reactive, watch } from "vue";

export type CreateIssueDraft = {
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

const props = defineProps<{
  open: boolean;
  saving: boolean;
  error: string | null;
  types: readonly string[];
  statuses: readonly string[];
  priorities: readonly string[];
  persistenceLabel: string;
  persistenceDescription: string;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  submit: [draft: CreateIssueDraft];
}>();

const draft = reactive<CreateIssueDraft>(emptyDraft());
const typeItems = computed(() => [...props.types]);
const statusItems = computed(() => [...props.statuses]);
const priorityItems = computed(() => [...props.priorities]);

function emptyDraft(): CreateIssueDraft {
  return {
    title: "",
    type: "Task",
    status: "To Do",
    priority: "Medium",
    assignee: "Unassigned",
    description: "",
  };
}

function resetDraft(): void {
  Object.assign(draft, emptyDraft());
}

function submit(): void {
  emit("submit", { ...draft });
}

function updateOpen(open: boolean): void {
  if (!open && !props.saving) emit("update:open", false);
}

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) resetDraft();
  },
);
</script>

<template>
  <UModal
    :open="props.open"
    title="Create demo issue"
    description="Demo-only create through the active issue persistence boundary. The draft is kept when saving fails."
    @update:open="updateOpen"
  >
    <template #body>
      <form class="create-form" @submit.prevent="submit">
        <label class="create-field">
          <span>Summary (required)</span>
          <UInput
            v-model="draft.title"
            placeholder="What needs doing?"
            aria-label="Issue summary"
            autofocus
            :disabled="props.saving"
          />
        </label>
        <div class="create-row">
          <label class="create-field">
            <span>Type</span>
            <USelect
              v-model="draft.type"
              :items="typeItems"
              aria-label="Issue type"
              :disabled="props.saving"
            />
          </label>
          <label class="create-field">
            <span>Status</span>
            <USelect
              v-model="draft.status"
              :items="statusItems"
              aria-label="Issue status"
              :disabled="props.saving"
            />
          </label>
        </div>
        <div class="create-row">
          <label class="create-field">
            <span>Priority</span>
            <USelect
              v-model="draft.priority"
              :items="priorityItems"
              aria-label="Issue priority"
              :disabled="props.saving"
            />
          </label>
          <label class="create-field">
            <span>Assignee</span>
            <UInput
              v-model="draft.assignee"
              placeholder="Unassigned"
              aria-label="Issue assignee"
              :disabled="props.saving"
            />
          </label>
        </div>
        <label class="create-field">
          <span>Description</span>
          <UTextarea
            v-model="draft.description"
            placeholder="Demo-only description"
            aria-label="Issue description"
            :disabled="props.saving"
          />
        </label>
        <p v-if="props.error" class="save-error" role="alert">
          <UIcon name="i-lucide-triangle-alert" aria-hidden="true" /> Demo create failed:
          {{ props.error }} Your draft is kept for retry.
        </p>
        <div class="create-actions">
          <UButton
            type="submit"
            icon="i-lucide-plus"
            :loading="props.saving"
            :disabled="!draft.title.trim()"
          >Create demo issue</UButton>
          <UButton
            variant="outline"
            color="neutral"
            :disabled="props.saving"
            @click="updateOpen(false)"
          >Cancel</UButton>
        </div>
        <p class="demo-save-hint">
          Demo-only save through {{ props.persistenceLabel }}. {{ props.persistenceDescription }}
        </p>
      </form>
    </template>
  </UModal>
</template>
