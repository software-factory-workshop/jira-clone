---
title: 'Delivery error classification is too broad'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#63'
---

## Expected Behavior

Different failures need different statuses and recovery actions.

## Current Behavior

The protected route maps all exceptions to 400 and advance maps nearly all failures to blocked.

## Possible Solution

Add a typed error taxonomy and preserve retryability.

## Minimal Reproducible Example

Compare a provider outage with invalid input during delivery advance.

## Context

This makes recovery and cockpit status misleading.
