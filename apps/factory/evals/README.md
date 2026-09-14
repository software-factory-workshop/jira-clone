# Factory Eve evals

These evals turn the cockpit and Vercel Agent Runs observations into executable
checks for the factory's native Eve agents.

Run discovery from `apps/factory` against the factory root URL:

```sh
pnpm exec eve eval --url <factory-root-url> --list --json
pnpm exec eve eval --url <factory-root-url> --tag fast --strict
```

The root URL must identify the factory target (`@jira-clone/factory`). A
task-miner-only endpoint is a different Eve target; the remote CLI does not
combine `--agent` with `--url`.

The default evals spend model calls and cover:

- mining protocol, bounded investigation, structured receipts, scope, and
  missing-evidence honesty;
- completed-turn/session settlement; and
- existing structured-proposal provenance.

The following integration probes are opt-in because they perform real station
work or cancellation:

```sh
FACTORY_RUN_REVIEWER_GATE_EVAL=1 \
FACTORY_REVIEW_GATE_PR=<open-pr-number> \
pnpm exec eve eval reviewer-host-gate --url <factory-root-url> --strict

FACTORY_RUN_WORKER_REVISION_EVAL=1 \
FACTORY_WORKER_REVISION_OPERATION_ID=<owner-operation-uuid> \
FACTORY_WORKER_REVISION_PR=<owned-pr-number> \
FACTORY_WORKER_REVISION_BRIEF='Apply one bounded revision and rerun focused verification.' \
pnpm exec eve eval worker-revision-continuity --url <factory-root-url> --strict

FACTORY_RUN_SESSION_CANCELLATION_EVAL=1 \
pnpm exec eve eval session-cancellation --url <factory-root-url> --strict
```

The reviewer probe defaults to `changes_requested`; set
`FACTORY_REVIEW_GATE_EXPECTED_VERDICT` when the fixture should produce another
host-accepted verdict. The worker probe defaults to the `worker` station and
requires the operation UUID from the original owner session.

Provider-failure injection and Agent Run API normalization are deliberately
left as target-specific follow-ups: they need a controllable fault fixture or
the Vercel control-plane adapter, not a model-only assertion.
