---
title: 'eve eval multi-agent workspace discovery requires a remote URL to reach root evals'
severity: 'minor'
---

## Expected Behavior

Running the repository eval command with a selected factory agent should discover the shared eval suite at `apps/factory/evals/`.

## Current Behavior

In the multi-agent `apps/factory` workspace, `eve eval --agent reviewer --list` changes the app root to `apps/factory/agents/reviewer` and reports no evals, even though the shared suite is correctly located at `apps/factory/evals/`.

## Possible Solution

Allow workspace-level eval discovery with an explicit agent target, or document a supported root-level invocation that does not require a remote URL.

## Minimal Reproducible Example

From `apps/factory`, run:

```sh
pnpm exec eve eval --agent reviewer --list
```

Observed: `No evals found. Create files under evals/ with the *.eval.ts extension.`

The same command with `--url <factory-origin>` skips agent selection and discovers the root evals.

## Context

This makes the intended local multi-agent eval workflow unclear and easy to mis-invoke. The impact is minor because the repository evals are present and type-check; root-level discovery works with a remote URL workaround.
