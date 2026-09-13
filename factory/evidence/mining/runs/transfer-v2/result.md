On 12 September 2026, the ADEO workshop repository is in stage-zero with an empty GitHub backlog. For one small improvement, prove the mining experiment works before building any factory UI around it.

GitHub evidence, current run:

- `software-factory-workshop/jira-clone` issues: `complete:true, items:[]`, captured `2026-09-12T09:51:26.544Z`
- `software-factory-workshop/jira-clone` pulls: `complete:true, items:[]`, captured `2026-09-12T09:51:30.686Z`

Including closed items, per the reader contract. A failed read would be unavailable evidence, not an empty backlog — this was a successful empty read.

That matters because `factory/context/goal.md` says: no required proposal count, and no task is preferable to invented work. An empty backlog is a valid test: a useful miner must return “nothing to mine, here is what I checked” rather than inventing Jira features.

### 1. Recommended: replay the bounded task-miner and record whether it returns a useful empty-backlog result [do this one]

Source evidence:

- `factory/context/goal.md`: current experiment is a task-mining station, run asynchronously; first establish that a bounded invocation returns useful work, then build cockpit experience around observed needs. Developer-run `AI SDK Harness/fx` only; not an Eve service, scheduler, or shipped cockpit feature.
- `packages/task-miner/run.mjs` + `packages/task-miner/README.md`: runner exists, with OIDC scope checks, fixed-repository GET-only GitHub tool, snapshot manifest, bounded continuation, billing before/after, unsuccessful exit on paused/failed/GitHub-incomplete runs.
- `.agents/friction-log/20260912104654-task-mining-fx/friction.md`: with `@ai-sdk/harness 1.0.107 / harness-fx 1.0.20`, fx emitted a native approval for `mcp_ai-sdk-harness-tools_github_read` before the host tool; `generate` returned `finishReason tool-calls` with no GitHub read. Runner now has a bounded continuation for the exact fixed-repository tool only.
- `factory/reflections/2026-09-12-snapshot-boundaries.md`: held-out prompt/rubric/runs under `factory/mining/` are exclusion, not absence; do not propose creating an evaluation rubric merely because it is withheld.

Useful outcome:

Answer the near-term question in `goal.md`: can a fresh agent understand enough to suggest work Remi would seriously consider, without reconstructing the conversation — including the hard case where the backlog is empty.

Scope, read-only + developer-run only:

- Replay the existing runner as documented, no prompt/rubric changes, no code changes unless the replay reproduces the approval pause.
- Inspect `segments.json`, `result.md`, `github-reads.json`, `runtime.json`, billing files.
- Update only diagnostics: friction entry and/or runner README notes on fx version, adapter compatibility, stop reason.

Acceptance checks:

- Run exits successfully only if `finishReason: stop` and both `issues` and `pulls` reads are `complete:true`.
- Output distinguishes owner decisions, source observations, and model hypotheses, cites snapshot revision and GitHub capture times, and does not claim missing held-out files need to be created.
- No credentials, `.env`, dependencies, or held-out `factory/mining/` artifacts copied into the snapshot; secrets redacted in stored output.
- `pnpm typecheck/test/build` unaffected if no code changed; if runner touched, re-run relevant checks.

Remaining questions:

- Which exact `fx --version` + harness/adapter pair was used for the replay, since the adapter installs current fx?
- Does Remi accept an “empty backlog, no proposal” result as a useful baseline, and what comparison replay would test it?

### 2. Candidate if the runner already passes: align stage-zero copy with the task-mining goal

Source evidence:

- `packages/project-context/src/index.ts`: `stages` 01–05 still describe request-to-work-order admission → learn → bounded change → check → improve; `references` calls stage zero reviewable home with no agent execution yet.
- `factory/context/goal.md`: use current goal when an older roadmap or UI string still describes request-to-work-order admission as the immediate next step; those later capabilities remain possible, current learning experiment is task mining.
- `factory/reflections/2026-09-12-context-review.md`: notes the two definitions of next step and leaves deployed UI stage strings describing the earlier roadmap.
- `apps/factory/app/app.vue`: cockpit renders work/drafts, knowledge, growth views; issue composition opens GitHub for human submission — no agent execution.

Useful outcome:

A workshop visitor and a fresh mining agent see the same current story: mining first, admission later. Reduces irrelevant work-order proposals caused by conflicting plans.

Scope:

- Copy/context change only in `packages/project-context` and any cockpit strings that repeat the old next step. No new backend, no Eve workflow.
- Browser-verify knowledge/growth views render expected context; run `pnpm typecheck`, `pnpm test`, `pnpm build`.

Acceptance checks:

- No UI string presents fixtures, browser-local drafts, planned capabilities, or model assertions as verified runs.
- `docs/verification.md`-style dated manual check updated if routes touched.

Remaining questions:

- Does Remi want mining shown as an explicit stage, or keep 00–05 growth path with mining noted as the current 01 investigation?
- Retire or keep `docs/factory-growth-experiment.md` / `docs/cockpit.md` admission language alongside `goal.md`?

### 3. Candidate to defer unless checkout breaks: clarify vendored ADEO package vs private registry

Source evidence:

- `.agents/friction-log/20260912094635-adeo-private-package/friction.md`: clean checkout cannot fetch private ADEO package with repo-only credential, HTTP 403; stage zero uses vendored `v0.1.1` tarball under `vendor/`.
- `factory/reflections/2026-09-12-context-review.md`: private registry access remains outstanding; checked-in package is working workaround per `vendor/README.md`.
- `packages/project-context/src/index.ts` `adeo` reference: use `@software-factory-workshop/nuxt-adeo-ds 0.1.1`, native primitives inherit ADEO styling, do not invent parallel primitives.
- `docs/verification.md`, 12 Sep 2026: typechecks, draft-boundary test, both production builds pass; Git-origin deployments Ready.

Useful outcome:

Future contributor knows reproducible path today and what credential grant would remove the workaround, without storing secrets.

Scope:

- Docs/config check only: `vendor/README.md`, install instructions, CI package-access note. No design-system upgrade, no credential changes in repo.

Acceptance checks:

- Clean-checkout install + `pnpm check` + builds still pass via vendored path.
- No secret stored; later `read:packages` grant scoped to consumer repo Actions if pursued.

Remaining questions:

- Is fixing private package access worth time before the mining baseline is proven, given stage zero already builds and deploys?
- Who grants Actions package access and when?

### What should wait

Do not spend the one improvement on Jira list/board polish, Jira API parity, Vercel Connect expansion, Jira MCP, Passport-derived accounts, SAML/directory sync, request-to-work-order admission, or a deployed/scheduled Eve station. `goal.md`, `project-map.md`, and `docs/verification.md` explicitly mark these as unimplemented, later, or requiring concrete demo scenarios first. Shipping more Jira features alone does not demonstrate factory progress.

### How this serves the current goal

Goal is a factory Remi can grow and explain in a 3–4 hour onsite with Eve, with Jira only as test subject. Task 1 directly tests the stated precondition — bounded mining returns reviewable work — without building cockpit around unobserved needs. Tasks 2–3 are context improvements that prevent recycled fixes and false missing-work proposals, which is what `goal.md` calls a useful proposal.

### Reflection on context limits

What this run could establish on 12 Sep 2026:

- Current owner direction, stage-zero boundaries, and unresolved mining UX choices from `goal.md`, `project-map.md`, `factory/README.md`.
- Empty current issues/PRs with complete reads, so duplicate-avoidance is trivial and invention risk is high.
- Runner exists and already attempts the approval-continuation fix; friction logs give exact versions and failure mode to recheck.
- UI copy drift and vendored-package workaround are real, sourced gaps — not inferred defects.
- Withheld `factory/mining/` prompt/rubric/runs exist but were correctly not inspected; proposing to create them would repeat the error in `snapshot-boundaries.md`.

What it could not establish:

- No local Git history in this session; could not verify commits, `9f22e30` snapshot, or `c5d3d11` beyond what reflections cite. Used working-tree snapshot as source truth.
- Did not retest hosted UI, GitHub Connect token exchange, deployments, Jira API compatibility, or full Jira transition graph. Relied on dated `docs/verification.md` and `jira-reference.json` summary boundaries.
- Did not read `factory/mining/prompt.md`, evaluation criteria, or prior run scores; cannot judge proposal quality transfer.
- No access to outside research sources referenced by older docs; cannot claim they were read.
- No owner taste check with Remi; recommendations remain candidates.