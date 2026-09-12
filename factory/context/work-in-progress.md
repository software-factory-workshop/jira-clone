# Work already underway

Updated 12 September 2026 after the native Eve baseline and transfer runs. This supplements GitHub; an empty issue list does not imply no active work. This status correction has not itself been validated by another mining run.

## Native task-mining investigation and context experiments

Owner: Codex development session, requested by Remi. The native Eve implementation is in the repository, and the final local baseline and differently worded transfer probe completed cleanly. Each passed four operational gates: successful turn, context preparation, GitHub reads and findings recording. The reports remain explicitly Incomplete for missing authenticated Vercel evidence. These operational checks do not establish proposal usefulness or owner acceptance.

The final baseline is `wrun_01M2AQ0E5CN1HVCD71RC6TPGD5` (runtime `b81899e`, inspected source `42d335c`); the transfer is `wrun_01M2AQ5JE63FYDDPFVJA17AA7Q` (runtime and source `b81899e`). Both used native Eve and Muse Spark. The context experiment narrowed initial exploration and distinguished required missing evidence from intentional exclusions. Both final reports kept intentional exclusions in reflection, with Vercel access as the blocking gap. Broad proposal quality remains unresolved: one baseline claim misclassified an old fx run as native; the transfer proposed an experiment substantially overlapping this work.

Do not propose starting this same baseline/transfer experiment, creating its runner, publishing its inventory or adding these native capabilities as new work. They exist. A specific regression, unanswered question or changed context can justify a new experiment, but first identify what would differ and what observation would settle it. Held-out artifacts being unavailable does not imply the experiment never ran.

Artifacts exist in `factory/mining/native/2026-09-12/`, intentionally excluded from mining snapshots. `docs/verification.md` records accessible dated verification and limitations. No further paid probes are currently planned in this delivery.

## Proposals awaiting Remi's review

The following are existing candidate proposals, not accepted work or novel discoveries:

- Capture browser-local usefulness feedback on mining proposals.
- Define the bounded ADEO Jira demo scope for the workshop.

Remi has not accepted either proposal. Do not implement them or reintroduce them as newly discovered tasks merely because GitHub has no corresponding issue. If they are still the best next step, explain that owner review is pending. The proposed two-prompt transfer experiment overlaps the completed development-session work above; further experimentation needs a distinct question.

## Cockpit delivery and remaining verification

The fx experiment is packaged separately. The deployed agent architecture is native Eve with its own repository sandbox, GitHub and Vercel read tools, disposable reproduction commands and typed findings recording. An earlier implementation wrapped fx in Eve; its successful hosted run does not verify the native replacement. Inspect `apps/factory/agent`, the mining components and current package layout before proposing these capabilities again.

Remi selected machine-to-machine Vercel access and individual task drafts on 12 September. The implementation now retrieves the shared `factory/jira-clone-machine` credential from Connect as the app, without viewer authorization. Live preflight read both projects' metadata, deployments and build logs successfully. Runtime-log sampling and the new hosted flow still need verification; do not carry the former per-user authorization gap forward as current configuration.

Structured proposals now have host-assigned identities and source provenance. Each has its own cockpit action opening an individual editable task draft; reflection and shared evidence remain separate. This selection does not start implementation. Verification of this delivery is underway, so do not propose building machine access or splitting proposal drafts again. The dedicated token expires on 12 October 2026 and must be rotated before then. Current run and deployment evidence belongs in `docs/verification.md`.

No Jira feature implementation, automatic issue publication or factory-rule activation is underway. Proposed tasks and candidate factory rules require owner review before activation. Check current GitHub issues and PRs for work started elsewhere; this dated record does not supersede newer evidence.

## Historical fx calibration

The earlier fx calibration, same-prompt comparisons and alternate-prompt probes are complete and retained in the experimental package and `factory/mining/`. They established useful context and access patterns, not native Eve execution or owner acceptance. The native runs above are the current delivery evidence.
