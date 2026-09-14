<script setup lang="ts">
type GithubLifecycle = "draft" | "ready" | "merged" | "closed";
type BadgeColor = "primary" | "info" | "warning" | "success" | "error" | "neutral";

interface GithubChecks {
  status: "passed" | "pending" | "failed";
  total: number;
  completed: number;
  requiredPassed: boolean;
  failures: string[];
  pending: string[];
  blockers: string[];
}

interface GithubSnapshot {
  number: number;
  url: string;
  lifecycle: GithubLifecycle;
  draft: boolean;
  merged: boolean;
  headSha: string;
  targetHeadSha: string;
  targetBranch: string;
  mergeable: boolean | null;
  mergeableState?: string;
  checkedAt: string;
  checks: GithubChecks;
  blockers: string[];
}

interface Publication {
  number: number;
  url: string;
  headSha?: string;
  targetHeadSha?: string;
  targetBranch?: string;
}

interface Review {
  verdict?: string;
  summary?: string;
}

interface MergeDecision {
  status: "merged" | "manual" | "waiting" | "eligible";
  reason?: string;
  blockers?: string[];
  checkedHeadSha?: string;
  checkedAt?: string;
}

const props = withDefaults(defineProps<{
  publication: Publication;
  github?: GithubSnapshot;
  review?: Review;
  mergeDecision?: MergeDecision;
  busy?: boolean;
  refreshing?: boolean;
  readying?: boolean;
  merging?: boolean;
}>(), {
  busy: false,
  refreshing: false,
  readying: false,
  merging: false,
});

const emit = defineEmits<{
  refresh: [];
  ready: [];
  merge: [];
}>();

const blockers = computed(() => {
  const values = [
    ...(props.github?.blockers || []),
    ...(props.github?.checks.blockers || []),
    ...(props.mergeDecision?.blockers || []),
  ];
  if (props.mergeDecision?.status === "manual" || props.mergeDecision?.status === "waiting") values.push(props.mergeDecision.reason || "The host has not cleared the merge policy.");
  return [...new Set(values.filter(Boolean))];
});

const canReady = computed(() => props.github?.lifecycle === "draft");
const canMerge = computed(() => props.github?.lifecycle === "ready" && props.mergeDecision?.status === "eligible");

function githubLabel(): string {
  if (!props.github) return "Not checked";
  return props.github.lifecycle === "draft" ? "Draft" : props.github.lifecycle === "ready" ? "Ready for review" : props.github.lifecycle === "merged" ? "Merged" : "Closed";
}
function githubColor(): BadgeColor {
  if (!props.github) return "neutral";
  return props.github.lifecycle === "merged" ? "success" : props.github.lifecycle === "closed" ? "error" : props.github.lifecycle === "draft" ? "warning" : "success";
}
function validationLabel(): string {
  if (!props.github) return "Not checked";
  return props.github.checks.status === "passed" ? "Passed" : props.github.checks.status === "failed" ? "Failed" : "Pending";
}
function validationColor(): BadgeColor {
  if (!props.github) return "neutral";
  return props.github.checks.status === "passed" ? "success" : props.github.checks.status === "failed" ? "error" : "warning";
}
function reviewLabel(): string {
  const verdict = props.review?.verdict;
  return verdict === "approve" ? "Accepted" : verdict === "changes_requested" ? "Changes requested" : verdict === "incomplete" ? "Incomplete" : "Pending";
}
function reviewColor(): BadgeColor {
  const verdict = props.review?.verdict;
  return verdict === "approve" ? "success" : verdict === "changes_requested" ? "error" : verdict === "incomplete" ? "warning" : "neutral";
}
function policyLabel(): string {
  const status = props.mergeDecision?.status;
  return status === "eligible" ? "Merge eligible" : status === "merged" ? "Merged" : status === "waiting" ? "Waiting" : status === "manual" ? "Blocked" : "Not checked";
}
function policyColor(): BadgeColor {
  const status = props.mergeDecision?.status;
  return status === "eligible" || status === "merged" ? "success" : status === "waiting" ? "warning" : status === "manual" ? "error" : "neutral";
}
function checkedAt(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `Checked ${date.toLocaleTimeString()}`;
}
</script>

<template>
  <section class="pr-lifecycle" aria-labelledby="pr-lifecycle-heading">
    <div class="lifecycle-heading">
      <div>
        <p class="lifecycle-eyebrow">Pull request lifecycle</p>
        <h3 id="pr-lifecycle-heading">PR #{{ publication.number }}</h3>
      </div>
      <span class="small muted">GitHub is authoritative for lifecycle and merge result.</span>
    </div>

    <div class="lifecycle-grid">
      <div class="lifecycle-row"><span>GitHub</span><div><UBadge :color="githubColor()" variant="soft">{{ githubLabel() }}</UBadge><small v-if="github">{{ checkedAt(github.checkedAt) }}</small></div></div>
      <div class="lifecycle-row"><span>Validation</span><div><UBadge :color="validationColor()" variant="soft">{{ validationLabel() }}</UBadge><small v-if="github">{{ github.checks.completed }}/{{ github.checks.total }} checks observed</small></div></div>
      <div class="lifecycle-row"><span>Cockpit review</span><div><UBadge :color="reviewColor()" variant="soft">{{ reviewLabel() }}</UBadge><small v-if="review?.summary">{{ review.summary }}</small></div></div>
      <div class="lifecycle-row"><span>Policy</span><div><UBadge :color="policyColor()" variant="soft">{{ policyLabel() }}</UBadge><small v-if="mergeDecision?.checkedHeadSha">Head {{ mergeDecision.checkedHeadSha.slice(0, 8) }}</small></div></div>
    </div>

    <div v-if="blockers.length" class="lifecycle-blockers" role="alert">
      <strong>What is blocking the next action</strong>
      <ul><li v-for="blocker in blockers" :key="blocker">{{ blocker }}</li></ul>
    </div>
    <p v-else-if="!github" class="small muted lifecycle-help">Refresh to read the current GitHub lifecycle, checks, conflicts, and merge result.</p>
    <p v-else-if="canReady" class="small muted lifecycle-help">This PR is still Draft. Mark it ready for review here before merge eligibility can be evaluated.</p>

    <div class="lifecycle-actions">
      <UButton variant="outline" icon="i-lucide-refresh-cw" :loading="refreshing" :disabled="busy || refreshing" @click="emit('refresh')">Refresh GitHub status</UButton>
      <UButton v-if="canReady" color="primary" icon="i-lucide-eye" :loading="readying" :disabled="busy || readying" @click="emit('ready')">Mark ready for review</UButton>
      <UButton v-if="canMerge" color="primary" icon="i-lucide-git-merge" :loading="merging" :disabled="busy || merging" @click="emit('merge')">Merge pull request</UButton>
    </div>
  </section>
</template>

<style scoped>
.pr-lifecycle { display: grid; gap: 16px; margin: 24px 0 0; padding: 18px; border: 1px solid var(--ui-border); border-radius: 8px; background: #fbfdfd; }
.lifecycle-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.lifecycle-heading h3 { margin: 0; font-size: 16px; font-weight: 650; }
.lifecycle-eyebrow { margin: 0 0 5px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.lifecycle-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.lifecycle-row { display: grid; gap: 7px; min-width: 0; padding: 12px; border: 1px solid var(--ui-border); border-radius: 6px; background: #fff; }
.lifecycle-row > span { color: var(--ui-text-muted); font-size: 11px; font-weight: 650; }
.lifecycle-row > div { display: grid; gap: 5px; min-width: 0; }
.lifecycle-row small { overflow: hidden; color: var(--ui-text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.lifecycle-blockers { padding: 12px 14px; border-left: 3px solid #bb7410; background: #fff9ef; color: #684b1d; font-size: 12px; line-height: 1.5; }
.lifecycle-blockers ul { display: grid; gap: 4px; margin: 7px 0 0; padding-left: 18px; }
.lifecycle-help { margin: 0; }
.lifecycle-actions { display: flex; flex-wrap: wrap; gap: 9px; }
@media (max-width: 760px) { .lifecycle-heading { align-items: flex-start; flex-direction: column; } .lifecycle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 460px) { .lifecycle-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
