# Factory cockpit

The cockpit supports on-demand task mining, editable work requests, inspection of project context, and the factory's next capability. Updated 12 September 2026 during the native Eve migration; see [dated verification](verification.md) for tested behavior.

## Initial features

| Feature | Why it earns its place now | Current behavior |
| --- | --- | --- |
| Task mining | Understand useful work before implementation | Native Eve investigation in a Sandbox, source and integration evidence, reproduction results, durable replay, draft handoff |
| Work requests | A stable work object can later connect attempts and decisions | Title, brief, local save/reopen, starter examples |
| GitHub connection | Work and factory changes should have a shared repository home | Connect for read-only repository context; issue composition opens GitHub for human submission |
| Project knowledge | We must inspect what the factory knows before judging its output | Brief, ADEO guidance, observed Jira metadata, research rationale |
| Factory growth | Make the workshop's learning progression explicit | Stage zero established; station 01 task mining current; later capabilities planned |
| Product link | Keep domain feedback close to factory work | Open the bounded ADEO Jira demo and inspect synthetic seed issues |

Do not show run counts, traces, spend, approvals, evaluation scores or verified badges until those capabilities exist. A browser-local draft is not a shared work order. An issue's existence is not evidence that an agent ran.

## Asynchronous task mining and proposals

Product direction recorded on 12 September 2026: the **“Start with a concrete problem”** starter-card area should become a task-mining and proposal surface.

A background workflow should discover candidate work from the project's available sources and propose useful tasks asynchronously. The cockpit should let the user review those proposals when ready, without waiting for mining to finish in an interactive request.

Proposed flow: **mine signals → form task proposals → review, refine or dismiss → accept into the work queue**. Each proposal should explain the suggested outcome, why it matters, and the source evidence behind it. Accepting a proposal should create a work request; execution remains a separate step.

The cockpit starts an on-demand native Eve investigation; see [the current goal](../factory/context/goal.md) and [station contract](../factory/task-mining-station.md). It runs independently of the browser and stores the original report and evidence in its Eve session. Static starters remain available in Work alongside the mining station. Recent session links and editable drafts are browser-local. Scheduled triggers, shared proposal indexing and deduplication remain design decisions.

## Research basis

Sources inspected in `/Users/remiconnesson/knowledge-work/software-factories`:

- `research/ui-report/report.md`
- `exploration-app/content/guide/factory-uis.md`
- `research/histories/evi/course.md`

The UI comparison suggests keeping one work object across attempts, showing specific reasons for human attention, and placing evidence next to decisions. AI SDK Factory informs the work/attempt relationship, Mastra the attention view, Vercel Factory the plan/evidence relationship, and Devbox continuity between conversation and change inspection. These are design interpretations from the research, not claims that this starter implements those systems.

## What comes after this station

The first Eve station mines tasks from the goal, repository and current issues/PRs, then leaves proposals for review. The fx calibration runner remains a separate experiment. The hosted station runs Eve directly and reuses the context lessons, rather than nesting the experimental runtime. Historical fx-backed session reports remain readable. A successful investigation does not prove its suggestions are useful: review the findings with Remi before choosing additional proposal-management controls. Later capabilities may introduce shared work orders, bounded edits and verification.

The current miner uses fixed-repository read tools backed by GitHub Connect, scoped Vercel evidence tools and a native sandbox with pinned dependencies. Its findings include actual command results and missing-context receipts. A report marked incomplete stays visibly incomplete even when it contains proposals. For a later broader GitHub tool surface, evaluate [Vercel Labs github-tools](https://github.com/vercel-labs/github-tools), including `@github-tools/eve-extension`, against the installed Eve version. The historical Evi example in the research is not a current API contract. There is no inbound GitHub webhook or automatic issue publication.

## Review together

1. Open a starter request, edit it and save. Reload and reopen it.
2. Open project knowledge. Is the distinction between observations and assumptions clear?
3. Inspect the Jira list, board and issue details. Use these to give taste and product feedback.
4. Run a mining investigation, inspect its evidence, and review whether its proposals are useful. Use findings in a draft to refine a candidate; execution remains a separate decision.

The workshop succeeds if we can show why the factory improved and whether that improvement transfers to different work.
