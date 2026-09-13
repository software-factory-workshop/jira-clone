---
title: 'Task-mining fx adapter pauses before the authorized GitHub read'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#68'
---

## Expected Behavior
The isolated task miner reads GitHub issues through its authorized host tool and returns proposals in one bounded run.

## Current Behavior
With @ai-sdk/harness 1.0.107 and harness-fx 1.0.20, fx emits a native approval request for mcp_ai-sdk-harness-tools_github_read before reaching the host tool. generate returns finishReason tool-calls with no GitHub read even when toolApproval.github_read is approved. Native tool names and inputs also differ from the adapter schemas in trace validation.

## Possible Solution
Continue the in-flight turn with approval only for the fixed repository GET tool after validating its inputs. Keep read-only native permissions. Do not score a paused or failed run as a task-mining baseline. Track compatibility separately from context quality.

## Minimal Reproducible Example
See factory/mining/runs/baseline-read-tool-retry/result.json for acp-permission-1 and its native tool name. The runner at packages/task-miner/run.mjs now handles this bounded continuation. Direct VERCEL_OIDC_TOKEN auth also returned 401; passing the same verified team OIDC bearer through the adapter's explicit AI_GATEWAY_API_KEY record reached inference.

## Context
Repository experiment on 12 September 2026 using meta/muse-spark-1.3-contributor and demo-software-factory. No credentials are included in artifacts. The adapter installs the current fx binary, so installed adapter and runtime compatibility must be verified together.

## Follow-up evidence

The final original/alternate prompt runs both completed with live issue and pull inventories after bounded native approval continuation. A separate observed inventory input, `number: "null"`, exposed an irrelevant-parameter validation failure. The current object-root schema accepts null/string-null for inventory and requires a positive integer for comments; regression tests pass. A top-level discriminated union was tried and rejected by MCP as InvalidSchema before inference.

Remaining limitations: native trace names can differ from adapter schemas, previews can be truncated, and the exact fx binary was unavailable through the version probe. Keep this entry scoped to those remaining compatibility/reproducibility concerns. Evidence: factory/mining/report.md and final run directories.
