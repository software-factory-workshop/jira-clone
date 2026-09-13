## Task-mining proposals — 12 September 2026

Live GitHub backlog check was unavailable in this run: `mcp_ai-sdk-harness-tools_github_read(issues)` returned `permission_denied / user_denied`. Per `factory/context/project-map.md:19`, a failed read is unavailable evidence, not an empty backlog. All duplicate relationships below must be rechecked with current `issues` + `pulls` + `issue_comments` before implementation. `factory/context/work-in-progress.md:3` also warns an empty issue list does not imply no active work.

I return two proposals. A third is not justified — see closing note.

### 1. Reconcile stage copy with the current task-mining goal

**Outcome:** a small context-only candidate that makes `packages/project-context/src/index.ts` stages, factory growth view, and `factory/context/goal.md` tell the same story: task mining now, request-to-work-order admission later.

**Why now:** the near-term question is whether “a fresh agent [can] understand enough … without reconstructing the conversation” (`factory/context/goal.md:15`). The reviewed reflection hypothesizes “a single current goal reduces irrelevant proposals caused by conflicting plans” (`factory/reflections/2026-09-12-context-review.md:9-11`). Goal precedence is explicit: “Use this current goal when an older roadmap or UI string still describes request-to-work-order admission as the immediate next step” (`factory/context/goal.md:27`).

**Exact evidence:**
- Current direction: `factory/context/goal.md:9-15`, `factory/context/goal.md:21-22` — mining source selection, cadence, persistence, deduplication remain open design choices.
- Superseded plan: `docs/factory-growth-experiment.md:21-27` — “Request-to-work-order admission remains a possible later capability. The previous plan to start by admitting an ADEO issue-list request has been superseded by task mining.”
- Conflicting UI strings: `packages/project-context/src/index.ts:14-28` — Stage 01 “An Eve agent turns a request into a supported work order” is `Planned`, with no mention that the active experiment is read-only task mining.
- Prior observation left open: `factory/reflections/2026-09-12-context-review.md:8-9` — “The deployed UI stage strings still describe the earlier roadmap in `packages/project-context/src/index.ts`.”
- Navigation aid, not proof of behavior: `factory/context/project-map.md:9`, `factory/README.md:5`.

**Relationship to existing issues:** unknown — live read denied. Must search open + closed issues for “stage copy”, “goal”, “admission”, “task mining” before work. Do not treat this as proof no such issue exists. This is a context improvement, not a factory-capability or Jira-feature task.

**Bounded scope:**
- Inspect `apps/factory/app/app.vue` growth/knowledge rendering and `packages/project-context/src/index.ts` stages/references only.
- Propose wording that names the developer-run mining experiment as current, keeps admission/bounded-edit/verification as later, and preserves uncertainty.
- No runner, prompt, rubric, Eve service, scheduler, or Jira behavior changes. No `factory/mining/` held-out material is needed.

**Acceptance criteria:**
- Candidate diff touches only stage/reference copy and any directly rendered growth strings.
- Copy states: deployed apps remain stage-zero; mining experiment is developer-run and read-only; admission is later.
- `pnpm typecheck`, `pnpm test`, `pnpm build` pass; changed routes render with no new console/hydration errors.
- Proposal cites which lines of `goal.md` each stage string now follows.

**Uncertainties:**
- Owner taste: Remi owns priorities and product taste (`factory/context/goal.md:25`).
- How much held-out experiment detail the UI may name without leaking expected answers (`packages/task-miner/README.md:33`, `factory/context/work-in-progress.md:13-14`).
- Whether to keep numeric stages 01–05 or relabel them as capabilities rather than sequence.

### 2. Capture read-only KAN transition evidence to bound compatibility claims

**Outcome:** a dated, read-only note distinguishing observed Jira statuses from the unobserved transition graph, preventing the clone from treating board columns as allowed transitions.

**Why now:** product direction says “The exact compatibility subset and identity behavior need concrete demo scenarios before implementation” and “feature parity is not evidence of a complete, agreed endpoint specification” (`factory/context/goal.md:19`). The reference capture explicitly did not inspect transitions (`packages/project-context/src/jira-reference.json:28-33`). The Jira shell currently builds board columns directly from a status list (`apps/jira/app/app.vue:7`, `apps/jira/app/app.vue:137-168`), with fixture disclaimer (`apps/jira/app/app.vue:62-69`, `apps/jira/app/app.vue:170-172`). A prior run “reproduced a Jira status list incorrectly despite having read the JSON reference” (`factory/reflections/2026-09-12-snapshot-boundaries.md:9`). This investigation tests evidence handling, not Jira feature count.

**Exact evidence:**
- Observed: project KAN `10000`, board ID 1 type `simple`, issue types `["Epic","Subtask","Task","Story","Feature","Bug"]`, statuses `["Done","To Do","In Review","In Progress"]` — `packages/project-context/src/jira-reference.json:11-27`, summarized in `packages/project-context/src/index.ts:71-74`.
- Limitations: “Statuses are not a verified transition graph”, “Browser appearance, issue content, permissions and MCP schemas were not inspected” — `packages/project-context/src/jira-reference.json:28-33`.
- Map warning: “distinguish observed statuses from an unobserved transition graph” (`factory/context/project-map.md:11`); “Do not infer Jira API parity, MCP, SAML or directory sync from a working connector” (`factory/context/project-map.md:21`).
- Stage-zero boundary: `docs/verification.md:14` does not verify “Jira API compatibility, application accounts, SAML, directory sync, Jira MCP or demo integrations.”

**Relationship to existing issues:** unknown — live read denied. Must check open + closed issues/PRs for “KAN transitions”, “workflow”, “compatibility subset”, “jira-reference” and read relevant `issue_comments`. Per `factory/context/work-in-progress.md:15`, also check newer repo/GitHub evidence before assuming this dated local record is current.

**Bounded scope:**
- Read-only authenticated REST for KAN workflow/transitions metadata only; no issue creation, transition execution, or config change.
- Record exact request paths, timestamps, redacted response excerpt, and what remains unknown.
- Update or append to reference material without claiming clone compatibility; store no secrets.
- No UI drag-and-drop, mutation API, accounts, SAML, MCP, or Connect changes.

**Acceptance criteria:**
- Dated artifact states for each status whether any allowed outgoing/incoming transition was observed, with source path and revision/date.
- Explicit sentence: observed status list is not a transition graph.
- No invented IDs, arrays, paths, or line references; exact values verified against source immediately before use (lesson in `factory/reflections/2026-09-12-snapshot-boundaries.md:9`).
- If the simplified/next-gen project exposes no classic workflow graph, the artifact records that negative result and stops.

**Uncertainties:**
- Simplified `next-gen` KAN behavior may not expose a stable workflow API; board type `simple` may limit what REST returns.
- Permissions/sandbox drift since `2026-09-12` capture.
- Which single demo scenario Remi wants first; this task must not select the compatibility subset alone.

### Why no third proposal

Candidates considered but rejected as not useful now:

- Creating the runner, publishing the snapshot inventory, or starting the same replay/transfer comparison: explicitly prohibited as a new task in `factory/context/work-in-progress.md:7-12`. The runner exists (`packages/task-miner/run.mjs:86-104`, `packages/task-miner/README.md:3-16`); held-out prompt/rubric/runs are withheld by design (`factory/context/work-in-progress.md:13-14`, `packages/task-miner/README.md:33`). Absence from snapshot does not prove absence of work (`factory/reflections/2026-09-12-snapshot-boundaries.md:5-7`).
- Proposing durable proposal records / async Eve station / work-order admission: deferred until mining usefulness is established (`docs/cockpit.md:39`, `docs/cockpit.md:25`, `factory/context/goal.md:9-11`).
- Jira CRUD, accounts/Passport, SAML/directory sync, MCP Toolkit, Connect webhooks: product targets needing concrete demo scenarios first (`factory/context/goal.md:19`, `docs/verification.md:14`); shipping them alone does not demonstrate factory progress (`factory/context/goal.md:5`).
- Registry credential switch from `vendor/` tarball: outstanding but mitigated by documented workaround (`vendor/README.md:3-9`, `.agents/friction-log/20260912094635-adeo-private-package/friction.md:10-14`); environment hygiene without a factory-learning question. Inventing a third task would violate “no task is preferable to invented work” (`factory/context/goal.md:13`).

## Reflection

**What helped:** `factory/context/goal.md` precedence rule and “useful proposal” definition; `factory/context/work-in-progress.md` active-work guardrails; `factory/context/project-map.md` navigation plus explicit unavailable-evidence and held-out-material rules; two dated reflections naming the stage-copy conflict, false-missing-rubric lesson, replay-duplication lesson, and transcription-error lesson; `packages/task-miner/README.md` + `run.mjs` proving the runner/snapshot/approval-continuation already exists; `packages/project-context/src/index.ts` vs `jira-reference.json` vs `apps/jira/app/app.vue` vs `apps/factory/server/api/github.get.ts` for exact current behavior; `docs/cockpit.md`, `docs/factory-growth-experiment.md`, `docs/verification.md` for stage boundaries; friction logs for adapter-pause and private-package workarounds.

**What was missing or contradictory:** live GitHub issues/PRs/comments denied, so deduplication is impossible this run; `factory/mining/` evaluation, prompts, and scores withheld by design; no local git history in this session; stage-copy conflict unresolved (goal says mining now, `index.ts` Stage 01 still implies admission next); older roadmap language persists in docs alongside the supersession note.

**What would improve the next investigation:** approve the fixed-repository `issues` + `pulls` read and targeted `issue_comments`; expose a non-leaking summary of replay/transfer review status (accepted vs pending, without answers); provide `frog list` status for the three supposedly resolved friction entries; add a one-line owner decision log when stage wording or demo-scenario scope is chosen.
