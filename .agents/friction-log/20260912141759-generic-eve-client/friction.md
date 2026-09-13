---
title: 'Generic Eve client import breaks the Nuxt production browser build'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#75'
---

## Expected Behavior
WorkRun browser client imports compile during the Nuxt production build.
## Current Behavior
Eve 0.52.5 eve/client is unbundled and its #shared imports resolve to the Nuxt application directory, causing a missing guards.js build error.
## Possible Solution
Use the browser-bundled eve/vue exports for the reducer and composable. Follow the public same-origin NDJSON route for background lifecycle events beyond the initial turn.
## Minimal Reproducible Example
Import Client from eve/client in WorkRun.vue and run pnpm --filter @jira-clone/factory build.
## Context
The bundled eve/vue entry works. Generic client runtime imports do not work with the current Nuxt alias setup. Found while adding worker child progress and budget decisions.
