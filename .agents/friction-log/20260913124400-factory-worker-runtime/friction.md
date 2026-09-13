---
title: 'Factory worker cannot publish fixes to factory runtime'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#66'
---

## Expected Behavior
A factory worker should be able to author a narrowly reviewed fix to the factory's own runtime when the task explicitly targets delivery orchestration or station reliability. The host should keep the same one-writer, provenance, verification and review fences while offering a privileged, auditable maintenance path.

## Current Behavior
A worker tasked with repairing the durable delivery observer and same-owner revision path can read and test `apps/factory/runtime/**`, but `publish_work` rejects every runtime change through `allowedWorkPath`. The worker consequently published UI/document substitutes (#49/#50) or stopped, while the requested runtime behavior remained unchanged.

## Possible Solution
Add a separate factory-maintenance station or an explicit host-resolved policy grant for selected runtime files. Keep the normal worker allowlist closed, require a bounded path list and independent review, and make publication failures explain the missing authority instead of encouraging a substitute PR.

## Minimal Reproducible Example
Start a delivery with a brief to fix `apps/factory/runtime/lib/delivery-events.ts` or `apps/factory/runtime/channels/delivery.ts`. The worker can inspect and edit the files in its sandbox, but `publish_work` returns a protected-path error before any GitHub write.

## Context
This blocked a real dinner-time factory improvement batch: the observer and owner-continuation repairs were needed to make the deterministic workflow reliable. `factory/work-stations.md` documents runtime as protected and says expansion is a separate reviewed factory change, but no callable maintenance workflow exists.
