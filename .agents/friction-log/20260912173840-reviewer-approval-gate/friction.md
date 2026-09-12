---
title: 'Reviewer approval gate trusts model-controlled limitations'
severity: 'major'
---

## Expected Behavior
Required evidence is host-owned.

## Current Behavior
A reviewer can clear limitations and retry approve without new evidence.

## Possible Solution
Derive mandatory evidence from the changed-file inventory.

## Minimal Reproducible Example
See docs/verification.md:29.

## Context
The PR 2 approval is invalid.
