<script setup lang="ts">
import { stationLinkSchema } from "../../utils/work-station";

const route = useRoute();

function hasValue(value: unknown) {
  return Array.isArray(value)
    ? value.some(item => typeof item === "string" && item.length > 0)
    : typeof value === "string" && value.length > 0;
}

const query = { ...route.query };
const hasSelectedRun = hasValue(query.delivery) || stationLinkSchema.safeParse(query).success;
delete query.section;
delete query.investigation;

await navigateTo({
  path: hasSelectedRun ? "/work/run" : "/",
  query,
}, { replace: true });
</script>

<template>
  <div aria-hidden="true" />
</template>
