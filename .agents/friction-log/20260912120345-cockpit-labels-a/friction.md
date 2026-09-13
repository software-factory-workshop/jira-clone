---
title: 'Cockpit labels a disconnected mining stream as stopped'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#70'
---

## Expected Behavior
An unconnected browser stream offers reconnection without claiming cancellation.
## Current Behavior
Hosted session wrun_41M2AMEC0K0GKSGJ90PB36X1RY remained active after the browser stream ended, but MiningRun rendered Stopped without a cancellation event. Reload resumed the same sandbox phase.
## Possible Solution
Distinguish missing terminal evidence from cancellation and expose Reconnect.
## Minimal Reproducible Example
Start a hosted investigation, reconnect while active, and allow the stream to end before the tool completes.
## Context
Eve 0.52.5, Nuxt cockpit, deployment e33c729. Verify completed replay through the hosted UI.
