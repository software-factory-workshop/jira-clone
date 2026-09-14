<script setup lang="ts">
import type { DeliveryStatusSummary } from "../utils/delivery-summary";

defineProps<{ summary: DeliveryStatusSummary }>();
</script>

<template>
  <section class="delivery-summary" aria-label="Delivery summary">
    <div class="summary-heading">
      <p class="summary-eyebrow">At a glance</p>
      <UBadge :color="summary.phaseColor" variant="soft">{{ summary.phaseLabel }}</UBadge>
    </div>
    <dl class="summary-grid">
      <div>
        <dt>Latest result</dt>
        <dd>{{ summary.latestResult }}</dd>
      </div>
      <div v-if="summary.blocker">
        <dt>Blocker</dt>
        <dd>{{ summary.blocker }}</dd>
      </div>
      <div>
        <dt>Next action</dt>
        <dd>{{ summary.nextAction }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.delivery-summary {
  display: grid;
  gap: 12px;
  margin: 20px 0 24px;
  padding: 16px;
  border: 1px solid #dce9e9;
  border-radius: 6px;
  background: #f8fbfb;
}
.summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.summary-eyebrow {
  margin: 0;
  color: var(--ui-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.1px;
  text-transform: uppercase;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
}
.summary-grid div {
  min-width: 0;
}
.summary-grid dt {
  margin-bottom: 4px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 650;
}
.summary-grid dd {
  margin: 0;
  color: var(--ui-text);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
