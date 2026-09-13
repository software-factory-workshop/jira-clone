---
title: 'Dynamic worker subagent omitted despite successful build'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#73'
---

## Expected Behavior
Authorized worker dispatch starts a real specialist.

## Current Behavior
Hosted root wrun_41M2AV3MBZ0GKQ7CVGE2RTP7S7 at ac49f91 finished without any tool call. Runtime omitted worker because defaultTools cannot be selected in a dynamic subagent return, though TypeScript and build passed.

## Possible Solution
Static specialist definition with defaultTools false and a dynamic model guard that denies mismatched immutable station identity before model selection. Keep execution guards on sensitive tools.

## Minimal Reproducible Example
Return defineAgent({description,model,defaultTools:false}) from a declared dynamic subagent session.started resolver on Eve 0.52.5. Hosted runtime rejects the result.

## Context
The failed dispatch spent $0.0004135 and created no child or PR. Evidence: factory/mining/native/2026-09-12/worker-dispatch-failed.json. Add a regression fixture for static tool policy and actual unauthorized model-resolution rejection.
