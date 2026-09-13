This is a read-only mining run. No files changed, no issues created.

## Current state checked 2026-09-12

Factory goal: the product is a growable Eve factory for a 3–4 hour ADEO workshop; the ADEO Jira demo is the test subject. The current authorized experiment is task mining only: establish that a bounded invocation returns useful work, then build cockpit experience around observed needs. Deployed apps remain stage-zero shells; developer-run AI SDK Harness/fx runner is not an Eve service, scheduler, or shipped cockpit feature. `factory/context/goal.md:5-15`

GitHub backlog:

* `issues` via `mcp_ai-sdk-harness-tools_github_read`: `complete:true, items:[]`, captured `2026-09-12T09:50:42.210Z`
* `pulls` via same tool: `complete:true, items:[]`, captured `2026-09-12T09:50:47.596Z`

Including closed items, there is no existing issue/PR to duplicate or extend. A failed read would be unavailable evidence; these reads succeeded and were empty.

Codebase inspected:

* Cockpit `apps/factory/app/app.vue`: starter requests, browser-local drafts, knowledge/growth views, issue composition opens GitHub for human submission; GitHub fetch is `immediate:false` + refresh after mount.
* Jira `apps/jira/app/app.vue:62-69,171`: synthetic fixtures only, explicit “Synthetic demo data” notice, no mutation or application API.
* Context `packages/project-context/src/index.ts:1-49,50-83,120-161`: stage 00 current, stages 01–05 still describe request-to-work-order admission; references describe brief, ADEO DS v0.1.1, Jira sandbox capture, research interpretation.
* Jira reference `packages/project-context/src/jira-reference.json`: project KAN/10000, board 1/simple, issue types and statuses observed, limitations explicitly say transition graph, browser appearance, permissions, MCP schemas were not inspected and this is not compatibility proof.
* Cockpit API `apps/factory/server/api/github.get.ts`: fixed-repository metadata GET through Connect only; does not list issues or run agents.
* Verification `docs/verification.md`: stage-zero checks pass; explicitly does not verify stage-one agents, issue mutations, Jira compatibility, accounts, SAML, directory sync, MCP, or demo integrations.
* Runner `packages/task-miner/run.mjs` + `packages/task-miner/README.md`: isolated sandbox runner exists, replay by revision supported, OIDC scope checks, fixed-repository GET only, bounded continuation, unsuccessful on paused/failed/GitHub-incomplete runs.
* Friction: `20260912104654-task-mining-fx` — fx native approval pauses before authorized GitHub read, native names differ from adapter schemas; `20260912094635-adeo-private-package` — private package needs `read:packages`, vendored tarball is the workaround.
* Reflections: `2026-09-12-context-review.md` — two definitions of next step, three Frog entries already fixed/resolved; `2026-09-12-snapshot-boundaries.md` — explicit hypotheses awaiting test, boundary ambiguity warning.

Withheld per `factory/context/project-map.md`: `factory/mining/` prompt, rubric, raw runs/scores. I treat them as existing but unavailable, not missing work.

## Proposals, ranked

### 1. Bounded mining replay to test the snapshot-boundary lessons

Outcome: A comparison of two fresh runs at a pinned revision, scored with the held-out evaluation, answering whether explicit source inventory + exact-quote checking reduces false missing-work proposals and transcription errors.

Why now: This is the exact near-term question in `factory/context/goal.md:15` and the explicit “Hypotheses to test” in `factory/reflections/2026-09-12-snapshot-boundaries.md`. The runner already supports replay; the lesson has not been tested.

Evidence:

* `factory/reflections/2026-09-12-snapshot-boundaries.md`: run proposed an evaluation rubric that already existed outside its snapshot; reproduced Jira status list incorrectly despite reading JSON; calls for same-prompt replay + differently worded investigation.
* `packages/task-miner/README.md`: `mine <run> [prompt] [revision]`, snapshot excludes `factory/mining/`, warns miner should not propose creating held-out criteria.
* `packages/task-miner/run.mjs`: records prompt, hashes, GitHub reads, usage, stop reason; requires `finishReason stop` + complete issues/pulls reads or exits unsuccessfully.
* `factory/context/project-map.md`: runner source available, prompt/rubric/runs withheld to avoid leakage.

Relationship to existing issues: None. Issues and pulls are both empty with complete reads, so no duplicate. This would produce evidence for the experiment, not a product feature.

Bounded scope: Investigation/evaluation only. Two runs only — (a) same-prompt replay, (b) reworded investigation — same revision, no prompt/rubric/runner changes, no implementation, no issue publication. Capture fx/harness/adapter versions per friction log.

Acceptance criteria:

* Both runs finish with `stop` and complete `issues` + `pulls` reads recorded under `factory/mining/runs/`.
* Scored with `factory/mining/evaluation.md` outside the miner snapshot.
* Report states for each run: did it claim a withheld file was missing, did it invent a transition graph or misquote statuses/arrays, exact source checked.
* Runtime/compatibility diagnostics preserved, not scored as quality baseline if paused/failed.

Uncertainties:

* I could not inspect the held-out prompt/rubric; scoring depends on them.
* Sandbox 5-minute expiry, OIDC/team Gateway costs, adapter installing current fx binary — versions may drift from `1.0.107/1.0.20` noted in friction log.
* Two runs test the hypothesis once; does not prove broad reliability.

### 2. Define 1–2 concrete workshop demo scenarios before any compatibility/identity work

Outcome: A short scenario note stating which Jira operations and identity behaviors the 3–4 hour ADEO workshop actually needs, and what is explicitly deferred.

Why now: `factory/context/goal.md:19` says exact compatibility subset and identity behavior need concrete demo scenarios before implementation; “feature parity” is not an agreed spec. Without this, the factory risks speculative Jira/SAML/MCP work that the goal says does not demonstrate factory progress.

Evidence:

* `factory/context/goal.md:19,21`: targets include Jira API ops, Connect, MCP Toolkit, Passport-derived accounts, SAML/directory sync — all need scenarios; task-mining source/cadence/persistence/review also undecided.
* `packages/project-context/src/jira-reference.json:28-33`: statuses are not a verified transition graph; permissions/MCP/browser not inspected.
* `packages/project-context/src/index.ts:68-74`: sandbox observations summary; `apps/jira/app/app.vue:62-69`: fixtures + “later stages” disclaimer.
* `docs/verification.md:14`: lists Jira compatibility, accounts, SAML, directory sync, MCP as not implemented / not verified.

Relationship to existing issues: None to duplicate. This would prevent premature Jira feature issues and give future Jira tasks a factory-relevant justification, per `goal.md:13`.

Bounded scope: Investigation/context only. No API, auth, Connect, MCP, SAML, or UI behavior changes. Maximum two scenarios tied to workshop timebox.

Acceptance criteria:

* Each scenario names actor, task, required fields/statuses/transitions/permissions, and maps each to observed KAN evidence vs. unobserved assumption.
* Explicit non-goals list: what SAML, directory sync, MCP, Connect delegation will not do yet.
* Remi review recorded; no code claims beyond `jira-reference.json` + current fixtures.

Uncertainties:

* Remi owns product taste and priorities; scenarios may be rejected or reshaped.
* Sandbox capture is dated 12 Sep 2026; unobserved transition graph and browser behavior remain unknown.
* Does not settle cockpit UX or mining cadence.

### 3. Reconcile stage/context copy with the task-mining goal

Outcome: Cockpit and shared-context strings consistently state task mining is current and request-to-work-order admission is a later candidate, reducing irrelevant admission-assumed proposals.

Why now: `factory/context/goal.md:29` explicitly says to use the current goal when older roadmap/UI strings still describe admission as immediate next step. The context review already observed two definitions of next step.

Evidence:

* `factory/reflections/2026-09-12-context-review.md`: `factory/README.md` + `docs/factory-growth-experiment.md` prioritized admission at `9f22e30`; deployed UI stage strings in `packages/project-context/src/index.ts` still describe earlier roadmap.
* `packages/project-context/src/index.ts:14-48`: stages 01–05 (“Understand the work”, “Learn the project”, etc.) vs. `factory/context/goal.md:9-13` task-mining station.
* `apps/factory/app/app.vue`: Stage 00 marker + knowledge/growth views render that context; `factory/README.md:5` now states mining first, admission later.

Relationship to existing issues: None. If accepted, it would supersede conflicting planning-doc language; per `AGENTS.md`, factory rule/context changes need review and a candidate cannot change its own judging rules.

Bounded scope: Context/doc strings only. No agent execution, scheduler, Eve workflow, or Jira behavior changes. Verify with `pnpm typecheck`, `pnpm test`, `pnpm build` and browser check of changed routes.

Acceptance criteria:

* Goal, project map, README, and UI-visible stage/reference copy agree mining is current; admission is labeled later candidate.
* Checks pass; no fixture, draft, or model assertion presented as verified run.
* Follow-up mining comparison notes whether admission-assumed proposals decreased; writing alone is not claimed as proof.

Uncertainties:

* Copy alone may not change proposal quality — the context-review hypothesis is untested.
* Owner must approve; mining runs cannot self-approve instruction changes per `goal.md:24-26`.

## Reflection

What helped: current `goal.md` with owner/date and explicit open choices; `project-map.md` with file-level navigation and withheld-artifact warning; two dated reflections with provenance and testable hypotheses; inspectable runner source + README; friction logs with versions and repro pointers; complete empty GitHub reads preventing duplicate proposals; `verification.md` scoping what stage zero does not prove.

What was missing or contradictory: held-out `factory/mining/` prompt, rubric, runs and `.mining-snapshot.json` listing were unavailable by design — I could not verify evaluation dimensions; no local Git history in this session, so commit claims like `c5d3d11` or `9f22e30` were taken from reflections, not rechecked; stage 01–05 copy contradicts the mining-first goal; adapter/fx version drift means replay compatibility must be rechecked each time.

What would improve the next investigation: publish a miner-visible source inventory without answers (as the snapshot-boundaries change intends); expose evaluation dimensions separately from scores if safe; log pinned fx/harness/adapter versions per run; add a one-line owner decision log for scenario taste so miners stop inferring parity/SAML/MCP scope from connectors or UI sketches.
