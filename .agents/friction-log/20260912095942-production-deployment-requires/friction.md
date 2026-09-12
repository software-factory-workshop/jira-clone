---
title: 'Production deployment requires the Git source'
severity: 'minor'
---

## Expected Behavior
The first production deployment starts after project setup.

## Current Behavior
The team's deployment policy rejects CLI production deployments: only Git deployments are allowed. Vercel CLI stayed at Building and inspect reported UNKNOWN; the deployment API reported BLOCKED with the actual reason.

## Possible Solution
Connect both Vercel projects to this repository and deploy through Git pushes. Preserve the team policy. Inspect readyStateReason when CLI output is inconclusive.

## Minimal Reproducible Example
Run vercel deploy --prod on a linked project in demo-software-factory, then inspect the deployment API response.

## Context
Stage-zero bootstrap. Both projects are now Git-linked; the next push uses the permitted deployment source.
