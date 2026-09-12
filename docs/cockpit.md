# Stage-zero cockpit

The first cockpit should let us express useful work, inspect the context available to the factory, and see what capability we are growing next.

## Initial features

| Feature | Why it earns its place now | Current behavior |
| --- | --- | --- |
| Work requests | A stable work object can later connect attempts and decisions | Title, brief, local save/reopen, starter examples |
| GitHub connection | Work and factory changes should have a shared repository home | Connect for read-only repository context; issue composition opens GitHub for human submission |
| Project knowledge | We must inspect what the factory knows before judging its output | Brief, ADEO guidance, observed Jira metadata, research rationale |
| Factory growth | Make the workshop's learning progression explicit | Stage zero current; five future capabilities visibly planned |
| Product link | Keep domain feedback close to factory work | Open the ADEO Jira shell and inspect synthetic issues |

Do not show run counts, traces, spend, approvals, evaluation scores or verified badges until those capabilities exist. A browser-local draft is not a shared work order. An issue's existence is not evidence that an agent ran.

## Planned evolution: asynchronous task mining and proposals

Product direction recorded on 12 September 2026: the **“Start with a concrete problem”** starter-card area should become a task-mining and proposal surface.

A background workflow should discover candidate work from the project's available sources and propose useful tasks asynchronously. The cockpit should let the user review those proposals when ready, without waiting for mining to finish in an interactive request.

Proposed flow: **mine signals → form task proposals → review, refine or dismiss → accept into the work queue**. Each proposal should explain the suggested outcome, why it matters, and the source evidence behind it. Accepting a proposal should create a work request; execution remains a separate step.

The current static examples are the stage-zero placeholder for this capability. This is now the first factory experiment; see [the current goal](../factory/context/goal.md). A developer-run mining experiment is separate from the deployed cockpit, which still shows static examples. Source selection, triggers or cadence, and proposal deduplication remain design decisions.

## Research basis

Sources inspected in `/Users/remiconnesson/knowledge-work/software-factories`:

- `research/ui-report/report.md`
- `exploration-app/content/guide/factory-uis.md`
- `research/histories/evi/course.md`

The UI comparison suggests keeping one work object across attempts, showing specific reasons for human attention, and placing evidence next to decisions. AI SDK Factory informs the work/attempt relationship, Mastra the attention view, Vercel Factory the plan/evidence relationship, and Devbox continuity between conversation and change inspection. These are design interpretations from the research, not claims that this starter implements those systems.

## What waits for a backend

The first planned Eve station mines tasks from the goal, repository and current issues, then leaves proposals for review. We are testing its context and output with a developer-run experiment first. Add a run workspace and durable proposal records when that behavior has been established. Later capabilities may introduce work-order admission, bounded edits and verification.

For GitHub tools, use [Vercel Labs github-tools](https://github.com/vercel-labs/github-tools), including `@github-tools/eve-extension`, with the Connect connector. Check the installed extension and Eve versions before integrating; the historical Evi example in the research is not a current API contract. Start with the operations the stage actually needs. There is no inbound GitHub webhook or agent execution in stage zero.

## Review together

1. Open a starter request, edit it and save. Reload and reopen it.
2. Open project knowledge. Is the distinction between observations and assumptions clear?
3. Inspect the Jira list, board and issue details. Use these to give taste and product feedback.
4. Read the stage-one description. Agree on one capability and one observable acceptance case.

The workshop succeeds if we can show why the factory improved and whether that improvement transfers to different work.
