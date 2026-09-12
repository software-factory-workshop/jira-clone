<script setup lang="ts">
import { z } from "zod";
defineEmits<{ draft: [value: { title: string; body: string }] }>();
const savedSchema = z.array(z.object({ id: z.string().min(1), label: z.string(), createdAt: z.string() })).max(30);
const history = ref<z.infer<typeof savedSchema>>([]);
const selected = ref<string>();
const generation = ref(0);
const storageNotice = ref("");
const storageKey = "adeo-factory-mining-v1";
const route = useRoute();
const router = useRouter();
onMounted(() => {
  try {
    history.value = savedSchema.parse(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    const linkedSession = z.string().regex(/^wrun_[A-Za-z0-9_-]+$/).safeParse(route.query.investigation);
    selected.value = linkedSession.success ? linkedSession.data : history.value[0]?.id;
  } catch { storageNotice.value = "Recent investigations could not be restored from this browser."; }
});
function remember(id: string, label: string) {
  void router.replace({ query: { ...route.query, investigation: id } });
  if (history.value.some(item => item.id === id)) return;
  history.value = [{ id, label: label.slice(0, 90), createdAt: new Date().toISOString() }, ...history.value].slice(0, 30);
  try { localStorage.setItem(storageKey, JSON.stringify(history.value)); }
  catch { storageNotice.value = "Browser storage is unavailable. Keep the session ID below to reopen this investigation."; }
}
function fresh() {
  selected.value = undefined;
  generation.value++;
  void router.replace({ query: { ...route.query, investigation: undefined } });
}
function choose(id: string) {
  selected.value = id;
  void router.replace({ query: { ...route.query, investigation: id } });
}
</script>

<template>
  <AdeoPageHeader eyebrow="STATION 01 · TASK MINING" title="Find the next useful task" description="Understand the goal, the code and the work already in motion. Review proposals before deciding what the factory should do." />
  <div class="mining-layout">
    <section>
      <ClientOnly>
        <MiningRun :key="`${selected || 'new'}-${generation}`" :session-id="selected" @session="remember" @draft="$emit('draft', $event)" @new="fresh" />
      </ClientOnly>
      <p v-if="storageNotice" role="status" class="muted small">{{ storageNotice }}</p>
    </section>
    <aside class="panel mining-history">
      <div class="panel-heading"><h2>Recent investigations</h2><UButton icon="i-lucide-plus" variant="ghost" aria-label="New investigation" @click="fresh" /></div>
      <p class="small muted">This browser remembers the session links. Eve keeps each run and its findings.</p>
      <p v-if="!history.length" class="muted">Your first investigation will appear here.</p>
      <button v-for="item in history" :key="item.id" class="history-item" :class="{ selected: selected === item.id }" @click="choose(item.id)">
        <UIcon name="i-lucide-search" /><span>{{ item.label }}<small>{{ new Date(item.createdAt).toLocaleString() }}</small></span>
      </button>
      <div class="stage-note"><UIcon name="i-lucide-git-branch" /><p>Each run reads a pinned revision of <strong>jira-clone</strong>, plus current GitHub work and Vercel deployment evidence. Checks run in a disposable sandbox.</p></div>
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
