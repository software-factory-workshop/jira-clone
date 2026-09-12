# Task-mining experiment runner

This developer command runs fx through AI SDK Harness in a temporary Vercel Sandbox. It reads a repository snapshot and current GitHub issues/PRs through a fixed-repository host tool. It returns proposals for review. It is not the deployed Eve station or a scheduler.

From `apps/factory`, refresh the existing project's development credential:

```sh
vercel env pull .env.local --yes --scope demo-software-factory
```

From the repository root:

```sh
pnpm --filter @jira-clone/task-miner mine my-run
```

Run names cannot overwrite an existing directory. An optional prompt path and Git revision support replay:

```sh
pnpm --filter @jira-clone/task-miner mine old-context factory/mining/prompt.md 9f22e30
```

Without a revision, the snapshot includes tracked and untracked nonignored working-tree files, excluding deleted files, environment files, package archives and held-out mining evaluation/run artifacts. With a revision, source comes from that Git revision. `.mining-snapshot.json` identifies the available inputs. No Git checkout, local credentials or dependencies are copied into the sandbox. Hidden source files are included; inspect them explicitly when a glob omits them.

The runner refuses an absent, expiring or wrong-team/project OIDC token before starting a model run. The expected scope is `demo-software-factory`, project `adeo-factory-cockpit`; the model is `meta/muse-spark-1.3-contributor`. Explicit fx credentials avoid the developer's saved fx team, model and MCP configuration. The current adapter accepts the scoped OIDC bearer through its `AI_GATEWAY_API_KEY` record; this does not create a new key or use a personal account key.

GitHub Connect credentials stay on the host. The custom tool only performs GET requests for issues, pulls and issue comments in `software-factory-workshop/jira-clone`. Pagination must finish or the read fails. The model has read-only native permissions and instructions to stay within the repository. These instructions are not a formal egress allowlist. The runner only continues approval requests for its exact fixed-repository tool and validated input.

Each run records source hashes, exact prompt, document snapshot, GitHub evidence, model output, available usage, stop reason and team Gateway balances. Compare total-used before and after across a nonoverlapping experiment window; overlapping runs or unrelated team traffic prevent exact per-run cost attribution. Sandbox costs are separate. ACP native tool previews can be truncated and their names may fail adapter validation even when executed. Preserve those diagnostics instead of calling the trace complete.

A sandbox expires after five minutes. Session startup, generation and tool continuations have explicit timeouts, and continuation approval rounds are bounded. A paused, failed or GitHub-incomplete run exits unsuccessfully and is not a useful-result baseline. The adapter currently installs the current fx binary; package versions alone do not freeze that binary. Check compatibility when replaying.

Review the output with `factory/mining/evaluation.md`. It is deliberately held out from the miner along with past raw runs and comparison scores. The criteria exist even when those files are not in its snapshot; the miner should not propose creating them merely because they are withheld.
