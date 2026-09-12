---
title: 'Native Eve Sandbox rejects partially specified credentials'
severity: 'minor'
---

## Expected Behavior
Native Eve creates its Sandbox using the verified project OIDC.

## Current Behavior
Passing teamId and projectId without token fails with Missing credentials parameters to access the Vercel API: token. Eve 0.52.5 bundled SDK treats any credential field as explicit authentication.

## Possible Solution
Omit partial credential options; the SDK derives token, team and project together from OIDC. Verify fixed scope before model and preparation execution.

## Minimal Reproducible Example
vercel({teamId,projectId}) followed by ctx.getSandbox() fails. vercel({resources:{vcpus:4},timeout:600000}) uses ambient verified OIDC.

## Context
A plain SDK preflight with complete explicit credentials passed and did not test the actual Eve backend. Native Muse validation exposed the integration boundary. Keep native backend validation in the verification loop.
