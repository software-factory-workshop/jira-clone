---
title: 'Jira documentation omits shipped demo APIs'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#65'
---

## Expected Behavior
The current-state documentation describes shipped demo-only Jira capabilities and limits.

## Current Behavior
README.md and factory context docs still call the app a fixture shell with no mutations or application API, although origin/main 7c1e588 ships demo-only writes, bounded REST, MCP tools, Passport identity, and fake OAuth.

## Possible Solution
Update those docs with supported surfaces, boundaries, and a dated revision.

## Minimal Reproducible Example
Compare README.md and factory/context/*.md with apps/jira/server/routes and docs/*.md at origin/main 7c1e588.

## Context
Observed during the 2026-09-13 assessment; this repository-specific drift can misdirect future workshop work.
