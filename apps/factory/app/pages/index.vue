<script setup lang="ts">
import { stationLinkSchema } from "../utils/work-station";

const route = useRoute();

function queryValue(value: unknown): string | undefined {
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
}

function hasValue(value: unknown) {
  return Array.isArray(value)
    ? value.some(item => typeof item === "string" && item.length > 0)
    : typeof value === "string" && value.length > 0;
}

const legacySection = queryValue(route.query.section);
const hasSelectedWork = hasValue(route.query.delivery) || stationLinkSchema.safeParse(route.query).success;
const hasInvestigation = hasValue(route.query.investigation);
if (legacySection !== undefined || hasSelectedWork || hasInvestigation) {
  const query = { ...route.query };
  delete query.section;
  if (hasSelectedWork) {
    delete query.investigation;
    await navigateTo({ path: "/work/run", query }, { replace: true });
  } else if (hasInvestigation) {
    await navigateTo({ path: "/task-mining", query }, { replace: true });
  } else {
    await navigateTo({ path: "/", query }, { replace: true });
  }
}
</script>

<template>
  <NewDraftEditor />
</template>
