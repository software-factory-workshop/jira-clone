---
title: 'Context merge authority is stale'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#59'
---

## Expected Behavior
Context documents should distinguish agent stations from the host merge policy.

## Current Behavior
The work-in-progress context says no station merges PRs, while mainline delivery code allows a narrow host-owned low-risk merge.

## Possible Solution
Update the context and status documents.

## Minimal Reproducible Example
Compare factory/context/work-in-progress.md with factory/README.md.

## Context
Repository documentation friction.
