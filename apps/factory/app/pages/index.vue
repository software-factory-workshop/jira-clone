<script setup lang="ts">
import type { ProposalPayload } from "../utils/draft-guard";
import { stationLinkSchema } from "../utils/work-station";

const route = useRoute();
const router = useRouter();
const { queue } = useWorkRequest();

function queryValue(value: unknown): string | undefined {
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
}

function hasValue(value: unknown) {
  return Array.isArray(value)
    ? value.some(item => typeof item === "string" && item.length > 0)
    : typeof value === "string" && value.length > 0;
}

function openProposal(value: ProposalPayload) {
  queue(value);
  void router.push("/work/new");
}

const legacySection = queryValue(route.query.section);
const hasSelectedWork = hasValue(route.query.delivery) || stationLinkSchema.safeParse(route.query).success;
if (legacySection !== undefined || hasSelectedWork) {
  const query = { ...route.query };
  delete query.section;
  if (legacySection === "work" || hasSelectedWork) {
    delete query.investigation;
    await navigateTo({ path: hasSelectedWork ? "/work/run" : "/work/new", query }, { replace: true });
  } else {
    await navigateTo({ path: "/", query }, { replace: true });
  }
}
</script>

<template>
  <MiningStation @draft="openProposal" />
</template>
