---
title: 'MCP delivery stalls at protected station boundary'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#58'
---

## Expected Behavior
A delivery whose requested files are outside the worker allowlist should fail fast with a structured, actionable boundary error or route to an approved factory-policy change.

## Current Behavior
The read-only Nuxt MCP Toolkit delivery stayed in `working` for about 27 minutes. Its worker stream stopped advancing at index 660 without a terminal event or publication. The requested slice needs `apps/jira/package.json`, `pnpm-lock.yaml`, `apps/jira/nuxt.config.ts` and `apps/jira/server/mcp/**`, while the first station protects dependencies, configuration and module routing and only allows `apps/jira/server/api/**`, `server/utils/**`, app/tests and docs. Cancelling the owner was the only safe recovery.

## Possible Solution
Validate requested paths and required capabilities before starting the paid worker; expose a reviewed factory-policy expansion for MCP integration that is narrow, explicit, and independently reviewed.

## Minimal Reproducible Example
Delivery `7a571fb52506dd2c7c3d6cc2814445de6051ded4e74d1650417f1b6588fa058f`; worker `wrun_41M2C4D9MR0GYTFF7FB9HHT9NJ`; stream index stopped at 660; delivery cancelled at 2026-09-13T01:26:33Z.

## Context
No branch or PR was published and no Jira source was changed. The intended toolkit package is `@nuxtjs/mcp-toolkit@0.21.0`. This is repository-specific factory friction, not an upstream issue.
