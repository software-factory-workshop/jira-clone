# Work already underway

## Worker and reviewer stations in development

On 12 September Remi requested an implementation agent that produces PRs and an independent reviewer that accepts a PR. This delivery adds those two native Eve stations to the cockpit. Task mining stays read-only; an explicit work request admits execution. Workers may publish a draft PR but cannot merge or change active factory rules. Review evidence is bound to the PR head revision.

The first selected worker assignment is `factory/tasks/proposal-usefulness.md`. Remi authorized choosing useful work autonomously for agent validation. The worker, rather than the development session, must implement this task. A resulting PR still needs review and owner acceptance. Do not rediscover this feedback task as unclaimed work during that run.

PR #1, “Expose cockpit UI capabilities through tested APIs”, was reviewed at `71ed287` and left unmerged because of an incorrect issue URL and a draft restore/save race. See `docs/pr-1-review.md`. The stations do not depend on those unmerged APIs.

Updated 12 September 2026 after the first native Eve worker published its draft PR. This supplements GitHub; an empty issue list does not imply no active work. A focused run recognized both existing candidates as pending owner review rather than new discoveries.

## Native task-mining investigation and context experiments

Owner: Codex development session, requested by Remi. The native Eve implementation is in the repository, and the final local baseline and differently worded transfer probe completed cleanly. Each passed four operational gates: successful turn, context preparation, GitHub reads and findings recording. The reports remain explicitly Incomplete for missing authenticated Vercel evidence. These operational checks do not establish proposal usefulness or owner acceptance.

The final baseline is `wrun_01M2AQ0E5CN1HVCD71RC6TPGD5` (runtime `b81899e`, inspected source `42d335c`); the transfer is `wrun_01M2AQ5JE63FYDDPFVJA17AA7Q` (runtime and source `b81899e`). Both used native Eve and Muse Spark. The context experiment narrowed initial exploration and distinguished required missing evidence from intentional exclusions. Both final reports kept intentional exclusions in reflection, with Vercel access as the blocking gap. Broad proposal quality remains unresolved: one baseline claim misclassified an old fx run as native; the transfer proposed an experiment substantially overlapping this work.

Do not propose starting this same baseline/transfer experiment, creating its runner, publishing its inventory or adding these native capabilities as new work. They exist. A specific regression, unanswered question or changed context can justify a new experiment, but first identify what would differ and what observation would settle it. Held-out artifacts being unavailable does not imply the experiment never ran.

Artifacts exist in `factory/mining/native/2026-09-12/`, intentionally excluded from mining snapshots. `docs/verification.md` records accessible dated verification and limitations. A subsequent focused structured-proposal evaluation passed six operational and identity gates using machine access; this does not replace owner usefulness judgment.

## Selected work and pending proposals

Under Remi's instruction to validate the worker with useful work and make reasonable choices while he is away, the development session selected browser-local proposal usefulness feedback. The native Eve worker published [draft PR #2](https://github.com/software-factory-workshop/jira-clone/pull/2), head `a6d6e591207918a81bc4f8f2c9e4bc7d345d3b70`, from main `65ff1fb`. Its sandbox checks and GitHub CI passed. Independent reviewer and live browser verification are still underway. Do not rediscover or implement this assignment again; inspect the PR and its current status. This assignment is not evidence of Remi's subjective usefulness judgment or merge authorization.

Defining the bounded ADEO Jira demo scope remains a candidate awaiting owner review. Do not reintroduce it as a new discovery merely because GitHub has no corresponding issue. The proposed two-prompt transfer experiment overlaps the completed development-session work above; further experimentation needs a distinct question.

## Cockpit delivery and remaining verification

The fx experiment is packaged separately. The deployed agent architecture is native Eve with its own repository sandbox, GitHub and Vercel read tools, disposable reproduction commands and typed findings recording. An earlier implementation wrapped fx in Eve; its successful hosted run does not verify the native replacement. Inspect `apps/factory/agent`, the mining components and current package layout before proposing these capabilities again.

Remi selected machine-to-machine Vercel access and individual task drafts on 12 September. The implementation now retrieves the shared `factory/jira-clone-machine` credential from Connect as the app, without viewer authorization. Live preflight read both projects' metadata, deployments and build logs successfully. Native evaluation and hosted investigation verified machine access. Runtime-log sampling remains unverified; do not carry the former per-user authorization gap forward as current configuration.

Structured proposals now have host-assigned identities and source provenance. Each has its own cockpit action opening an individual editable task draft; reflection and shared evidence remain separate. This selection does not start implementation. Hosted run `wrun_41M2ASGX7J0GQQ5XJY7ETJ54F7` verified opening and saving one proposal, then restoring both report and draft after reload. Do not propose building machine access or splitting proposal drafts again. Remaining investigation-quality observations include failure to retry logs with available deployment IDs and asserting runtime evidence is necessary without showing why. The dedicated token expires on 12 October 2026 and must be rotated before then. Current run and deployment evidence belongs in `docs/verification.md`.

Native worker and reviewer stations now exist; see `factory/work-stations.md`. Worker publication is limited to an explicitly assigned task and a draft PR. PR #1 remains open after review found a repository URL bug and a draft restoration race. No Jira feature implementation, automatic merge or factory-rule activation is underway. Candidate factory rules require owner review before activation. Check current GitHub issues and PRs for work started elsewhere; this dated record does not supersede newer evidence.

## Historical fx calibration

The earlier fx calibration, same-prompt comparisons and alternate-prompt probes are complete and retained in the experimental package and `factory/mining/`. They established useful context and access patterns, not native Eve execution or owner acceptance. The native runs above are the current delivery evidence.
