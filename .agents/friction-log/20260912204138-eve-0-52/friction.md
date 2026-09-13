---
title: 'Eve 0.52.5 compiler rejects the official agent-browser extension mount'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#83'
---

## Expected Behavior
The documented @agent-browser/eve mount compiles.

## Current Behavior
Eve 0.52.5 rejects both file and directory mounts with Selected module binding extensions/browser.ts has no compile or runtime usage. Literal package invocation reproduces it; shared config was not the cause.

## Possible Solution
Resolved by rebuilding the unchanged official v0.37.1 source with Eve 0.52.5. The published package declares tool contract 21, explicitly dropped by current Eve. Testing 0.54.3 reproduced the same failure and was reverted. The compiler-generated compatibility manifest from the rebuilt package is supported; all three root builds pass. See vendor/agent-browser-eve-README.md for provenance and reproduction.

## Minimal Reproducible Example
Import browser from @agent-browser/eve and default-export browser({}) under agent/extensions/browser.ts, then run eve build.

## Context
All three factory root agents need independent sandbox browser sessions; reviewer evidence must come from extension tool results.
