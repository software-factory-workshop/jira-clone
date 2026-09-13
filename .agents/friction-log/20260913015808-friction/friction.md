---
title: 'Factory delivery POST leaves an orphaned record after outer workflow failure'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#57'
---

## Expected Behavior

A failed outer-workflow admission should not leave a new delivery record, or it should return the persisted delivery ID with a documented recovery action.

## Current Behavior

`POST /factory/delivery` returned HTTP 400 with `Outer workflow POST returned HTTP 500`, but the delivery record was already persisted in private Blob as a `worker_starting` delivery with no driver.

## Possible Solution

Make delivery creation atomic with workflow admission, or surface the persisted ID so the caller can resume or cancel it deterministically.

## Minimal Reproducible Example

1. POST an authenticated MCP-tool delivery.
2. Observe HTTP 400 `Outer workflow POST returned HTTP 500`.
3. Read deterministic delivery ID `31eeac86097cdb1e5e3245cc68256649da08157b563c1d41f3acccc98846aeba`.
4. Observe phase `worker_starting`, no session/driver.
5. Cancel that ID; cancellation returns HTTP 200 and phase `cancelled`.

## Context

This occurred while starting the next factory delivery after merging PR #38. No worker, branch, or source change was created; the workaround was to cancel the orphan and retry with a fresh operation ID.
