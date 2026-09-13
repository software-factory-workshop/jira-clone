## Recommendation: do Candidate 1 next

With one small slot, reconcile the stale “request-to-work-order admission first” copy with the current task-mining goal.

That directly serves `factory/context/goal.md`:

- Primary outcome is a growable, explainable Eve factory for a 3–4 hour ADEO workshop; Jira alone is the test subject.
- Current experiment is a bounded, read-only task-mining station: understand goal, code, issues/PRs, then return supported proposals or say what context is missing.
- Near-term question: can a fresh agent suggest work Remi would seriously consider without reconstructing the conversation?

Removing the conflicting plan is the cheapest test of the reviewed hypothesis that “a single current goal reduces irrelevant proposals.”

Current GitHub backlog, read this run via the authorized fixed-repository reader:

- `issues`: `complete:true`, `items:[]`, captured `2026-09-12T09:53:44.494Z`
- `pulls`: `complete:true`, `items:[]`, captured `2026-09-12T09:53:46.749Z`

An empty backlog does not mean no active work: `factory/context/work-in-progress.md` says task-mining context calibration is active and awaiting review of replay/transfer results.

## Candidate 1 — Align stage copy with the task-mining milestone [recommended]

Source evidence:

- `factory/context/goal.md:8-15`: first establish that a bounded mining invocation returns useful work; then build cockpit experience around observed needs.
- `factory/context/goal.md:19-21,27`: source selection, cadence, persistence, deduplication and review remain undecided; older “request-to-work-order admission next” language is superseded.
- `factory/reflections/2026-09-12-context-review.md:7-12`: planning docs conflicted; deployed UI stage strings in `packages/project-context/src/index.ts` still describe the earlier roadmap.
- `packages/project-context/src/index.ts:6-49`: stage `01` is still “An Eve agent turns a request into a supported work order,” with no explicit task-mining milestone.
- `factory/context/work-in-progress.md:5-13`: replay/transfer comparison is already underway; do not duplicate it.

Useful outcome:

- A fresh miner and workshop visitor see one current direction, reducing work-order-first proposals caused by conflicting plans.

Scope:

- Small context/copy change only: update shared stage/reference copy consumed by the cockpit knowledge/growth views.
- No agent execution, no backend, no Jira behavior change, no factory-rule activation.
- Keep dated reflections; do not rewrite history as if admission was never planned.

Acceptance checks:

- `pnpm typecheck`, `pnpm test`, `pnpm build` pass before publishing.
- Browser check of cockpit project knowledge and factory-growth views shows task mining as current and admission as later.
- Same mining prompt no longer cites superseded stage copy as justification for immediate admission work.
- No new “create the runner/rubric/replay” proposal is needed; existing `packages/task-miner/run.mjs` and held-out `factory/mining/` artifacts are referenced as existing, not missing.

Remaining questions:

- Remi’s preferred wording: rename stages, add an interim task-mining stage, or only clarify descriptions?
- Should the old roadmap be explicitly labeled superseded in UI, or just replaced?
- When should the context-review observation be retired?

## Candidate 2 — Narrow or close the fx/GitHub-read friction entry

Source evidence:

- `.agents/friction-log/20260912104654-task-mining-fx/friction.md:7-17`: fx emitted native approval before the authorized GitHub read; `run.mjs` now does a bounded continuation.
- `packages/task-miner/run.mjs:86-95,112-129`: read-only station, fixed-repository GET only, continuation only for validated GitHub-read calls, failed/GitHub-incomplete runs exit unsuccessfully.
- `packages/task-miner/README.md:29-31`: paused/failed/GitHub-incomplete runs are not useful baselines; adapter installs current fx binary, so compatibility must be checked jointly.
- `.agents/friction-log/README.md`: every entry left in the directory is still outstanding.

Useful outcome:

- Separates adapter-compatibility noise from mining-context quality, so future runs are not mis-scored.

Scope:

- Verification and friction-log update only: rerun a named non-overlapping mining run, record `finishReason`, GitHub-read completeness, fx/adapter versions, elapsed time and billing-window limits.
- Preserve provenance if closing the directory; do not score paused runs as baselines.

Acceptance checks:

- Run exits successfully with both `issues` and `pulls` marked complete.
- `result.json`/`segments.json` preserve any native approval diagnostics rather than calling an incomplete trace complete.
- Friction entry is updated with versions and evidence, or removed with Git history preserved if fixed.

Remaining questions:

- Which fx plus adapter versions should be pinned for the next replay?
- Who refreshes the team/project OIDC credential without falling back to personal fx config?
- Should compatibility be tracked separately from proposal-quality scores?

## What should wait

- Private registry swap: `vendor/README.md` plus `.agents/friction-log/20260912094635-adeo-private-package/friction.md` say replace the vendored ADEO `0.1.1` tarball with registry access later. The workaround is reproducible and stage-zero verification passes; it needs owner credential/package-access action and does not answer whether mining is useful.
- Cockpit issue listing, proposal persistence, cadence/triggers, deduplication, Eve station backend: `apps/factory/server/api/github.get.ts:1-42` is intentionally metadata-only; `docs/cockpit.md:21-26` and `factory/context/goal.md:20-21` leave those as undecided design choices. Build them only after mining output is useful.
- Jira mutations, API parity, accounts, Passport/SAML/directory sync, MCP/Connect integrations: `README.md:15`, `docs/verification.md:14`, `factory/context/goal.md:18` mark these as unimplemented later targets. A Jira task is justified only when it tests or teaches something relevant to the factory now.

## Reflection

The available context established the current goal, active calibration work, empty but complete GitHub reads, stage-zero app behavior, two outstanding friction entries, and the specific stale-copy and snapshot-boundary lessons.

It did not establish live deployment behavior today, browser verification of changed routes, owner wording taste, held-out prompt/rubric/run quality in `factory/mining/`, exact current fx runtime behavior, per-run cost attribution, or the outside-repository research sources cited by older docs. Those remain unavailable or require owner/developer action, so the recommendation stays a small context correction, not backend or product work.
