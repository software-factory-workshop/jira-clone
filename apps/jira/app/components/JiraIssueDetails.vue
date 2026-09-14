<script setup lang="ts">
import { computed } from "vue";
import { allowedMoveHint, type BoardIssue } from "~/utils/boardMove";
import type { DemoComment } from "~/utils/issueComments";

const props = defineProps<{
  open: boolean;
  issue: BoardIssue | null;
  selectedKey: string | null;
  loading: boolean;
  error: string | null;
  demoOnly: boolean;
  canWrite: boolean;
  readOnlyHint: string;
  detailSummary: string;
  detailAssignee: string;
  detailDescription: string;
  detailSaving: boolean;
  detailDraftInvalid: string | null;
  detailDraftDirty: boolean;
  detailWriteForbidden: string | null;
  detailFieldsError: string | null;
  detailFieldsNotice: string | null;
  selectedTarget: string;
  selectedTargets: readonly string[];
  selectedPriority: string;
  priorities: readonly string[];
  pending: boolean;
  comments: readonly DemoComment[];
  commentsLoading: boolean;
  commentsError: string | null;
  commentsDemoOnly: boolean;
  commentDraft: string;
  commentDraftLocal: boolean;
  commentDraftReloadable: boolean;
  commentSaving: boolean;
  commentError: string | null;
  persistenceLabel: string;
  factoryUrl: string;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  "update:detail-summary": [value: string];
  "update:detail-assignee": [value: string];
  "update:detail-description": [value: string];
  "update:selected-target": [value: string];
  "update:selected-priority": [value: string];
  "update:comment-draft": [value: string];
  "save-detail": [];
  "reset-detail": [];
  move: [key: string, status: string];
  "priority-change": [key: string, priority: string];
  "submit-comment": [];
}>();

const targetItems = computed(() => [...props.selectedTargets]);
const priorityItems = computed(() => [...props.priorities]);

function updateDetailSummary(value: string): void {
  emit("update:detail-summary", value);
}

function updateDetailAssignee(value: string): void {
  emit("update:detail-assignee", value);
}

function updateDetailDescription(value: string): void {
  emit("update:detail-description", value);
}

function updateSelectedTarget(value: unknown): void {
  if (typeof value === "string") emit("update:selected-target", value);
}

function updateSelectedPriority(value: unknown): void {
  if (typeof value === "string") emit("update:selected-priority", value);
}

function moveSelected(): void {
  if (props.issue && props.selectedTarget) {
    emit("move", props.issue.key, props.selectedTarget);
  }
}

function saveSelectedPriority(): void {
  if (props.issue && props.selectedPriority) {
    emit("priority-change", props.issue.key, props.selectedPriority);
  }
}

function commentKey(comment: DemoComment): string {
  return comment.id || `${comment.author}-${comment.createdAt}`;
}
</script>

<template>
  <USlideover
    :open="props.open"
    :title="props.issue?.key ?? props.selectedKey ?? undefined"
    :description="props.issue?.title"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p v-if="props.loading" class="empty" role="status">Loading issue detail…</p>
      <p v-else-if="props.error" class="save-error" role="alert">
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" /> Could not load
        {{ props.selectedKey }}: {{ props.error }} List data is unchanged and nothing was saved.
      </p>
      <div v-else-if="props.issue" class="issue-details">
        <UBadge color="warning" variant="soft">Synthetic issue</UBadge>
        <UBadge v-if="props.demoOnly" color="neutral" variant="subtle">Demo-only read</UBadge>

        <form class="detail-fields" @submit.prevent="emit('save-detail')">
          <label class="create-field">
            <span>Summary</span>
            <UInput
              :model-value="props.detailSummary"
              placeholder="Issue summary"
              :aria-label="`Edit summary for ${props.issue.key}`"
              :disabled="!props.canWrite || props.detailSaving"
              @update:model-value="updateDetailSummary"
            />
          </label>
          <div class="create-row">
            <label class="create-field">
              <span>Assignee (send Unassigned to clear)</span>
              <UInput
                :model-value="props.detailAssignee"
                placeholder="Unassigned"
                :aria-label="`Edit assignee for ${props.issue.key}`"
                :disabled="!props.canWrite || props.detailSaving"
                @update:model-value="updateDetailAssignee"
              />
            </label>
            <p class="demo-save-hint">Status: {{ props.issue.status }} · Type: {{ props.issue.type }} · Priority: {{ props.issue.priority }}</p>
          </div>
          <label class="create-field">
            <span>Description (empty clears it)</span>
            <UTextarea
              :model-value="props.detailDescription"
              placeholder="Demo-only description"
              :aria-label="`Edit description for ${props.issue.key}`"
              :disabled="!props.canWrite || props.detailSaving"
              @update:model-value="updateDetailDescription"
            />
          </label>
          <p v-if="!props.canWrite" class="save-note" role="status">
            <UIcon name="i-lucide-eye" aria-hidden="true" /> {{ props.readOnlyHint }} The API remains the permission authority.
          </p>
          <p v-if="props.detailWriteForbidden" class="save-note" role="status">
            <UIcon name="i-lucide-eye" aria-hidden="true" /> {{ props.detailWriteForbidden }}
          </p>
          <p v-if="props.detailFieldsError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" aria-hidden="true" /> Demo save failed:
            {{ props.detailFieldsError }} Your draft is kept for retry and nothing was saved.
          </p>
          <p v-if="props.detailFieldsNotice" class="save-note" role="status">
            <UIcon name="i-lucide-check" aria-hidden="true" /> {{ props.detailFieldsNotice }}
          </p>
          <div class="create-actions">
            <UButton
              type="submit"
              icon="i-lucide-save"
              :loading="props.detailSaving"
              :disabled="!props.canWrite || props.detailSaving || !!props.detailDraftInvalid || !props.detailDraftDirty"
            >Save summary, assignee and description</UButton>
            <UButton
              variant="outline"
              color="neutral"
              :disabled="!props.canWrite || props.detailSaving || !props.detailDraftDirty"
              @click="emit('reset-detail')"
            >Reset draft</UButton>
          </div>
          <p class="demo-save-hint">
            Demo-only save: edits persist across reload on this server and reset on redeploy.
            Blank summaries and blank assignees are rejected before saving; Unassigned clears the assignee and an empty description clears it.
          </p>
        </form>

        <label class="move-row">
          <span class="move-label">
            <UIcon name="i-lucide-move" aria-hidden="true" />Move {{ props.issue.key }} to another column
          </span>
          <USelect
            :model-value="props.selectedTarget"
            :items="targetItems"
            :aria-label="`Move ${props.issue.key} to another column`"
            aria-describedby="allowed-detail"
            :disabled="!props.canWrite || !targetItems.length || props.pending"
            size="sm"
            @update:model-value="updateSelectedTarget"
          />
        </label>
        <p id="allowed-detail" class="demo-save-hint">{{ allowedMoveHint(props.issue.status) }}</p>
        <UButton
          icon="i-lucide-move"
          :loading="props.pending"
          :disabled="!props.canWrite || !props.selectedTarget"
          @click="moveSelected"
        >Move to {{ props.selectedTarget || "…" }}</UButton>

        <label class="move-row">
          <span class="move-label">
            <UIcon name="i-lucide-flag" aria-hidden="true" />Demo-only priority for {{ props.issue.key }}
          </span>
          <USelect
            :model-value="props.selectedPriority"
            :items="priorityItems"
            :aria-label="`Change priority for ${props.issue.key}`"
            :disabled="!props.canWrite || props.pending"
            size="sm"
            @update:model-value="updateSelectedPriority"
          />
        </label>
        <UButton
          icon="i-lucide-flag"
          :loading="props.pending"
          :disabled="!props.canWrite || !props.selectedPriority || props.selectedPriority === props.issue.priority"
          @click="saveSelectedPriority"
        >Save priority{{ props.selectedPriority && props.selectedPriority !== props.issue.priority ? ` (${props.selectedPriority})` : "" }}</UButton>

        <section aria-label="Demo-only comments">
          <h3>Comments · demo-only</h3>
          <p class="demo-save-hint">
            Demo-only discussion. Comments are synthetic, reset with the board, and use {{ props.persistenceLabel }}.
          </p>
          <p v-if="props.commentsLoading" class="empty" role="status">Loading demo comments…</p>
          <p v-else-if="props.commentsError" class="save-error" role="alert">
            <UIcon name="i-lucide-triangle-alert" aria-hidden="true" /> Could not load demo comments: {{ props.commentsError }}
          </p>
          <div v-else>
            <UBadge v-if="props.commentsDemoOnly" color="neutral" variant="subtle">Demo-only comments</UBadge>
            <p v-if="!props.comments.length" class="empty">No demo comments yet. Start the discussion below.</p>
            <ul v-else class="comment-list">
              <li v-for="comment in props.comments" :key="commentKey(comment)" class="comment-item">
                <p class="comment-meta">
                  <strong>{{ comment.author }}</strong>
                  <UBadge color="neutral" variant="subtle">Demo-only</UBadge>
                </p>
                <p class="comment-body">{{ comment.body }}</p>
              </li>
            </ul>
          </div>
          <form class="comment-form" @submit.prevent="emit('submit-comment')">
            <label class="create-field">
              <span>Add a demo comment</span>
              <UTextarea
                :model-value="props.commentDraft"
                placeholder="Write a demo-only comment"
                aria-label="Add a demo comment"
                :disabled="!props.canWrite || props.commentSaving"
                @update:model-value="emit('update:comment-draft', $event)"
              />
            </label>
            <p v-if="props.commentDraftLocal && props.commentDraft" class="demo-save-hint" role="status">
              <span v-if="props.commentDraftReloadable">Locally kept draft for {{ props.selectedKey }} — posting clears it.</span>
              <span v-else>Session-only draft for {{ props.selectedKey }}: storage is unavailable, so it survives dialog close but not reload — posting clears it.</span>
            </p>
            <p class="demo-save-hint">
              Drafts are kept locally per issue and survive dialog close<span v-if="props.commentDraftReloadable"> or reload</span><span v-else> within this session; reload retention is unavailable while storage is blocked</span>.
            </p>
            <p v-if="props.commentError" class="save-error" role="alert">
              <UIcon name="i-lucide-triangle-alert" aria-hidden="true" /> Demo comment failed: {{ props.commentError }} Your draft is kept for retry.
            </p>
            <UButton
              type="submit"
              icon="i-lucide-message-square-plus"
              :loading="props.commentSaving"
              :disabled="!props.canWrite || !props.commentDraft.trim()"
            >Add demo comment</UButton>
          </form>
        </section>
        <UButton :to="props.factoryUrl" variant="outline">Shape the next capability in the cockpit</UButton>
      </div>
    </template>
  </USlideover>
</template>
