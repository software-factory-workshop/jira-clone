---
title: 'Cockpit delivery reconciliation misses a merged worker PR'
severity: 'major'
---

## Expected Behavior

When a worker-owned PR was produced and merged, the corresponding Cockpit delivery should recover its trusted publication and show Merged.

## Current Behavior

Delivery `eb3459d18e53a16b9bd43fd2c4d78d9914c9cfe213ad4e571cf65907a0c5e3f6` still shows Needs human review even though PR #149 was produced by worker `wrun_41M2G43VTH0GSMZPMPDJ4ZQQ36` and merged on GitHub at 2026-09-14T14:27:56Z. The stored delivery has no `publication`, so `/factory/delivery/:id/reconcile` returns before checking GitHub; Cockpit history also only calls reconciliation when a publication already exists.

## Possible Solution

Reconcile an unpublished delivery against the exact worker-owned branch and operation markers, validate the GitHub candidate and provenance, persist the recovered publication, and transition merged candidates. Have Cockpit invoke that reconciliation for loop records without a publication as well.

## Minimal Reproducible Example

Open `https://adeo-factory-cockpit.vercel.app/work/run?delivery=eb3459d18e53a16b9bd43fd2c4d78d9914c9cfe213ad4e571cf65907a0c5e3f6` and compare it with `https://github.com/software-factory-workshop/jira-clone/pull/149`. The page reports “Latest handoff: Needs human review” and “Agent stopped without a trusted result,” while PR #149 is merged and its body binds the worker owner and operation `73377633-1bc6-415b-8b48-84ddac7aad6d`.

## Context

Confirmed against the production-shaped Cockpit at factory SHA `097a81ec6e9dc289162897bcfa10cf853a660c1b` and GitHub repository `software-factory-workshop/jira-clone` on 2026-09-14. This is repository-specific durable delivery reconciliation friction.
