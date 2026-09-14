---
title: 'Fresh factory worktrees do not have runnable dependencies'
severity: 'minor'
---

## Expected Behavior
A clean factory worktree should be ready for the documented focused validation commands.

## Current Behavior
A new git worktree has no linked node_modules, so the first test, typecheck, or build cannot run until the whole monorepo is bootstrapped with `pnpm install --frozen-lockfile`.

## Possible Solution
Provision dependency links as part of the worktree workflow or document a repository-local bootstrap command.

## Minimal Reproducible Example
1. Create a clean worktree from main.
2. Run `pnpm --filter @jira-clone/factory test`.
3. The worktree is missing dependency links.
4. Run `pnpm install --frozen-lockfile`; validation then starts.

## Context
This adds a roughly 10-second monorepo install to each fresh isolated factory worktree before validation can begin.
