---
title: 'Shared cockpit Blob grows forever and rewrites the full history on every mutation'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#62'
---

## Expected Behavior

Shared cockpit state should have bounded record growth, independent record ownership, and paginated reads and writes that remain viable as factory runs accumulate.

## Current Behavior

CockpitDocument stores drafts, feedback, runs, a never-pruned versions map, and a never-pruned imported list in one factory/cockpit-v1.json Blob. Every mutation reads and rewrites the entire document through a five-attempt CAS loop, and collection reads return every record. Deleted records leave their version tombstones permanently.

## Possible Solution

Partition durable records by collection and ID or introduce a bounded append-only run store with retention and pagination. Keep only the metadata required for conflict protection, and add explicit cleanup or archival semantics for runs and migration markers.

## Minimal Reproducible Example

1. Create and delete many run records or import many legacy records.
2. Observe that runs disappear from the collection but their versions or imported keys remain in the same document.
3. Repeat a mutation and inspect that the whole Blob is read and rewritten, regardless of which record changed.

## Context

The factory is intended to keep durable investigations and delivery history. Without a retention and partitioning policy, normal workshop use increases CAS contention, payload size, and browser transfer cost until unrelated draft or feedback writes become unavailable.
