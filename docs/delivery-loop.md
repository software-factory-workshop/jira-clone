# Build through the native Eve factory

The delivery API coordinates the existing native Eve worker, independent reviewer and original-owner revision protocol. A worker owns one branch. Contributions use another owner and a child PR. The coordinator never edits Jira or merges a PR.

Progress is driven by polling `advance`. It is not an unattended background wakeup service. Eve keeps each model session durable while the CLI or cockpit is disconnected; reconnecting advances the same saved delivery. The loop's private Blob record contains task identity, phase, operation IDs and host evidence. Cockpit drafts remain in their separate document.

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

`working` and `revising` wait for successful host `publish_work` output, then `reviewing` waits for host `record_review`. Model prose cannot advance the loop. The host rechecks current PR head and target before dispatching review and accepting its result. Changed refs block stale evidence. Blocking findings automatically return to the same owner, up to the explicitly configured `maxRevisions` (default 3); this controls repeated repair attempts, not model token budgets. Missing browser evidence yields `human_review`; `ready` is never merge authorization.

## CLI and reconnect

Supply a machine bearer token in `FACTORY_TOKEN`. It is never written to the checkpoint. The request JSON contains the title and brief; use `factory/tasks/jira-teaching-loop.md` as the assignment source.

```sh
node scripts/delivery-loop.mjs --base https://adeo-factory-cockpit.vercel.app --task /tmp/jira-task.json --state /tmp/jira-delivery.json
# Close the process, then reconnect to the same durable delivery:
node scripts/delivery-loop.mjs --state /tmp/jira-delivery.json
# Explicit same-owner follow-up after human review:
node scripts/delivery-loop.mjs --state /tmp/jira-delivery.json --revision /tmp/revision.md
```

`--once` performs one advance and exits, useful for deterministic reconnect tests. GET is observational; repeated advance calls drive the loop. A failed connection does not mean the worker stopped: reconnect using the saved ID instead of creating another task.

## Jira publication boundary

Workers may author Jira `app/`, `tests/`, `server/api/` and `server/utils/` text files. The only permitted Jira manifest change is the semantic addition of `scripts.test = "node --test tests/*.test.ts"`; dependencies, other scripts and configuration must remain identical to the trusted baseline. The development session changes this host policy; the worker authors the Jira code and manifest change. Host validation runs before candidate commands and again before publication. When Jira files change, both worker and reviewer explicitly run `pnpm --filter @jira-clone/jira test` in addition to the repository checks, so a root test command cannot silently omit Jira.

Research reused: the extracted task-dispatch block's stable request identity and payload-conflict rules; review-gate's exact-candidate evidence; Eve declared specialist isolation and custom channel continuation semantics. Source corpus: `research/walkthroughs/eve-software-factory-template.md`, `research/walkthroughs/vercel-factory.md` and `eve-software-factory-blocks/blocks/task-dispatch/README.md` in the software-factories research repository.
