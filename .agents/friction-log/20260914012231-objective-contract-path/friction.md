---
title: 'Objective contract path points to nonexistent apps/factory/CONTRACT.md'
severity: 'minor'
---

## Expected Behavior
The goal objective should point to the contract location that exists in the repository.

## Current Behavior
The objective says apps/factory/CONTRACT.md, but the checkout contains factory/CONTRACT.md.

## Possible Solution
Update the objective or repository documentation to use factory/CONTRACT.md consistently.

## Minimal Reproducible Example
From the jira-clone root, run: rg --files -g CONTRACT.md
Observed: factory/CONTRACT.md
Then run: sed -n "1,260p" apps/factory/CONTRACT.md
Observed: No such file or directory.

## Context
This blocks following the mandated "read apps/factory/CONTRACT.md first" instruction literally, although the intended contract is discoverable.
