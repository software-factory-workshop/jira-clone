---
title: 'Browser station stream has no bound and copies full history per event'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#61'
---

## Expected Behavior

The browser should observe long factory work through a bounded incremental projection.

## Current Behavior

readStationStream starts at offset zero with no event, byte, or time bound. WorkRun appends each event with a full array spread and retains the complete session projection. The server readers are bounded, but this browser path bypasses them.

## Possible Solution

Use the bounded cockpit projection or add cursor-based reads with a capped tail and cancellation deadline.

## Minimal Reproducible Example

Follow a long worker or revision session in WorkRun and inspect readStationStream and tailEvents.

## Context

Durable delivery and revision sessions make long streams normal. The current path can become quadratic in copied array work and grow without a memory bound.
