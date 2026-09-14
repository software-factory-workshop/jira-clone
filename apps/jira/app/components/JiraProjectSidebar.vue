<script setup lang="ts">
type JiraView = "list" | "board";

const props = defineProps<{ view: JiraView }>();
const emit = defineEmits<{ "update:view": [view: JiraView] }>();

function selectView(view: JiraView): void {
  emit("update:view", view);
}
</script>

<template>
  <aside class="project-sidebar">
    <div class="project-avatar">A</div>
    <h2>ADEO demo</h2>
    <p>Software project</p>
    <nav aria-label="Project views">
      <button :class="{ active: props.view === 'list' }" @click="selectView('list')">
        <UIcon name="i-lucide-list" aria-hidden="true" />List
      </button>
      <button :class="{ active: props.view === 'board' }" @click="selectView('board')">
        <UIcon name="i-lucide-columns-3" aria-hidden="true" />Board
      </button>
    </nav>
    <div class="sidebar-note">
      <UIcon name="i-lucide-sprout" aria-hidden="true" />
      <p>The factory will grow this workspace one capability at a time.</p>
    </div>
  </aside>
</template>
