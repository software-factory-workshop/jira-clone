---
title: 'CI selected the Node output preset during Vercel route verification'
severity: 'minor'
---

## Expected Behavior
The deployment check writes .vercel/output/config.json and verifies custom Eve station routes.
## Current Behavior
GitHub Actions run 34695040014 built Node output despite VERCEL=1, then the route assertion failed with ENOENT. Local Vercel-mode output and production deployment succeeded.
## Possible Solution
Set NITRO_PRESET=vercel explicitly in the packaging verification step; confirm the same routes in CI.
## Minimal Reproducible Example
Run the packaging verification step in GitHub Actions with VERCEL=1 alone.
## Context
Worker/reviewer bootstrap ac49f91. Explicit preset correction is awaiting CI confirmation.
