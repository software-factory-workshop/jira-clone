# Context review, 12 September 2026

Status: development-session review. The owner chose task mining in conversation; the observations below were checked by Codex against the repository. Model recommendations remain unaccepted until reviewed. This is not a mining agent changing its own rules.

## Observation: the next step had two definitions

At `9f22e30`, `factory/README.md` and `docs/factory-growth-experiment.md` prioritize request-to-work-order admission. `docs/cockpit.md` also records the newer direction of asynchronous task mining, but leaves its stage undecided. The current conversation chooses task understanding, code and issue context, goals and reflection as the first station.

Change: put the current direction in `factory/context/goal.md` and reconcile the planning documents. The deployed UI stage strings still describe the earlier roadmap in `packages/project-context/src/index.ts`. That is a source observation, not evidence that a deployed mining workflow exists.

Hypothesis: a single current goal reduces irrelevant proposals caused by conflicting plans. Compare fresh runs to assess this; writing the document alone proves nothing about proposal quality.

## Observation: pending friction included completed corrections

The hydration entry already says its fix is applied. `apps/factory/app/app.vue` has `immediate: false` and refreshes the GitHub request after mount. `docs/verification.md` records the subsequent browser check.

The starter-selection entry also describes a completed fix. The same Vue file calls `focusEditor()` after compose/reopen, waits for `nextTick()`, scrolls the editor into view and focuses its input. Commit `c5d3d11` and that entry record browser verification.

The deployment-source restriction is a team policy, not a product defect to remove. `README.md` documents Git-origin deployment and `docs/verification.md` records successful Git deployments. The earlier bootstrap friction is resolved by that documented path.

Change: resolve those three Frog entries, preserving their provenance in Git history and this reflection. Private package-registry access remains outstanding; the checked-in package is a working workaround, documented in `vendor/README.md`.

Hypothesis: reconciling status with evidence prevents recycled fixes from filling the proposal queue. Recheck code and current issues before accepting that claim for a future run.

## Limits

The source review does not retest hosted UI behavior, verify full Jira API compatibility or settle the task-mining UX. Research files referenced outside this repository are not in the mining snapshot. A model should state that boundary instead of implying it read them.

Retire or update these observations when the corresponding code, goal or deployment arrangement changes. Retain dated evidence rather than growing an undifferentiated transcript.
