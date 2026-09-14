---
title: 'Nuxt SSR externalizes app imports of shared TypeScript schemas'
severity: 'minor'
---

## Expected Behavior
A Nuxt production build should bundle a client component that imports a shared TypeScript schema used for validating persisted data.

## Current Behavior
When a Nuxt app component imports the runtime value workOrderAdmissionSchema from apps/factory/shared/cockpit.ts, pnpm --filter @jira-clone/factory build fails during Nitro SSR with an unresolved generated import path.

## Possible Solution
Keep client-facing validation schemas inside apps/factory/app utilities, or add an explicit Nuxt alias/bundling rule for apps/factory/shared imports. This item uses a matching app-local display schema and a type-only shared import, so the build now passes.

## Minimal Reproducible Example
1. Import a runtime schema from apps/factory/shared/cockpit.ts in apps/factory/app/components/NewDraftEditor.vue.
2. Run pnpm --filter @jira-clone/factory build.
3. Observe Rollup cannot resolve the generated ../../../../../../../../apps/factory/shared/cockpit.ts import from the Nuxt SSR chunk.

## Context
Found while implementing the item-5 work-order admission flow. No dependency or route change is required; this is a resolved repository build papercut.
