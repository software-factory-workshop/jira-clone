---
title: 'pnpm typecheck resolves duplicate H3 versions in OAuth registration'
severity: 'minor'
---

## Expected Behavior

`pnpm typecheck` should typecheck the Jira app with one compatible H3 event type.

## Current Behavior

`pnpm typecheck` fails at `apps/jira/server/api/oauth/register.post.ts:60`: the handler event is typed from H3 1.15.11 while `sendError` expects an H3 2.0.1-rc.31 event pulled through Nuxt.

## Possible Solution

Align the direct H3 dependency and Nuxt-generated types, or avoid passing the incompatible event type across the helper boundary.

## Minimal Reproducible Example

From `jira-clone`: `pnpm typecheck`

## Context

Observed on `main` at `859cef52a56afff51a02f2186091ebad14416bdb`; the executable test suite still passes. This blocks the repository-wide typecheck gate.
