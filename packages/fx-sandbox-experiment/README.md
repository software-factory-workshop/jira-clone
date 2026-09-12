# fx in Vercel Sandbox: context experiment

This developer command runs fx through AI SDK Harness in a temporary Vercel Sandbox. It reads a repository snapshot and current GitHub issues/PRs through a fixed-repository host tool. It returns proposals for review. The deployed station uses native Eve. This package is a developer experiment and is not imported by the cockpit.

From `apps/factory`, refresh the existing project's development credential:

```sh
vercel env pull .env.local --yes --scope demo-software-factory
```

From the repository root:

```sh
pnpm mine:fx my-run
```

Run names cannot overwrite an existing directory. An optional prompt path and Git revision support replay:

```sh
pnpm --filter @jira-clone/fx-sandbox-experiment mine old-context factory/mining/prompt.md 9f22e30
```

Without a revision, the snapshot includes tracked and untracked nonignored working-tree files, limited to source/document extensions and excluding deleted files, environment files, the lockfile, package archives and held-out mining evaluation/run artifacts. With a revision, source comes from that Git revision. `.mining-snapshot.json` identifies the available inputs. No Git checkout, local credentials or dependencies are copied into the sandbox. Hidden source files are included; inspect them explicitly when a glob omits them.

The runner refuses an absent, expiring or wrong-team/project OIDC token before starting a model run. The expected scope is `demo-software-factory`, project `adeo-factory-cockpit`; the model is `meta/muse-spark-1.3-contributor`. Explicit fx credentials avoid the developer's saved fx team, model and MCP configuration. The current adapter accepts the scoped OIDC bearer through its `AI_GATEWAY_API_KEY` record; this does not create a new key or use a personal account key.

GitHub Connect credentials stay on the host. The custom tool only performs GET requests for issues, pulls and issue comments in `software-factory-workshop/jira-clone`. Pagination must finish or the read fails. The model has read-only native permissions and instructions to stay within the repository. These instructions are not a formal egress allowlist. The runner only continues approval requests for its exact fixed-repository tool and validated input.

Each run records source hashes, exact prompt, document snapshot, GitHub evidence, model output, available usage, stop reason and team Gateway balances. Compare total-used before and after across a nonoverlapping experiment window; overlapping runs or unrelated team traffic prevent exact per-run cost attribution. Sandbox costs are separate. ACP native tool previews can be truncated and their names may fail adapter validation even when executed. Preserve those diagnostics instead of calling the trace complete.

A sandbox expires after five minutes. A shared deadline bounds startup, generation and tool continuations, and continuation approval rounds are bounded. A paused, failed or GitHub-incomplete run exits unsuccessfully and is not a useful-result baseline. The adapter currently installs the current fx binary; package versions alone do not freeze that binary. Check compatibility when replaying.

Review the output with `factory/mining/evaluation.md`. It is deliberately held out from the miner along with past raw runs and comparison scores. The criteria exist even when those files are not in its snapshot; the miner should not propose creating them merely because they are withheld.

## What transfers to native Eve

The [dated experiment report](../../factory/mining/report.md) records the context changes and their evidence. The final original and alternate prompts used identical 50-file manifests. Both recognized active work and found a useful leading proposal, according to Codex review. Remi's acceptance is still distinct from that review.

Transfer the goal, project map, current-work record, explicit exclusions and evidence requirements into native Eve. Keep GitHub failures visible and check both issue and PR inventories. The original experiment showed why an empty backlog cannot describe all active work and why hidden evaluation files must be identified as excluded.

The experiment did not install dependencies or provide a buildable checkout. It excluded the lockfile and package archives. It did not establish reproducible tests, Vercel deployment/log access or native Eve behavior. Those need separate preflight and run evidence in the native station.

## Preserved integration lesson

The earlier Eve wrapper bundled this fx runtime into Nitro. ACP then looked for four bridge bootstrap files relative to its relocated module. Nitro omitted those files, and a glob-based repair missed a second copy under `.well-known/workflow`. The eventual workaround recursively copied the exact installed files beside both relocated modules and checked byte equality.

[The historical build script](history/build-eve-with-fx.mjs.txt) preserves that workaround from the former cockpit integration. Its `.txt` extension makes it reference material, not a build command. Its original package paths describe that historical layout. The native Eve station has no ACP packaging requirement. The standalone experiment uses the installed adapter directly and does not need this workaround.

## Checks without inference

```sh
pnpm --filter @jira-clone/fx-sandbox-experiment test
node --check packages/fx-sandbox-experiment/run.mjs
node --check packages/fx-sandbox-experiment/runtime.mjs
```

A new paid run should answer a named question about context or access. Keep each run under its own name in `factory/mining/runs/`; the package move does not change those paths or rewrite prior evidence.
