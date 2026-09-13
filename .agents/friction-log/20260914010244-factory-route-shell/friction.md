---
title: 'Factory route shell build fails on malformed aria-current bindings'
severity: 'blocker'
---

## Expected Behavior
The factory app production build should parse the route shell and expose the new work routes.

## Current Behavior
`pnpm --filter @jira-clone/factory build` fails in `apps/factory/app/app.vue:38` with `Unterminated string constant`. The `:aria-current` bindings for the work navigation contain an extra quote; the same pattern appears at lines 45 and 52.

## Possible Solution
Correct the three Vue expressions, then rerun the factory build and exercise `/work/new`, `/work/run`, and `/work/recent`.

## Minimal Reproducible Example
From `jira-clone`, run `pnpm --filter @jira-clone/factory build` on the current working tree.

## Context
Observed during a non-invasive quality review at revision `859cef52a56afff51a02f2186091ebad14416bdb`; the factory typecheck passed but the production template build failed.
