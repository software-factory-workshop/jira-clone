# First worker assignment: proposal usefulness feedback

Owner direction: Remi asked the factory to start performing useful work and producing PRs on 12 September 2026. This is the first selected task, taken from the existing mining proposals. Selection authorizes a draft PR; it is not acceptance of the resulting implementation.

## Outcome

Remi can mark a structured mining proposal useful or not useful and optionally explain why. The factory needs this human judgment to distinguish a completed investigation from one that found worthwhile work.

## Scope

- Add a small ADEO Nuxt UI feedback control to each structured mining proposal card.
- Store feedback in this browser, keyed by the proposal's host-assigned ID. Different proposals and investigations must remain independent.
- Restore the selection and optional reason after reload, allow editing or clearing it, and handle unavailable or malformed browser storage without breaking the report.
- Keep feedback separate from selecting a proposal for a draft, starting the worker, accepting implementation, and publishing to GitHub.
- Label browser-local persistence accurately. No backend, account integration, analytics, shared feedback service or automatic factory-policy change.
- Preserve task mining, individual draft actions and worker/reviewer controls added in the current factory.

## Acceptance evidence

1. Two proposal IDs can receive different judgments and reasons; changing one leaves the other unchanged.
2. Reload restores feedback for the same proposal. Clearing one removes only that entry.
3. Malformed or unavailable storage degrades gracefully with honest UI wording.
4. Legacy findings without a host-assigned proposal ID do not accidentally share feedback.
5. The UI uses the included ADEO Nuxt UI design system and keyboard-accessible controls.
6. Meaningful focused tests cover persistence and isolation. Typecheck, tests and build pass; list any checks not run.

## Handoff

Read AGENTS.md, the goal, project map and work already underway, then inspect the actual mining component, its output parser and existing draft/storage conventions. Implement this task in the disposable repository workspace. Open one draft PR with a concise problem/behavior description and actual validation evidence. Do not implement other mining proposals or modify agent instructions, review policy, deployment configuration, credentials or CI workflows.

The independent reviewer must inspect the PR's exact head revision and the acceptance evidence above, run relevant checks, and return actionable findings. Model approval does not merge the PR.
