# Project map for an investigation

Source review: 12 September 2026, updated during the Eve station delivery. Recheck the files below against the run snapshot. This is a navigation aid, not proof that a deployed route works today.

| Question | Start here | What the source currently supports |
| --- | --- | --- |
| What is already underway? | `factory/context/work-in-progress.md`, current GitHub reads | Developer work can be active without an issue; inspect both |
| What are we trying to learn? | `factory/context/goal.md` | Current owner direction and unresolved decisions |
| What does the cockpit do? | `apps/factory/app/app.vue` | Task mining, starter requests, browser-local drafts, knowledge and growth views; issue composition opens GitHub for human submission |
| What GitHub access exists? | `apps/factory/server/api/github.get.ts` | Fixed-repository metadata GET through Connect; it does not list issues or run agents |
| How does task mining execute? | `apps/factory/agent/tools/investigate_repository.ts`, `packages/task-miner/runtime.mjs`, `packages/task-miner/github.mjs` | Eve owns a durable investigation; fx reads a pinned GitHub snapshot in a fresh Sandbox, with a fixed-repository GET tool |
| How are findings reviewed? | `apps/factory/app/components/MiningStation.vue`, `MiningRun.vue` | Resume sessions, review reports and evidence, move findings into editable browser-local drafts |
| What Jira behavior exists? | `apps/jira/app/app.vue` | Search, status filter, list, board and details over synthetic fixtures; no issue mutation or application API |
| Which context is shared with the UI? | `packages/project-context/src/index.ts` | Stage copy, reference summaries, starter examples, draft parser and fixture issues |
| What was observed in real Jira? | `packages/project-context/src/jira-reference.json` | Dated sandbox capture; distinguish observed statuses from an unobserved transition graph |
| Which design system applies? | `.agents/skills/adeo-nuxt-ui/SKILL.md`, app Nuxt configs, `vendor/README.md` | Existing private ADEO Nuxt UI layer 0.1.1; both applications use it |
| What checks exist? | `packages/project-context/tests/drafts.test.ts`, `.github/workflows/check.yml`, `docs/verification.md` | Draft parser coverage, typechecks/builds and dated manual UI evidence; no task-mining quality evaluation in the deployed app |
| What friction is recorded? | `.agents/friction-log/` | Read the entry body and current source before proposing a fix; pending metadata can lag a completed correction |
| What experiments are running? | `factory/README.md` | Developer-run mining and shipped behavior have separate status |

GitHub issue and PR facts must come from the current run's authorized read. Include closed work when looking for duplicates. A failed read is unavailable evidence, not an empty backlog. The current mining session has no local Git history; use its source snapshot and the supplied GitHub reader rather than inventing commit facts.

Platform Passport deployment protection is separate from application accounts and roles. A Connect token grants delegated provider access; it is not evidence of an application's authorization model. Do not infer Jira API parity, MCP, SAML or directory sync from a working connector.

The research paths in older documents point outside this repository and are unavailable to a repo-only mining session. Their summaries are context, not inspected primary evidence. If a proposal depends on one of those sources, name the missing source or propose a scoped excerpt instead of claiming to have read it.

The developer experiment has an existing runner in `packages/task-miner/run.mjs`, with setup and limits in its README. Its current prompt, review rubric and raw runs exist under `factory/mining/` but are withheld from the mining snapshot to avoid answer leakage. Treat them as unavailable for detailed inspection, not missing work. A proposal to change the experiment should inspect the available runner and identify the specific unproven behavior, rather than assume no runner or rubric exists.
