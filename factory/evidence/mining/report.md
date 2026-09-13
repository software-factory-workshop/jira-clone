# What made the task miner more useful

Experiment date: 12 September 2026. Model: `meta/muse-spark-1.3-contributor`, through AI SDK Harness and fx. Billing scope: `demo-software-factory`, using the cockpit project's scoped OIDC credential. Reviews below are Codex assessments for Remi to examine; no proposed task has been accepted or implemented automatically.

After three context revisions and the tool-boundary repairs, the original prompt and an alternate wording both return a useful leading proposal: align shared cockpit stage/brief copy with the current task-mining goal. Both recognize the active calibration and existing runner/rubric. The original prompt also identifies the specific missing runtime identity needed for stronger replay comparisons.

Secondary ranking is still uneven. Defer the transfer run's registry swap and the original run's transition capture unless Remi finds them useful now. These are reviewable candidates, not automatically accepted work.

The prompt asks for at most three useful tasks grounded in current code and GitHub work, with scope, acceptance criteria, uncertainties and reflection. It does not name the desired next task. The first complete baseline uses repository revision `9f22e30`. Later runs use versioned working-tree snapshots recorded by file hash. Raw runs, scores and the rubric are held out from the miner.

## What changed

1. **Direction.** Old documents prioritize request-to-work-order admission. The current owner direction is task mining. Added a canonical goal and reconciled the planning docs.
2. **Source navigation and status.** Added a code map and reviewed reflections. Resolved three Frog entries whose fixes were already recorded and present in code.
3. **Visibility.** A run proposed creating an existing rubric because it was excluded. Added explicit snapshot exclusions and included runner source. Excluded evidence is no longer presented as absent work.
4. **Active work.** A later run proposed starting the very replay/transfer experiment already underway. Added a current-work record alongside GitHub. An empty issue list does not describe all work in progress.

These are reusable context-engineering components. The experiment does not establish that a large prompt, more agents or a larger model is needed.

## Run comparison

The rubric scores five dimensions out of two: goal, grounding, issue hygiene, actionability and reflection. A duplicate or critical unsupported claim fails review even when the numerical score is high.

| Run | Review | Finding |
| --- | --- | --- |
| [Baseline](runs/baseline-complete/result.md) | [7/10, not accepted](runs/baseline-complete/review.md) | Prioritizes the old admission workflow; mistakes a hidden-file glob omission for missing context |
| [Context v1](runs/context-v1/result.md) | [8/10, not accepted](runs/context-v1/review.md) | Correct goal, but duplicates the existing rubric and miscopies a Jira status |
| [Context v2](runs/context-v2/result.md) | [7/10, not accepted](runs/context-v2/review.md) | Recognizes runner/rubric, but proposes the active experiment as new work |
| [Transfer v2](runs/transfer-v2/result.md) | [6/10, not accepted](runs/transfer-v2/review.md) | Repeats the active-work mistake; also wrongly equates an empty backlog with requiring no tasks |
| [Transfer v3](runs/transfer-v3/result.md) | [9/10, promising](runs/transfer-v3/review.md) | Recognizes active work; matching primary run was infrastructure-blocked |
| [Final original prompt](runs/context-v3-final/result.md) | [8/10, promising](runs/context-v3-final/review.md) | Useful stage-copy and runtime-identity proposals; defer its Jira scenario assumption |
| [Final alternate prompt](runs/transfer-v3-final/result.md) | [8/10, promising](runs/transfer-v3-final/review.md) | Same leading proposal; registry migration is lower priority |

The v3 transfer probe [passed review at 9/10](runs/transfer-v3/review.md), recognizing active work and recommending stage-copy reconciliation. Its matching primary-prompt run correctly reported unavailable GitHub evidence after the string-null input was denied; that replay is not a quality pass. Both final prompts completed after the input-boundary correction, with identical 50-file source manifests. Goal/context documents stayed unchanged during that pair. This tests transfer across wording; it does not establish statistical reliability.

## Infrastructure observations

These attempts are excluded from complete-run quality scoring:

- `baseline`: direct adapter OIDC auth returned HTTP 401, before a repository investigation.
- `baseline-auth2`: explicit scoped bearer reached inference, but native MCP approval paused before GitHub evidence.
- `baseline-read-tool`: Gateway credits preflight returned HTTP 503, before model execution.
- `baseline-read-tool-retry`: host-tool approval alone still left a native MCP approval pending.
- `context-v3`: native inventory input included `number: "null"`; original validation denied it, so GitHub evidence was unavailable.
- `context-v3-retry` and `transfer-v3-retry`: an attempted discriminated-union input schema was rejected during MCP initialization. Replaced it with an object-root schema and conditional comment-number validation. No model quality result was produced.

The runner now continues only the exact authorized fixed-repository GET tool after validating input. Inventory reads ignore irrelevant null/string-null issue numbers; comment reads still require a positive integer. Regression tests cover that observed failure and reject write-endpoint or alternate-repository selection. It requires both complete issue and pull inventories plus a normal stop. The evaluated complete runs fetched both all-state inventories, each empty. GitHub credentials stay on the host.

Native ACP tool names/input validation can differ from the installed adapter, and native tool previews can be truncated. These diagnostics remain in raw records. `fx --version` was unavailable through the snapshot-preparation command, so `runtime.json` reports that limit honestly. Package versions are recorded; the exact installed fx binary is not pinned by this experiment.

Team credit readings and available token usage are preserved per run. Some runs overlap, so per-run credit deltas must not be summed. Sandbox charges are separate from Gateway credits. See the closing billing reading below.

## Scope and verification

Repository checks (`pnpm check`, covering typechecks, draft tests and both app builds) pass. Runner syntax check and Git whitespace check pass. No cockpit interaction or Jira behavior changes are included. This experiment adds developer tooling and context, not a deployed Eve workflow, scheduler, proposal queue or issue writer.

The current-work record tracks this experiment separately from GitHub. Keep it current or it becomes another stale context source. Reviewed reflections carry dated evidence and hypotheses; they are not automatically promoted to rules by the mining agent.

These are small-sample observations with bundled context changes and model variation. The scores are not independent evaluations or proof of general reliability. The next meaningful evidence is Remi's assessment of the resulting proposals.

## Closing billing reading

Gateway's team ledger reports `$0.063487656` total used at `2026-09-12T09:59:43.286Z`. It increased by approximately `$0.058051` between the first and last saved readings. The first saved reading was after initial setup attempts; this is a team-ledger observation, not exact per-run invoicing. See [billing-window.json](billing-window.json). Sandbox charges are not included.

## What to review next

Review the leading [stage-copy proposal](runs/context-v3-final/result.md) with Remi. Its outcome is consistency between the current goal and the cockpit's knowledge/growth views. The next runner-specific candidate is exact fx runtime identity. Preserve owner judgment for secondary suggestions; the experiment has not authorized implementation of any mined proposal.
