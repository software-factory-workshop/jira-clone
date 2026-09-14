<script setup lang="ts">
import { computed } from "vue";
import type { DemoAccountOption, IdentitySource } from "~/composables/useDemoAccount";

type AccountItem = { label: string; value: string };

const props = defineProps<{
  identitySource: IdentitySource;
  displayName: string;
  role: DemoAccountOption["role"];
  account: DemoAccountOption;
  accountItems: readonly AccountItem[];
  modelValue: string;
  factoryUrl: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const accountItems = computed(() => [...props.accountItems]);

function updateAccount(value: unknown): void {
  if (typeof value === "string") emit("update:modelValue", value);
}
</script>

<template>
  <header class="jira-header">
    <NuxtLink class="brand" to="/">ADEO</NuxtLink>
    <span class="product-name">Jira workspace</span>
    <UBadge color="neutral" variant="subtle">Demo-only Jira slice</UBadge>
    <div class="demo-account-switcher">
      <UBadge v-if="props.identitySource === 'passport'" color="primary" variant="soft">Passport identity</UBadge>
      <UBadge v-else color="warning" variant="soft">Demo-only identity</UBadge>
      <span v-if="props.identitySource === 'passport'" class="demo-account-passport" role="status">
        {{ props.displayName }} · {{ props.role }}
      </span>
      <USelect
        v-else
        :model-value="props.modelValue"
        :items="accountItems"
        value-key="value"
        aria-label="Demo account"
        size="sm"
        class="demo-account-select"
        @update:model-value="updateAccount"
      />
      <UBadge color="neutral" variant="subtle">
        {{ props.identitySource === "passport" ? `${props.displayName} · ${props.role}` : `${props.account.label} · ${props.account.role}` }}
      </UBadge>
    </div>
    <UButton
      :to="props.factoryUrl"
      variant="outline"
      color="neutral"
      icon="i-lucide-arrow-up-right"
    >Open factory cockpit</UButton>
  </header>
</template>

<style scoped>
.jira-header {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.brand {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.product-name {
  color: var(--ui-text-muted);
}

.demo-account-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

.demo-account-passport {
  color: var(--ui-text-muted);
  font-size: 13px;
}

.demo-account-select {
  min-width: 190px;
}
</style>
