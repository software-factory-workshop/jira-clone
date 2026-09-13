---
title: 'ADEO private package requires a package-read credential'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#67'
---

## Expected Behavior
A clean checkout installs the ADEO design-system package.

## Current Behavior
The existing GitHub CLI credential can create the repository but npm returns HTTP 403 for the private package because its token lacks package scopes.

## Possible Solution
Stage zero uses the existing v0.1.1 local package tarball under vendor. Later configure a read:packages credential and grant the consumer repository GitHub Actions package access.

## Minimal Reproducible Example
Request version 0.1.1 from the GitHub Packages scoped registry with a credential lacking read:packages.

## Context
No secret is stored in the repository. The vendored artifact makes the two stage-zero Nuxt deployments reproducible.
