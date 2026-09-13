# Project map for an investigation

Source review: 13 September 2026, updated during the Jira current-state review. Recheck the files below against the run snapshot. This is a navigation aid, not proof that a deployed route works today.

| Question | Start here | What the source currently supports |
| --- | --- | --- |
| What is already underway? | `factory/context/work-in-progress.md`, current GitHub reads | Developer work can be active without an issue; inspect both |
| What are we trying to learn? | `factory/context/goal.md` | Current owner direction and unresolved decisions |
| What does the cockpit do? | `apps/factory/app/app.vue` | Task mining, starter requests, browser-local drafts, knowledge and growth views; issue composition opens GitHub for human submission |
| What GitHub access exists? | `apps/factory/server/api/github.get.ts` | Fixed-repository metadata GET through Connect; it does not list issues or run agents |
| How does task mining execute? | `apps/factory/agents/task-miner/agent/`, `apps/factory/runtime/tools/` | Native Eve inspects a pinned working tree in its own Sandbox, reproduces behavior and records findings with GitHub and Vercel evidence |
| What Vercel access exists? | `apps/factory/runtime/tools/vercel_read.ts`, `apps/factory/runtime/lib/vercel-context.ts` | Host-only `factory/jira-clone-machine` Connect credential and fixed GET reads for the two demo projects; bounded deployment/build/runtime samples carry coverage; verify live access in dated evidence |
| How are findings reviewed? | `apps/factory/app/components/MiningStation.vue`, `MiningRun.vue` | Resume native and historical sessions, review findings and incomplete context, inspect command evidence, move findings into editable browser-local drafts |
| How does assigned work become a PR? | `factory/work-stations.md`, `apps/factory/agents/worker/`, `apps/factory/runtime/lib/work-github.ts` | Explicit authenticated task, isolated source changes, required checks, bounded host-only publication of a draft PR |
| How is a PR independently reviewed? | `apps/factory/agents/reviewer/` | Separate base/head snapshots, baseline policy, independent required checks and a recorded exact-revision verdict; deterministic workflow evaluates merge policy |
| Where are worker and reviewer controls? | `apps/factory/app/components/WorkActions.vue`, `WorkRun.vue` | Start the selected draft or PR explicitly, follow the selected root agent, inspect results and cancel work |
| Who drives delivery? | `apps/factory/server/workflows/delivery.ts`, `docs/delivery-loop.md` | Durable Workflow calls independent root agents, returns findings to the same worker, and applies a conservative merge policy |
| What Jira behavior exists? | `apps/jira/app/app.vue`, `docs/jira-current-state.md` | Bounded issue, list, board and detail behavior over synthetic data, with native and Jira-shaped REST writes, comments, reset, transitions and role-aware identity |
| Which context is shared with the UI? | `packages/project-context/src/index.ts` | Stage copy, reference summaries, starter examples, draft parser and fixture issues |
| What was observed in real Jira? | `packages/project-context/src/jira-reference.json` | Dated sandbox capture; distinguish observed statuses from an unobserved transition graph |
| Which design system applies? | `.agents/skills/adeo-nuxt-ui/SKILL.md`, app Nuxt configs, `vendor/README.md` | Existing private ADEO Nuxt UI layer 0.1.1; both applications use it |
| What checks exist? | `packages/project-context/tests/drafts.test.ts`, `.github/workflows/check.yml`, `docs/verification.md` | Draft parser coverage, typechecks/builds and dated manual UI evidence; no task-mining quality evaluation in the deployed app |
| What friction is recorded? | `.agents/friction-log/` | Read the entry body and current source before proposing a fix; pending metadata can lag a completed correction |
| What experiments are running? | `factory/README.md` | Developer-run mining and shipped behavior have separate status |

GitHub issue and PR facts must come from the current run's authorized read. Include closed work when looking for duplicates. A failed read is unavailable evidence, not an empty backlog. The mining working tree excludes local Git history and held-out evaluations. The current GitHub reader exposes issues, pull requests and comments; it does not expose commit history or CI logs. Name those as missing evidence when they are needed rather than inventing commit or check facts. The source manifest records the pinned revision and exclusions.

Platform Passport deployment protection is separate from application accounts and roles. A Connect token grants delegated provider access; it is not evidence of an application's authorization model. Do not infer Jira API parity, MCP, SAML or directory sync from a working connector.

The research paths in older documents point outside this repository and are unavailable to a repo-only mining session. Their summaries are context, not inspected primary evidence. If a proposal depends on one of those sources, name the missing source or propose a scoped excerpt instead of claiming to have read it.

The developer fx experiment remains packaged separately from the native Eve station; inspect `factory/README.md` for its current path and setup. Its current prompt, review rubric and raw runs exist under `factory/mining/` but are withheld from the mining snapshot to avoid answer leakage. Treat them as unavailable for detailed inspection, not missing work. A proposal to change the experiment should inspect the available runner and identify the specific unproven behavior, rather than assume no runner or rubric exists.
