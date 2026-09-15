<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { z } from "zod";

type DraftPayload = {
  title: string;
  body: string;
  id?: string;
  version?: number;
};

const emit = defineEmits<{ draft: [value: DraftPayload] }>();
const savedSchema = z.array(z.object({ id: z.string().min(1), label: z.string(), createdAt: z.string() })).max(30);
const linkedDraftSchema = z.string().min(1).max(240).regex(/^[\w:.-]+$/);
const sourceWorkOrderResponseSchema = z.object({
  item: z.object({
    id: linkedDraftSchema,
    version: z.number().int().positive(),
    value: z.object({ title: z.string().trim().min(1).max(200), request: z.string().trim().min(1).max(40000) }).passthrough(),
  }).nullable(),
});
type SavedInvestigation = z.infer<typeof savedSchema>[number];
type SourceWorkOrder = {
  id: string;
  version: number;
  title: string;
  request: string;
};

const history = shallowRef<SavedInvestigation[]>([]);
const sourceWorkOrder = shallowRef<SourceWorkOrder>();
const selected = ref<string>();
const generation = ref(0);
const storageNotice = ref("");
const historyLoading = ref(false);
const draftLoading = ref(false);
const draftError = ref("");
const historyLastRefreshed = ref<Date>();
const storageKey = "adeo-factory-mining-v1";
const latestInvestigation = computed(() => history.value[0]);
const route = useRoute();
const router = useRouter();
const cockpit = useCockpit();
const linkedDraftId = computed(() => {
  const value = Array.isArray(route.query.draft) ? route.query.draft[0] : route.query.draft;
  const parsed = linkedDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
});
const linkedInvestigationId = computed(() => {
  const value = Array.isArray(route.query.investigation) ? route.query.investigation[0] : route.query.investigation;
  const parsed = z.string().regex(/^wrun_[A-Za-z0-9_-]+$/).safeParse(value);
  return parsed.success ? parsed.data : undefined;
});
const activeSessionId = computed(() => linkedDraftId.value ? linkedInvestigationId.value : selected.value);

function readLegacyHistory(): SavedInvestigation[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return savedSchema.parse(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return [];
  }
}

function historyFromCockpit(): SavedInvestigation[] {
  return cockpit.items.value.runs
    .filter((record) => record.value.station === "mining")
    .map((record) => ({
      id: record.id,
      label: String(record.value.label),
      createdAt: record.createdAt,
    }));
}

function syncHistory(): void {
  history.value = historyFromCockpit();
  if (linkedDraftId.value) {
    selected.value = undefined;
  } else if (linkedInvestigationId.value) {
    selected.value = linkedInvestigationId.value;
  } else if (!selected.value || !history.value.some(item => item.id === selected.value)) {
    selected.value = history.value[0]?.id;
  }
  historyLastRefreshed.value = new Date();
}

async function loadSourceWorkOrder(): Promise<void> {
  const id = linkedDraftId.value;
  sourceWorkOrder.value = undefined;
  draftError.value = "";
  if (!id) return;
  draftLoading.value = true;
  try {
    const response = sourceWorkOrderResponseSchema.parse(await $fetch(`/factory/cockpit/records/drafts/${encodeURIComponent(id)}`, { retry: 0 }));
    if (!response.item) throw new Error("The saved work order no longer exists.");
    const value = response.item.value;
    sourceWorkOrder.value = { id: response.item.id, version: response.item.version, title: value.title, request: value.request };
  } catch {
    draftError.value = "The saved work order could not be loaded. Return to the work-order page and retry without losing your draft.";
  } finally {
    draftLoading.value = false;
  }
}

async function loadHistory(): Promise<void> {
  if (historyLoading.value) return;
  historyLoading.value = true;
  storageNotice.value = "";
  try {
    const legacy = readLegacyHistory();
    await cockpit.migrate(
      "runs",
      legacy.map((run) => ({
        id: run.id,
        value: { label: run.label, station: "mining" },
      })),
    );
    syncHistory();
  } catch {
    storageNotice.value =
      "Shared investigations could not be loaded. You can still create a work order; browser history remains untouched.";
  } finally {
    historyLoading.value = false;
  }
}

cockpit.watchCollection("runs", {
  intervalMs: 10_000,
  onRefresh() {
    syncHistory();
  },
  onError() {
    storageNotice.value =
      "Shared investigations could not be refreshed. Your current work order and session link are retained.";
  },
});

onMounted(() => {
  void Promise.all([loadHistory(), loadSourceWorkOrder()]);
});

async function remember(id: string, label: string) {
  void router.replace({ query: { ...route.query, investigation: id } });
  if (history.value.some(item => item.id === id)) return;
  history.value = [
    { id, label: label.slice(0, 90), createdAt: new Date().toISOString() },
    ...history.value,
  ].slice(0, 30);
  try {
    const row = cockpit.items.value.runs.find((record) => record.id === id);
    await cockpit.save(
      "runs",
      id,
      { label, station: "mining", ...(linkedDraftId.value ? { draftId: linkedDraftId.value } : {}) },
      row?.version ?? 0,
    );
  } catch {
    storageNotice.value =
      "Shared history is unavailable. Keep the session ID below to reopen this investigation.";
  }
}

function fresh() {
  void router.push("/");
}

function choose(id: string) {
  selected.value = id;
  sourceWorkOrder.value = undefined;
  void router.replace({ path: "/task-mining", query: { investigation: id } });
}
</script>

<template>
  <AdeoPageHeader eyebrow="STEP 02 · TASK MINING" title="Verify the work order" description="Eve checks the saved request against the code and current work. Review the evidence, then approve or reject the investigation before any worker starts.">
    <template #actions>
      <UButton to="/" icon="i-lucide-clipboard-pen-line" color="neutral" variant="outline">Edit work order</UButton>
    </template>
  </AdeoPageHeader>
  <div class="mining-layout">
    <section>
      <UAlert v-if="draftLoading" color="primary" variant="soft" title="Loading the saved work order" description="Your editor is on a separate page, so investigation refreshes cannot replace its text." />
      <UAlert v-else-if="draftError" color="warning" variant="soft" title="Work order unavailable" :description="draftError">
        <template #actions><UButton to="/" size="xs">Return to work order</UButton></template>
      </UAlert>
      <UAlert v-else-if="!sourceWorkOrder && !selected" color="neutral" variant="soft" title="Start with a work order" description="Create and save the request on the home page. Task mining will open automatically with that exact text.">
        <template #actions><UButton to="/" size="xs">Create work order</UButton></template>
      </UAlert>
      <ClientOnly>
        <MiningRun
          v-if="sourceWorkOrder || selected"
          :key="`${sourceWorkOrder?.id || selected || 'new'}-${generation}`"
          :session-id="activeSessionId"
          :source-work-order="sourceWorkOrder"
          @session="remember"
          @draft="emit('draft', $event)"
          @new="fresh"
        />
      </ClientOnly>
      <UAlert v-if="storageNotice" color="warning" variant="soft" title="Shared investigation history is unavailable" :description="storageNotice">
        <template #actions>
          <UButton size="xs" variant="outline" :loading="historyLoading" :disabled="historyLoading" @click="loadHistory">Retry history</UButton>
          <UButton size="xs" color="neutral" variant="ghost" @click="fresh">Create a new work order</UButton>
        </template>
      </UAlert>
    </section>
    <aside class="panel mining-history">
      <div class="panel-heading">
        <h2>Latest investigation</h2>
        <UButton icon="i-lucide-plus" variant="ghost" aria-label="Create a new work order" :loading="historyLoading" @click="fresh" />
      </div>
      <p class="small muted">Only the latest session is shown here. Eve keeps the run and its findings.</p>
      <p v-if="historyLastRefreshed" class="small muted" role="status">History updated {{ historyLastRefreshed.toLocaleTimeString() }} · refreshes when this tab returns</p>
      <p v-if="!latestInvestigation" class="muted">Your first investigation will appear here.</p>
      <button
        v-else
        class="history-item"
        :class="{ selected: selected === latestInvestigation.id }"
        :aria-pressed="selected === latestInvestigation.id"
        :aria-current="selected === latestInvestigation.id ? 'page' : undefined"
        @click="choose(latestInvestigation.id)"
      >
        <UIcon name="i-lucide-search" aria-hidden="true" />
        <span>
          {{ latestInvestigation.label }}
          <small>{{ new Date(latestInvestigation.createdAt).toLocaleString() }}</small>
        </span>
      </button>
      <div class="stage-note">
        <UIcon name="i-lucide-git-branch" aria-hidden="true" />
        <p>Each run reads a pinned revision of <strong>jira-clone</strong>, plus current GitHub work and Vercel deployment evidence. Checks run in a disposable sandbox.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.mining-layout { display:grid; grid-template-columns:minmax(0, 1fr) 310px; gap:28px; align-items:start; }
.mining-history { padding:24px; }
.history-item { display:flex; width:100%; gap:10px; text-align:left; padding:14px 0; border-bottom:1px solid var(--ui-border); cursor:pointer; }
.history-item.selected { color:var(--ui-primary); }
.history-item small { display:block; color:var(--ui-text-muted); margin-top:5px; }
.mining-history .stage-note { margin-top:24px; }
@media(max-width:1100px) { .mining-layout { grid-template-columns:1fr; } }
</style>
