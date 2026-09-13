---
title: 'Local cockpit records proxy is unavailable during dev browser verification'
severity: 'minor'
---

## Expected Behavior
The local cockpit should provide usable records data or a clear local setup path.

## Current Behavior
The Work route loads, but the records proxy returns 502 when its backing service is unavailable.

## Possible Solution
Document the required backing service or provide a deterministic local stub.

## Minimal Reproducible Example
Run `pnpm dev` and open `http://127.0.0.1:3000/?section=work`; observe 502 responses for the records endpoints.

## Context
Observed during local browser verification on 2026-09-13. The UI itself rendered without client console errors.
