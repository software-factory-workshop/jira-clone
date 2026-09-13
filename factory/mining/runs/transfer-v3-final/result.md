In `software-factory-workshop/jira-clone` at `9f22e30`-era context:

GitHub is empty, verified now:

* `issues` read `2026-09-12T09:58:15Z`, `complete:true`, `items:[]`
* `pulls` read `2026-09-12T09:58:17Z`, `complete:true`, `items:[]`

That does not mean no active work. `factory/context/work-in-progress.md` says task-mining context calibration is active, awaiting review of fresh replay and transfer results, with artifacts intentionally in `factory/mining/` outside the mining snapshot. Do not re-propose that work.

### 1. Recommended for one small slot: reconcile stage copy with current goal

Source evidence:

* `factory/context/goal.md`: primary outcome is a growable/explainable factory for a 3-4h ADEO workshop; Jira is test subject; shipping Jira features alone is not factory progress; current experiment is task-mining understanding, not request-to-work-order admission or a shipped Eve station.
* `factory/README.md`: request-to-work-order admission is a later candidate, not the immediate milestone.
* `packages/project-context/src/index.ts:6-48`: `stages 01-05` still present Understand/Learn/Make/Check/Improve as `Planned`, shown in cockpit growth view via `apps/factory/app/app.vue`.
* `factory/reflections/2026-09-12-context-review.md`: explicitly notes two definitions of next step and leaves deployed UI stage strings describing the earlier roadmap as unresolved.

Useful outcome: a fresh agent/human sees one direction, reducing irrelevant admission-first or missing-rubric proposals.

Scope: copy-only in `packages/project-context`, no agent, no API, no Jira behavior change.

Acceptance checks:

* `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
* Browser check of cockpit knowledge/growth view shows task-mining as current, admission as later.
* `grep` shows no remaining admission-as-next-step stage copy; `goal.md` remains source of truth.

Remaining questions:

* Exact wording owner Remi wants for stage 00 vs planned stages?
* Should UI mention the developer-run experiment status without implying a shipped station?

### 2. Do next, after 1: replace vendored ADEO package with registry read

Source evidence:

* `vendor/README.md`: `@software-factory-workshop/nuxt-adeo-ds 0.1.1` vendored tarball is a workaround; replace with exact version + regenerated lockfile once registry access configured; repo must stay private.
* `.agents/friction-log/20260912094635-adeo-private-package/friction.md`: npm 403 without `read:packages`, fix is credential + Actions package access.
* `factory/reflections/2026-09-12-context-review.md`: private registry remains outstanding; vendored artifact makes stage-zero reproducible.
* `docs/verification.md`: current installs/builds/deployments pass with vendor path.

Useful outcome: clean checkout for workshop contributors.

Scope: credential/scope + dependency swap + lockfile + CI check; no secret in repo.

Acceptance checks:

* Clean `pnpm install --frozen-lockfile`, typecheck/test/build, GitHub Actions pass.
* Both apps still build on ADEO layer; `vendor/README.md` updated or tarball removed intentionally.

Remaining questions:

* Who owns token scope/rotation and which repo/actor gets Actions package read?
* Keep vendored fallback for offline workshop?

### 3. Explicitly wait: Jira/API/identity/MCP and cockpit Eve station

Source evidence:

* `apps/jira/app/app.vue`: search/filter/list/board/details over `demoIssues` synthetic fixtures; explicit synthetic-data notice; no mutation/API.
* `packages/project-context/src/jira-reference.json` + `src/index.ts:68-73`: only statuses/issue-types observed 12 Sep 2026; transition graph, permissions, browser, MCP not inspected.
* `apps/factory/server/api/github.get.ts`: fixed-repo metadata GET only; does not list issues or run agents.
* `factory/context/goal.md`: compatibility subset, identity, SAML/directory, Connect, MCP need concrete demo scenarios first; `feature parity` is not an agreed spec.
* `docs/verification.md`: explicitly does not verify agent behavior, mutations, Jira parity, accounts, SAML, MCP.

Why wait: expands demo surface without answering the near-term question — can a fresh agent suggest work Remi would consider? Decide demo scenario and review mining baselines first. No task is preferable to invented work.

How recommendation 1 serves the goal: it directly tests the stated hypothesis that one current goal reduces noisy proposals, improves the transfer test without building the cockpit prematurely, and keeps Jira as instrument, not product.

Reflection: context allowed establishing empty live backlog, active held-out experiment, stage-copy drift, working vendor workaround, and stage-zero limits. It did not allow judging mining proposal quality, replay/transfer results, prompt/rubric in `factory/mining/`, current hosted behavior, registry/Jira freshness, cost, or Remi's priority/taste. Recheck those before carrying any proposal forward.