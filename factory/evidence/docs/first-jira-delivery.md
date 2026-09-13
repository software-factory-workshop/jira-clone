# First Jira delivery through the factory loop

Recorded 12 September 2026 by the development session. No Jira source was edited by hand; the worker authored every product change. Nothing here is merge authorization.

## Run

| Item | Value |
| --- | --- |
| Assignment | `factory/tasks/jira-teaching-loop.md`, first useful worker assignment, `maxRevisions: 2` |
| Delivery | `c5385d94f98e87f0d118c7de089efdbf1fa87fdb3beada3a523b5506ba89e550` |
| Request operation | `a0e09f2a-7892-4e8e-8f1b-0bbbcec70bca` |
| Loop root session | `wrun_41M2BEFHVZ0GTYD6GS27NDJA7S` |
| Worker owner | `wrun_41M2BEFVG50GZ6M3WRV696DMP6` on `factory/work-fccc1408e5135acbe28e96ea` |
| Reviewer | root `wrun_41M2BF87QP0GKARXMJE4E60RB2`, child `wrun_41M2BF8FGH0GYZAQDYFN8YED9H` |
| Publication | draft PR #18, head `15c0bdaf18ff53a72bb8b1308fefc22d1e8438df`, target `main` at `2f62e8a08dd2f93509d7d0ca2af39d24339287f6` |
| Result | `human_review`, verdict `incomplete`: browser and keyboard evidence required for browser-facing changes |

Phase history: `worker_starting` 18:36:07Z, `working` 18:42:43Z, `human_review` 18:47:28Z, `owner_resuming` 18:47:30Z, `working` 18:49:28Z, `review_starting` 18:49:36Z, `reviewing` 18:51:41Z, then `human_review`.

## What happened

The worker snapshot was pinned to `4b326ca`. It implemented the slice, passed typecheck, build and the eight Jira tests, then `verify_work` failed on root `pnpm test`: `apps/factory/tests/cockpit-run.test.ts` read `factory/mining/native/...`, which the snapshot excludes by design. The worker refused to touch protected files, reported the blocker and stopped. The loop recorded `human_review` with "Agent stopped without a trusted result".

PR #16 moved those fixtures under `apps/factory/tests/fixtures/` and added owner recovery. After main deployed, `node scripts/delivery-loop.mjs --state … --continue` queued the same owner. It refreshed the target, reran checks and published PR #18. The reviewer ran `verify_review` on the exact head, found no scope or correctness problems, and returned `incomplete` because this station cannot produce browser evidence. That stop is the intended gate, not a defect.

The CLI process was stopped and restarted three times between advances. Each restart reconnected to the same delivery ID; no second worker or PR was created.

## Worker output

PR #18 changes eleven files under `apps/jira/app`, `apps/jira/server/api`, `apps/jira/server/utils`, `apps/jira/tests`, `docs/`, plus the single permitted manifest script. It adds a labelled in-memory issue store seeded from fixtures, PATCH and reset routes, a deterministic `failSave` hook, editable priority in list and detail, an assignee filter, draft retention on failed saves and reset instructions. Preview: https://adeo-jira-clone-git-factory-work-f-b16928-demo-software-factory.vercel.app. Vercel statuses for the head succeeded. Browser behavior has not been verified by a person yet.

Recorded worker model cost for the final step was under one cent; Sandbox compute is billed separately.

## Transport note

From this development machine, `scripts/delivery-loop.mjs --vercel-cwd` was killed with `SIGKILL` on every `POST` through `vercel curl` 59.4.0, while `GET` succeeded. The plain-fetch path with `FACTORY_PROTECTION_BYPASS` worked for the whole run. Prefer that path for unattended use until the CLI transport is diagnosed. No credential was written to the checkpoint.

## Next

1. A person opens the preview, exercises priority edit, assignee filter, save, reload, forced failure and reset, and records the result on PR #18.
2. If findings appear, send them with `--revision` to the same owner; do not edit the branch by hand.
3. Merge PR #18 only after that review. Then assign comment permissions as the next teaching task.
