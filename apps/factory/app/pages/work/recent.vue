<template>
  <AdeoPageHeader
    eyebrow="WORKSPACE · RECENT WORK"
    title="Recent work"
    description="Reopen a delivery or station run from the shared cockpit. Current run keeps the live workspace separate from this list."
  >
    <template #actions>
      <UButton to="/work/new" icon="i-lucide-file-pen-line">New draft</UButton>
      <UButton to="/work/run" color="neutral" variant="outline" icon="i-lucide-workflow">Current run</UButton>
    </template>
  </AdeoPageHeader>

  <WorkHistory :show-heading="false" />
</template>
