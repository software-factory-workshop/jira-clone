---
title: 'Eve station prompts depend on a runtime policy path'
severity: 'minor'
---

## Expected Behavior
Each Eve station should compose the shared quality contract from a TypeScript module in apps/factory/shared and should not depend on a runtime path that is unavailable in its sandbox.

## Current Behavior
The worker and reviewer instruction sources were Markdown and told the agent to read factory/policies/agent-quality.md after prepare_work or prepare_review. The reviewer sandbox exposes the baseline policy under /workspace/review-policy, so that relative path is not a reliable prompt dependency. Task-miner also appended a duplicated reminder.

## Possible Solution
Use defineInstructions in each root instructions.ts, import the shared contract, and compose it at build time. Keep the Markdown policy as the host-readable baseline and assert parity.

## Minimal Reproducible Example
Inspect or build apps/factory/agents/reviewer: the old root prompt contains the factory/policies/agent-quality.md read, while the reviewer workspace contract is /workspace/review-policy.

## Context
This repository uses Eve 0.52.5 and the Eve instructions guidance distinguishes Markdown assets from TypeScript instruction modules. The friction is repository-specific to the station prompt layout and sandbox paths.
