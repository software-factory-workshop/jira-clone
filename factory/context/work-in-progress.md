# Work already underway

Updated 12 September 2026 during the development session. This supplements GitHub; an empty issue list does not imply no active work.

## Task-mining context calibration

Owner: Codex development session, requested by Remi. Status: initial calibration completed and reviewed by Codex; Remi's review of proposals is pending. The original and alternate prompts have both completed with current GitHub evidence. This status was updated after those runs.

The current work is to make the small task-mining prompt return useful proposals. It already includes the runner, team-scoped model access, current issues/PR reads, explicit source inventory, held-out review criteria, baseline runs, context revisions, same-prompt replays and differently worded probes. Its deliverable is a reviewed comparison with remaining limitations, not a deployed station.

The initial same-prompt and transfer comparisons are complete. A subsequent mining session should inspect this current status instead of assuming they have never run. Do not propose creating the runner, publishing the inventory or starting the same replay/transfer comparison as a new task. Inspect the available implementation; name a specific gap or new case if further work is justified. A future regression or changed context can justify another experiment, but absence of held-out results does not prove the current experiment has not run.

Artifacts exist in `factory/mining/`, intentionally outside your snapshot. Completion, usefulness and owner acceptance are different states. A completed model call does not establish owner acceptance. Current run scores and candidate answers are withheld to keep your judgment independent.

## Cockpit task-mining station

Owner: Codex development session, explicitly requested by Remi after context calibration. The current delivery wires the tested fx miner into an Eve agent and the Nuxt cockpit. It includes pinned GitHub snapshots, live issue/PR reads, scoped Sandbox and Gateway access, durable sessions, progress, cancellation, browser reconnection, evidence and editable drafts. Inspect `apps/factory/agent`, the mining components, and `packages/task-miner/runtime.mjs` before proposing these capabilities again. Deployment and verification evidence belongs in `docs/verification.md`.

This delivery also aligns the cockpit stage copy with task mining. A new investigation should identify a specific remaining gap, not propose building the station from scratch. Remi has not automatically accepted other mined proposals. No Jira feature implementation, issue publication or automatic rule activation is underway. Check GitHub issues and PRs for work started elsewhere. Do not assume this dated local record supersedes newer repository or GitHub evidence.
