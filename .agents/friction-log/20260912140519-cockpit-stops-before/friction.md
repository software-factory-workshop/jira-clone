---
title: 'Cockpit stops before delayed background child dispatch event'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#74'
---

## Expected Behavior
After dispatching a background worker or reviewer, the cockpit follows its child session even when the dispatcher turn has finished.
## Current Behavior
Hosted worker root wrun_41M2AVBS640GXB6E761Y5HCQTT showed No completed result while child wrun_41M2AVC0FK0GPK3KVJFW3B1QA3 was active. The raw root stream emitted subagent.called after turn.completed and session.waiting, where useEveAgent had stopped following.
## Possible Solution
Recognize the working task receipt and follow the durable root tail until the matching child event arrives. Keep dispatch pending distinct from failure.
## Minimal Reproducible Example
Dispatch the worker, observe its working receipt, then the dispatcher boundary followed by delayed subagent.called. The cockpit should move to the child progress view.
## Context
Eve 0.52.5 task-mode delegation, hosted worker validation on 12 September 2026. Fix remains uncommitted while the worker publishes against its pinned source.

The same early stream boundary also hid a later parent-proxied input-token budget request while the child was parked. The parent tail must continue after child discovery, render the exact pending request ID/options, and send a decision through the parent session. A parked child is awaiting a decision, not a completed or failed task.

Replay also showed historical parent budget requests after the child had published PR #2. A direct child continuation can leave those proxied requests unresolved in the parent reducer. A recorded child result must supersede those requests and stop controls; a generic turn.completed event cannot, because budget pauses also end turns.
