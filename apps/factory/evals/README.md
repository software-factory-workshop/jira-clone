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
host-accepted verdict. It also requires the final `record_review` result to
report a successful or deduplicated GitHub `COMMENT` review publication. A
factory-owned PR can additionally be started automatically by the native
GitHub channel on `opened`, `reopened`, `ready_for_review`, or `synchronize`;
the channel ignores PRs without the factory owner marker.

The visual publication path is intentionally explicit in the reviewer probe:
the PR body receives the replaceable `## Visual review` section when browser
surfaces changed, while GitHub receives a visible non-approval review tied to
the exact candidate head. If a reviewer session stops before `record_review`,
the host writes an incomplete packet and non-approval review so the PR and
Cockpit still show why approval is unavailable.

Visual frame publication requires two storage bindings in every deployed
environment: `BLOB_READ_WRITE_TOKEN` for private Cockpit and delivery records,
and `VISUAL_REVIEW_READ_WRITE_TOKEN` for a dedicated public Vercel Blob store.
The second store must remain separate from Cockpit and must return
`*.public.blob.vercel-storage.com` URLs; without it, new frame publication
fails closed instead of emitting a GitHub image URL that Deployment Protection
will hide.

The worker probe defaults to the `worker` station and requires the operation
UUID from the original owner session.

Provider-failure injection and Agent Run API normalization are deliberately
left as target-specific follow-ups: they need a controllable fault fixture or
the Vercel control-plane adapter, not a model-only assertion.
