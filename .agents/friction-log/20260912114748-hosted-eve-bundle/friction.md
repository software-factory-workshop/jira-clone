---
title: 'Hosted Eve bundle omits ACP bridge bootstrap assets'
severity: 'minor'
---

## Expected Behavior
The same fx mining runtime starts in local Eve dev and in the deployed Eve service.

## Current Behavior
The first hosted investigation failed with ENOENT opening /var/task/_libs/bridge/package.json. Eve 0.52.5's Nitro build relocated harness-acp to _libs/ai-sdk__harness-acp.mjs but omitted its four import.meta.url-relative bridge files. Typechecks, build and a real dev run passed.

## Possible Solution
The repository's build:agent command copies the exact four assets from the installed harness-acp package next to each relocated module, verifies byte equality, and fails if the packaging shape changes. Remove the workaround when Eve preserves these assets itself.

## Minimal Reproducible Example
Deploy revision 14dae90 with the generated eve/nuxt service and start a cockpit investigation. Session wrun_41M2AKG76A0GH9FWYTZ7XZ476Z failed in sandbox-miner after GitHub source collection.

## Context
The hosted browser and Passport authentication worked. This is packaging-specific; a green build was insufficient. The first workaround checked only the Eve service, but Eve also hoists a copy into the Nuxt host's hidden Workflow route directory. The corrected check walks both outputs, including hidden directories, and verifies two runtime bundles. CI now builds the Vercel layout, not only the local Node layout. Keep this entry as an upstream packaging limitation while the repository workaround is required.
