---
title: 'CI attempts Eve sandbox-template prewarming without Vercel identity'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#77'
---

## Expected Behavior
CI validates deployable Eve output without storing an expiring project OIDC token as a repository secret.

## Current Behavior
GitHub Actions run 34705978918 passes ordinary checks and Nuxt route layout, then fails Eve template initialization because VERCEL_OIDC_TOKEN is absent. Setting VERCEL=1 selects platform behavior but does not create a platform identity. The same commit deploys successfully on Vercel.

## Possible Solution
Run native output assertions after Eve build inside the authenticated Vercel service build. In GitHub CI retain deterministic local checks and require both fixed-project Vercel success statuses for the exact commit through read-only GITHUB_TOKEN. Missing, failed or blocked previews must fail verification.

## Minimal Reproducible Example
On revision 95360ebaeb14996ccb9319489767772ab7e91d61 run the final Verify native Eve deployment output step in a clean GitHub runner without project credentials.

## Context
Eve 0.52.5 creates sandbox templates during deployable builds when a sandbox has bootstrap or seed files. Do not use a static copied OIDC token, bypass template preparation, or call an unauthenticated artifact a deployment proof.
