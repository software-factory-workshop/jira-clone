<script setup lang="ts">
import { repository as initialRepository } from "@jira-clone/context";

const { data: manifest } = useFetch<{ repository: typeof initialRepository }>("/factory/cockpit", { server: false });
const repository = computed(() => manifest.value?.repository ?? initialRepository);
const config = useRuntimeConfig();
const route = useRoute();
const isWork = computed(() => route.path.startsWith("/work"));
const sectionLabel = computed(() => {
  if (route.path === "/work/run") return "Current run";
  if (route.path === "/work/recent") return "Recent work";
  if (route.path === "/work/new") return "New draft";
  return isWork.value ? "Work" : "Task mining";
});
</script>

<template>
  <UApp>
    <div class="factory-layout">
      <aside class="sidebar">
        <NuxtLink class="brand" to="/">ADEO<span>factory</span></NuxtLink>
        <div class="workspace-name">
          <span class="workspace-icon">J</span>
          <div>Jira clone<small>Software factory workshop</small></div>
        </div>
        <div class="nav-label">WORKSPACE</div>
        <nav aria-label="Cockpit navigation">
          <NuxtLink
            to="/"
            :class="{ active: route.path === '/' }"
            :aria-current="route.path === '/' ? 'page' : undefined"
          >
            <UIcon name="i-lucide-search" aria-hidden="true" />Task mining
          </NuxtLink>
          <NuxtLink
            to="/work/new"
            :class="{ active: route.path === '/work/new' }"
            :aria-current="route.path === '/work/new' ? 'page' : undefined"
          >
            <UIcon name="i-lucide-file-pen-line" aria-hidden="true" />New draft
          </NuxtLink>
          <NuxtLink
            to="/work/run"
            :class="{ active: route.path === '/work/run' }"
            :aria-current="route.path === '/work/run' ? 'page' : undefined"
          >
            <UIcon name="i-lucide-workflow" aria-hidden="true" />Current run
          </NuxtLink>
          <NuxtLink
            to="/work/recent"
            :class="{ active: route.path === '/work/recent' }"
            :aria-current="route.path === '/work/recent' ? 'page' : undefined"
          >
            <UIcon name="i-lucide-history" aria-hidden="true" />Recent work
          </NuxtLink>
        </nav>
        <div class="sidebar-bottom">
          <UButton
            :to="config.public.jiraUrl"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-up-right"
            >Open Jira workspace</UButton
          ><UButton
            :to="repository.url"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-lucide-github"
            >Repository</UButton
          >
        </div>
      </aside>
      <main>
        <header class="topbar">
          <span>Workshop / <strong>{{ sectionLabel }}</strong></span>
          <div class="topbar-actions">
            <UButton :to="config.public.jiraUrl" color="neutral" variant="ghost" size="xs" icon="i-lucide-arrow-up-right">Jira</UButton>
            <UButton :to="repository.url" target="_blank" color="neutral" variant="ghost" size="xs" icon="i-lucide-github">Repo</UButton>
          </div>
          <UBadge color="neutral" variant="subtle">{{ sectionLabel }}</UBadge>
        </header>
        <div class="page-content">
          <NuxtPage />
        </div>
      </main>
    </div>
  </UApp>
</template>
