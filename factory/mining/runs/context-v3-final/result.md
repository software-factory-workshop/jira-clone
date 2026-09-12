## Ranked proposals (factory-first)

GitHub backlog checked 2026-09-12 in this run:

* `issues` — `complete:true`, `items:[]`
* `pulls` — `complete:true`, `items:[]`

No open or closed issues/PRs to duplicate. Active work is therefore taken from `factory/context/work-in-progress.md` + source, not from GitHub alone.

### 1. Align shared stage copy with the current task-mining goal

**Outcome:**
Update the stage/brief strings served by `packages/project-context/src/index.ts` so stage-zero says task-mining understanding is the current experiment, and request-to-work-order admission / bounded edits / verification remain visibly planned, with no implication of deployed agent execution.

**Why now:**
This is known context debt that directly harms the near-term question. The goal chooses task-mining first; the UI strings still describe the older work-order-first roadmap. Fresh miners and workshop reviewers then propose irrelevant admission work.

**Exact evidence:**

* `packages/project-context/src/index.ts:6-49` — `stage:"00"`, stages `01` “Understand the work … work order”, `02`–`05` planned, no task-mining stage.
* `factory/context/goal.md:8-15` — current experiment is task-mining station; bounded invocation first, then cockpit around observed needs.
* `factory/context/goal.md:19-21,27-29` — use current goal when older roadmap/UI still describes admission as immediate next step; task-mining design choices remain open.
* `factory/reflections/2026-09-12-context-review.md:5-11` — observation: “next step had two definitions”; deployed UI stage strings still describe earlier roadmap.
* `docs/factory-growth-experiment.md:21-27` — admission superseded by task mining; do not count runner as proof mining is useful.
* `apps/factory/app/app.vue:1-9,91-114` — cockpit renders `stages/references` from shared context; `docs/verification.md:8-10` only verifies static rendering, not stage-one behavior.

**Relationship to existing issues:**
No GitHub duplicate — both inventories empty and complete. Complements `factory/context/work-in-progress.md:5-13` active calibration; explicitly avoids the forbidden duplicate: creating runner, publishing inventory, or restarting the same replay/transfer comparison.

**Bounded scope:**
Edit only `packages/project-context/src/index.ts` copy (+ parser/test only if touched). No cockpit redesign, no API, no mining-runner change, no publication.

**Acceptance criteria:**

* `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
* Cockpit “Project knowledge” and “Factory growth” clearly separate: current task-mining investigation vs planned capabilities.
* No string claims run counts, traces, approvals, scores, verified badges, agent execution, or shared work orders — consistent with `docs/cockpit.md:15`.
* Wording reviewed by Remi as owner of priorities/taste.

**Uncertainties:**

* Owner taste: add explicit “Stage 01: Mine and understand work” vs relabel existing `01` description.
* Whether brief copy in same file (`index.ts:56-58`) also needs a one-line goal pointer.
* Hypothesis only: single current goal reduces irrelevant proposals — needs fresh-run comparison, not assumed.

---

### 2. Make mining replays comparable by recording/pinning the `fx` binary

**Outcome:**
`packages/task-miner/` records the exact `fx` binary identity used for each run and surfaces drift, so same-prompt replays vs differently-worded probes can distinguish context change from runtime change.

**Why now:**
The active work is awaiting review of fresh replay and transfer results. The runner currently records adapter/harness versions but the `fx` binary floats, confounding exactly that comparison.

**Exact evidence:**

* `packages/task-miner/run.mjs:98-101` — writes `runtime.json` with `fxVersion`, `harness:'1.0.107'`, `adapter:'1.0.20'`.
* `packages/task-miner/README.md:30-32` — adapter installs current `fx` binary; package versions alone do not freeze that binary; check compatibility when replaying.
* `.agents/friction-log/20260912104654-task-mining-fx/friction.md:10-17` — native approval pause, trace validation mismatch, OIDC handling; runner now does bounded continuation in `run.mjs:113-124`.
* `factory/context/work-in-progress.md:5-13` — calibration deliverable is reviewed comparison with limitations, not deployed station; do not propose recreating runner or same replay comparison.
* `factory/reflections/2026-09-12-snapshot-boundaries.md:10-11` — hypotheses about explicit inventory and checking quoted details; fresh replays/probes in progress.

**Relationship to existing issues:**
No GitHub duplicate. Narrows to a specific gap in the available runner, as required by WIP, rather than proposing the underway replay work itself.

**Bounded scope:**
Only `packages/task-miner/run.mjs`, `README.md`, and run-output `runtime.json`/`inputs.json` conventions. No cockpit change, no evaluation-criteria change, no held-out `factory/mining/` answer ingestion.

**Acceptance criteria:**

* Each run directory records reproducible runtime identity: `fx --version` + binary digest/install source where available, alongside harness/adapter/model/snapshot hash.
* A replay with different binary emits an explicit drift warning/failure instead of silently becoming a “baseline.”
* `run.mjs` still exits non-zero on paused/failed/GitHub-incomplete runs per `run.mjs:129`.
* No credentials written to artifacts; redaction in `run.mjs:28-33` preserved.

**Uncertainties:**

* Whether sandbox install permits pinning `fx` or only recording digest.
* Who owns adapter bumps vs experiment windows; overlapping team Gateway traffic already prevents exact per-run cost attribution per `README.md:29`.
* Model variation vs factory change remains; one rerun is observation, not proof per `docs/factory-growth-experiment.md:73`.

---

### 3. Extend the read-only Jira reference with observed transitions

**Outcome:**
A dated, read-only capture that resolves the explicit “statuses are not a transition graph” limitation for project `KAN`, enabling one concrete board demo scenario without building board mutation.

**Why now:**
Board behavior is the smallest useful Jira slice, but current demo hardcodes statuses and warns not to assume transitions. Future bounded implementation needs a real, minimal compatibility target; goal explicitly says exact subset needs concrete scenarios before implementation.

**Exact evidence:**

* `packages/project-context/src/jira-reference.json:22-33` — issue types and status list recorded; limitations: “Statuses are not a verified transition graph”, no permission/MCP/browser inspection, “not clone compatibility proof.”
* `packages/project-context/src/index.ts:68-73` — “transition graph and browser appearance were not inspected.”
* `apps/jira/app/app.vue:7,137-169` — `statuses=["To Do","In Progress","In Review","Done"]` drives board columns; all fixture-only per `app.vue:62-69,186`.
* `factory/context/goal.md:19` — demo needs recognizable issue/list/board; exact compatibility and identity need concrete scenarios; “feature parity” is not an agreed spec.
* `docs/verification.md:14` — does not verify Jira API compatibility, accounts, MCP, SAML, sync.
* Starter “A board worth using” in `index.ts:91-94` — use observed statuses, do not assume allowed transitions.

**Relationship to existing issues:**
No GitHub duplicate. Not Jira feature implementation; investigation/context improvement explicitly allowed by `goal.md:13-14` when it tests/teaches something relevant to the factory now.

**Bounded scope:**
Read-only REST only — e.g. issue-transition and board-configuration reads for `KAN`/`KAN board ID 1`; update `jira-reference.json` + reference summary text. No issue mutation, no UI drag-and-drop, no accounts/permissions enforcement, no MCP/SAML/Connect product work, no secrets in repo.

**Acceptance criteria:**

* JSON records `observedOn`, method, exact request paths, HTTP statuses, per-issue-type transitions if available, and updated limitations.
* Cockpit/Jira copy continues to distinguish observed transitions from unobserved behavior.
* `pnpm typecheck`, `pnpm test`, `pnpm build` pass if context shape changes.
* No Jira data changed; verification notes the sandbox base URL already in file.

**Uncertainties:**

* Simplified next-gen project may expose global vs issue-specific transitions; available issue keys for transition reads unknown.
* Whether board engine needs workflow-scheme or agile-config endpoints beyond transitions.
* Remi must decide which minimal transition subset becomes the first demo scenario; capture alone does not choose it.

---

## Reflection

**What helped:**
Current `factory/context/goal.md` as decision authority over older roadmaps; `work-in-progress.md` guardrails against proposing runner creation or duplicate replay work; `project-map.md` navigation to `github.get.ts`, `app.vue` files, `project-context`, verification, and friction; available `packages/task-miner/run.mjs` + `README.md` + `github-input.mjs` for specific-gap analysis; `jira-reference.json` explicit limitations; live empty-but-complete GitHub reads proving no backlog duplicate.

**What was missing or contradictory:**

* `.mining-snapshot.json` read truncated after ~13 entries; full include/exclude list not verifiable in one read.
* `factory/mining/` prompt, rubric, raw runs, scores intentionally held out — cannot judge replay quality directly; treated as unavailable, not absent, per map/reflections.
* No local Git history in this session; revision `9f22e30` taken from map/snapshot, not independently verified.
* Contradiction retained: shared stage copy (`index.ts`) vs current goal (proposal 1).
* Research primaries under `/Users/remiconnesson/...` cited in `docs/cockpit.md:29-35` unavailable to repo-only mining; only interpretations in-repo.
* `fx` binary floats while replay comparability is required.

**What would improve next investigation:**
Full non-truncated snapshot manifest; a non-sensitive mining-comparison summary (run dates/counts/completeness, not answers); a short checked-in research excerpt to replace outside-path citations; recorded `fx` binary digest per run; an owner decision on stage naming for task-mining vs work-order admission.
