## Mined tasks — 12 September 2026

Scope: factory-first. Goal is a growable Eve factory for a 3–4h ADEO workshop; Jira is the test subject. Shipping Jira features alone is not factory progress. Mining proposes only; it does not implement or publish issues.

Backlog checked via authorized reader:

* `issues` for `software-factory-workshop/jira-clone`: `complete:true`, `items:[]`, `capturedAt: 2026-09-12T09:48:04.919Z`
* `pulls`: `complete:true`, `items:[]`, `capturedAt: 2026-09-12T09:48:10.767Z`

No duplicates possible against current backlog.

### 1. Reconcile shared stage copy with mining-first goal

**Outcome:** `packages/project-context` stage/brief copy and cockpit growth view describe task-mining as the current experiment and work-order admission as later, without claiming a shipped workflow.

**Why now:** This directly serves the near-term question in `factory/context/goal.md:15` — can a fresh agent suggest work Remi would consider without reconstructing the conversation? Right now a fresh agent sees conflicting plans.

Evidence:

* `factory/context/goal.md:8-12` — current experiment is task-mining station; developer-run harness/fx only; deployed apps remain stage-zero shells.
* `docs/factory-growth-experiment.md:21-27` — step 1 is now task-mining; “previous plan to start by admitting an ADEO issue-list request has been superseded.”
* `packages/project-context/src/index.ts:14-49` — stages still read `01 Understand the work: An Eve agent turns a request into a supported work order`, `02 Learn the project`, etc. No mining stage.
* `factory/reflections/2026-09-12-context-review.md:8-12` — already observed this divergence and hypothesized “a single current goal reduces irrelevant proposals. Compare fresh runs.”
* `apps/factory/app/app.vue:109-113` + `packages/project-context/src/index.ts:6-49` — cockpit growth view consumes that same copy.

**Relationship to existing issues:** None. Backlog empty per reads above. Not in `.agents/friction-log/` (outstanding: `20260912094635-adeo-private-package`, `20260912104654-task-mining-fx`).

**Bounded scope:** Edit copy only in `packages/project-context/src/index.ts` (`stages`, `references[brief]`) and any cockpit string that duplicates it. No behavior, no Eve wiring, no persistence. Run `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Acceptance criteria:**

* Stage 00 remains current; mining is explicit as current/next learning step; admission/bounded-edit/verification are visibly later.
* No copy claims run counts, traces, approvals, scores, or a deployed mining workflow — per `docs/cockpit.md:15` and `goal.md:11`.
* `docs/verification.md`-style browser check of knowledge/growth views passes; checks above pass.
* Remi can approve wording or reject in one review.

**Uncertainties:**

* Owner taste: keep `00-05` numbering or rename stages to factory capabilities per `docs/factory-growth-experiment.md:77`? Owner decision.
* Whether cockpit should duplicate copy or import it — source observation only.
* Hypothesis, not fact: that this alone reduces irrelevant proposals. Needs before/after run comparison.

### 2. Define minimal mining evaluation rubric + run-record template

**Outcome:** A small, repo-owned way to tell whether a bounded mining invocation helped, before building any cockpit async UI.

**Why now:** Goal requires “establish that a bounded invocation returns useful work; then build the cockpit experience around observed needs” (`goal.md:9`). Project map explicitly notes the gap.

Evidence:

* `factory/context/goal.md:14` — useful proposal “names a small outcome and explains how we would tell whether it helped.”
* `factory/context/project-map.md:14` — checks row: “no task-mining quality evaluation in the deployed app.”
* `docs/factory-growth-experiment.md:24-25` — “Judge evidence, relevance, duplicate checks, bounded outcomes and quality of reflection.”
* `docs/factory-growth-experiment.md:59-72` — required experiment record fields: request, versions, before/change/replay/transfer/human effort/cost/conclusion.
* `factory/README.md:7` — “Keep raw runs and evaluation material separate from context… Do not feed a run its expected answer.”
* `docs/verification.md:14` — explicitly does not verify stage-one agent behavior.

**Relationship to existing issues:** None. Backlog empty. Complements, does not duplicate, friction `20260912104654-task-mining-fx` which tracks runner/tool-approval incompatibility (`@ai-sdk/harness 1.0.107`, `harness-fx 1.0.20`), not eval quality.

**Bounded scope:** Add one criteria doc + one blank run-record template under `factory/mining/` (prompt, criteria, comparison per `factory/README.md:10`). No runner code changes, no Eve station, no webhook, no `github-tools` integration. State storage boundary: raw runs separate from supplied context.

**Acceptance criteria:**

* Criteria judge: evidence links, relevance to factory goal, closed+open duplicate check, bounded outcome, reflection quality with uncertainties separated.
* Template includes all fields from `factory-growth-experiment.md:59-72` and a “do not feed expected answer” guard.
* Worked example uses only this run’s sources, with dates and `capturedAt` for GitHub facts.
* Remi or reviewer can score two runs and retain/reject a context change.

**Uncertainties:**

* `factory/mining/**/*` and `packages/task-miner/**/*` referenced in `factory/README.md:10-12` and friction `20260912104654` (`run.mjs`, `factory/mining/runs/baseline-read-tool-retry/result.json`) returned no matches in this snapshot glob. Missing source observation: cannot tell if excluded from snapshot or absent in repo. Proposal must recheck full checkout before writing.
* Who judges and where raw runs persist remain open design choices per `goal.md:21` — owner decisions. Do not assume cadence/persistence/dedup from `docs/cockpit.md:24-25` sketch.

### 3. Scope the first bounded Jira demo scenario, no code

**Outcome:** One-page scenario defining the smallest Jira slice worth testing the factory on, with explicit non-goals.

**Why now:** Goal blocks implementation until this exists: “exact compatibility subset and identity behavior need concrete demo scenarios before implementation” (`goal.md:19`). Prevents drift into “feature parity” as an agreed spec, which goal explicitly rejects.

Evidence:

* `factory/context/goal.md:18-20` — recognizable issue/list/board with ADEO Nuxt UI; eventual targets include Jira API ops, Connect, MCP Toolkit, Passport-derived accounts, SAML, directory sync.
* `packages/project-context/src/jira-reference.json:11-33` — observed 12 Sep 2026: project `KAN (10000)`, board ID 1 type simple, issue types `[Epic,Subtask,Task,Story,Feature,Bug]`, statuses `[Done,To Do,In Review,Done]`-family; limitations: “Statuses are not a verified transition graph,” no browser/permissions/MCP inspected, “not clone compatibility proof.”
* `packages/project-context/src/index.ts:68-73` — cockpit knowledge correctly says “transition graph and browser appearance were not inspected.”
* `apps/jira/app/app.vue:62-68,133-135` — current shell is synthetic fixtures, no mutation; search/empty-state/filter only.
* `README.md:15`, `docs/verification.md:14` — no mutations, accounts, permissions, Jira-compatible API.
* `docs/factory-growth-experiment.md:36-40` — first task: “very small issue list or create-issue action… Keep fixture rendering and functional integration claims distinct.”

**Relationship to existing issues:** None. Backlog empty. Justified as factory-relevant per `goal.md:14` (“A Jira task is justified when it tests or teaches something relevant to the factory now”), not as feature shipping.

**Bounded scope:** Investigation doc only. Specify actor, starting sandbox state (IDs above), smallest behavior (e.g., scan list OR create issue — pick one), observable demo check, and non-goals: transitions, authZ, Passport/SAML/directory, MCP, Connect write paths. No product code, no API, no fixture changes.

**Acceptance criteria:**

* References only observed statuses/types/IDs; labels anything else as assumed.
* Distinguishes fixture rendering from integration claim.
* Lists deferred identity/integrations explicitly.
* Remi can approve one slice as input to factory steps 3–4 or reject as wrong slice.

**Uncertainties:**

* Which slice Remi wants first — owner decision. Model hypothesis: list-scan is smaller than create, but demo value unknown.
* Sandbox capture dated 12 Sep 2026 may be stale; browser appearance never inspected — needs recheck before implementation.
* Research paths in `docs/cockpit.md:29-35` (`/Users/remiconnesson/knowledge-work/...`) unavailable to repo-only session per `project-map.md:22` — cannot use them as evidence.

## Reflection

**What helped:** `factory/context/goal.md` as override authority when older roadmaps conflicted; `project-map.md` as navigation plus explicit warnings (no git history, fixed-repo GitHub read only, do not infer parity/MCP/SAML from Connect); dated reflection `2026-09-12-context-review.md` with provenance; `jira-reference.json` limitations; empty-but-complete GitHub reads with `capturedAt` to rule out duplicates; friction-log bodies distinguishing outstanding work from resolved entries.

**What was missing or contradictory:**

* Contradiction: `index.ts` stages (admission-first) vs `goal.md` + `factory-growth-experiment.md` (mining-first). Source of irrelevant proposals.
* Missing in snapshot: `packages/task-miner/` and `factory/mining/` referenced by `factory/README.md` and task-mining friction entry. Glob found only `factory/context/*` + `reflections/`. Cannot distinguish snapshot exclusion from repo deletion.
* Unverifiable from here: commits `9f22e30`, `c5d3d11`, revision `8308ea9`, hosted HTTP 200s, local browser checks — recorded in `docs/verification.md` but no git history or browser in this run.
* Research basis outside repo unavailable — must not be cited as inspected.

**What would improve next investigation:** snapshot manifest stating included/excluded paths; retain mining prompt + eval criteria in repo with raw-run separation enforced; provide closed-issue/PR dump (even when empty, with timestamp as done here); settle stage numbering after Proposal 1; add a one-page demo-scenario template so Proposal 3 has a fixed shape; surface friction resolved-vs-outstanding status so runs don’t re-propose completed fixes.
