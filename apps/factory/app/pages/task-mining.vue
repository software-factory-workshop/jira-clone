<script setup lang="ts">
import type { ProposalPayload } from "../utils/draft-guard";

const router = useRouter();
const { queue } = useWorkRequest();

function editProposal(value: ProposalPayload) {
  queue(value);
  void router.push("/");
}
</script>

<template>
  <MiningStation @draft="editProposal" />
</template>
