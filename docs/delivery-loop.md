# Build through the native Eve factory

The delivery API coordinates the existing native Eve worker, independent reviewer and original-owner revision protocol. A worker owns one branch. Contributions use another owner and a child PR. The coordinator never edits Jira. Its host policy may merge independently checked, narrowly defined low-risk changes.

A durable Vercel Workflow drives progress by calling the worker and reviewer root agents. Task mining is a third independent root agent. No coordinating model selects or dispatches agents. The workflow continues while the CLI or cockpit is disconnected; reconnecting observes the same saved delivery. The loop's private Blob record contains task identity, phase, operation IDs and host evidence. Cockpit drafts remain in their separate document.

## API

All routes require `factoryAuth`, including machine bearer identity or the protected Passport cockpit. This is a shared workshop workspace: another authenticated caller can resume a loop. Its original continuation address and worker ownership remain unchanged.

| Method | Route | Body |
| --- | --- | --- |
| POST | `/factory/delivery` | `{operationId,title,brief,parentPrNumber?,maxRevisions?}` |
| GET | `/factory/delivery/:id` | None |
| POST | `/factory/delivery/:id/advance` | `{}` |
| POST | `/factory/delivery/:id/cancel` | `{}` |
| POST | `/factory/delivery/:id/resume` | `{}`; retry a blocked observation with the original operation |
| POST | `/factory/delivery/:id/revise` | `{operationId,brief}`; original owner only |

Creation is idempotent for the same caller and operation ID, with conflicting payloads rejected. Revision request IDs stay recorded across subsequent reviews. CAS claims fence concurrent advances; external station starts keep stable Eve continuation keys across retries. Cancellation records intent first and requests cancellation of the parent and admitted child tasks, including a launch racing the request. A publication completed before cancellation is retained; cancellation cannot undo an existing PR.

`working` and `revising` wait for successful host `publish_work` output, then `reviewing` waits for host `record_review`. Model prose cannot advance the loop. The host rechecks current PR head and target before dispatching review and accepting its result. Changed refs yield `needs_revision` with an explicit original-owner refresh request; closed or retargeted PRs remain blocked. Blocking findings automatically return to the same owner, up to the explicitly configured `maxRevisions` (default 3); this controls repeated repair attempts, not model token budgets. After review, the host merge policy checks the exact PR head and target, independent verification, GitHub checks and changed files. Small documentation changes outside factory policy, and narrowly defined cosmetic CSS changes, may merge automatically. Missing browser evidence alone does not block these low-risk merges. Changes outside that allowlist, blocking findings, missing checks or changed revisions require human review. Agents cannot grant themselves merge authority. GitHub atomically checks the candidate SHA at merge; the target SHA is checked immediately beforehand but is not an atomic merge precondition. Main can advance in that gap. The narrow low-risk policy accepts this limitation; it is not an exact-target merge queue.

## Browser access

Each root agent mounts the official agent-browser Eve extension in its own sandbox. The miner uses it to understand current behavior, the worker exercises its changes, and the reviewer collects independent evidence against the pinned candidate. Shared configuration does not share browser cookies or sessions.

For review, `prepare_browser` starts the changed app locally from the unchanged PR snapshot. Browser tool results record the candidate and reviewer session alongside snapshots, interactions, keyboard use and screenshots. These observations establish that the reviewer used the browser; the reviewer must still assess the acceptance criteria and report failures or missing coverage.

## CLI and reconnect

Supply a Vercel OIDC machine bearer token in `FACTORY_TOKEN` (not a Vercel REST API personal token). If the deployment also requires a protection bypass, supply `FACTORY_PROTECTION_BYPASS`. It is never written to the checkpoint. The request JSON contains the title and brief; use `factory/tasks/jira-teaching-loop.md` as the assignment source.

```sh
node scripts/delivery-loop.mjs --base https://adeo-factory-cockpit.vercel.app --task /tmp/jira-task.json --state /tmp/jira-delivery.json
# Close the process, then reconnect to the same durable delivery:
node scripts/delivery-loop.mjs --state /tmp/jira-delivery.json
# Explicit same-owner follow-up after human review:
node scripts/delivery-loop.mjs --state /tmp/jira-delivery.json --revision /tmp/revision.md
```

`--once` reads the current state and exits. GET is observational; the outer workflow calls `advance` using its elected driver generation. A failed connection does not mean the worker stopped: reconnect using the saved ID instead of creating another task.

## Jira publication boundary

Workers may author Jira `app/`, `tests/`, `server/api/` and `server/utils/` text files. The host also grants one bounded integration slice: the exact `@nuxtjs/mcp-toolkit@0.21.0` and `zod@4.6.1` additions, the exact read-only registration in `apps/jira/nuxt.config.ts`, and a lockfile that preserves every existing importer, package and snapshot block while adding the required dependency closure. Other dependencies, scripts and configuration remain protected. The development session changes this host policy; the worker authors the Jira code and the narrowly specified integration files. Host validation runs before candidate commands and again before publication. When Jira files change, both worker and reviewer explicitly run `pnpm --filter @jira-clone/jira test` in addition to the repository checks, so a root test command cannot silently omit Jira.

Research reused: the extracted task-dispatch block's stable request identity and payload-conflict rules; review-gate's exact-candidate evidence; Eve independent root-agent isolation and custom channel continuation semantics. Source corpus: `research/walkthroughs/eve-software-factory-template.md`, `research/walkthroughs/vercel-factory.md` and `eve-software-factory-blocks/blocks/task-dispatch/README.md` in the software-factories research repository.

For a deployment protected by Vercel, the CLI also accepts `--vercel-cwd <linked-project-directory>`. It uses the authenticated Vercel CLI's protection bypass in scope `demo-software-factory`, while passing the Eve bearer header through stdin. The token is not placed in subprocess arguments. The checkpoint remembers this transport for reconnects.

## Recover an unpublished worker

If the original worker stopped before publication because a factory baseline check failed, fix that baseline and call `/resume` with a fresh `operationId`, or run `node scripts/delivery-loop.mjs --state /tmp/jira-delivery.json --continue`. The loop queues the same durable owner, preserves its original publication operation and pending source, and asks it to refresh the target and rerun checks. A stopped reviewer or an already published worker requires review or `/revise` instead.

Recovery records send intent before queueing. If the receipt is lost, the loop looks for the exact recovery message in the owner's durable stream and recovers its delivery ID; it does not send twice. An uncertain intent without a receipt stops for manual inspection after a minute. This deliberately leaves the rare crash-before-send case unresolved instead of guessing whether another message is safe.

The cockpit run regression fixtures live under `apps/factory/tests/fixtures/`. They are selected real event excerpts from the earlier ownership proof, so worker snapshots can execute the tests without exposing the intentionally excluded mining history.

## Reconcile a manually merged delivery

When GitHub merges a reviewed PR outside the factory (for example the
comments delivery for PR #35, whose reviewer recorded an
incomplete-but-nonblocking browser-evidence review), the saved delivery keeps
its reviewed phase — typically `human_review` with `mergeDecision.status`
`manual`. The cockpit now offers a factory-only manual-merge check on stopped
deliveries (`human_review`, `ready`, `blocked`) that already record a
publication and an independent review.

The operator copies the exact PR head SHA, target branch and optional merge
commit from the GitHub PR page into `apps/factory/app/utils/delivery-reconcile.ts`'s
`reconcileManuallyMergedDelivery` projection. It reports eligible only when
the saved phase is stopped, the recorded review is bound to the exact
published head and target, the reviewer is independent of the branch owner,
the verdict carries no blocking findings, and the supplied GitHub evidence
confirms the same PR number merged with the same head and target. Closed but
unmerged, renumbered, changed-head and retargeted PRs fail closed with the
saved delivery unchanged. Active loops, cancelled deliveries and
`needs_revision` never reconcile; child-PR targets reconcile against their
own recorded branch.

This check is read-only: it preserves review evidence, one-writer ownership,
stale-head fences and terminal history, and never merges code or bypasses
review. Marking the saved delivery `merged` still requires a separately
reviewed factory change.
