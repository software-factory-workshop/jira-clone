---
title: 'Eve discovery rejects numeric metadata.priority in Vercel plugin skills'
severity: 'minor'
target: 'vercel/eve'
---

## What happened

The factory Eve build cannot discover selected skills downloaded from `vercel/vercel-plugin` because their authored frontmatter contains numeric `metadata.priority` values. Eve discovery reports: `Expected "metadata.priority" frontmatter to be a string.`

## Reproduction

From `apps/factory`: run `pnpm --filter @jira-clone/factory build:agent` after installing the Vercel plugin skills into `agents/task-miner/agent/skills`.

## Expected

Downloaded skills with valid skills.sh frontmatter are accepted by the native Eve agent discovery path.

## Actual

Discovery fails for 12 Vercel plugin skills before any agent builds. The same source is accepted by the skills CLI. The current workaround is to normalize the copied Eve frontmatter at the repository boundary by removing the Vercel plugin's nested trigger metadata; the instructional Markdown and reference files remain intact.
