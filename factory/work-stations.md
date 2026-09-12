# Worker and reviewer stations

These are two explicit native Eve jobs. A worker takes an assigned task and returns a draft pull request. A reviewer takes a pull request number and returns an independent review tied to its exact base and head commits. Starting one does not schedule the other or authorize merging.

Task mining remains read-only. A station is selected by an authenticated server route, not by text in a mining prompt. Declared worker and reviewer subagents have their own instructions, tools, state and Sandboxes. Their availability is conditional on the server-assigned station; write tools must enforce that assignment at execution as well.

## Reuse the context, separate the authority

Both jobs reuse the current goal, source map, active work, ADEO guidance and pinned dependency setup. The worker starts from a pinned `main` commit. The reviewer gets independently fetched base and head snapshots, the GitHub file inventory and the original task. The worker's summary is evidence to check, not the review's authority.

Review instructions and applicable repository policy come from the base snapshot. Candidate changes to `AGENTS.md`, factory instructions, tests or other policy cannot replace the rules judging the candidate. The reviewer inspects actual changes and reruns focused checks. If an excluded or unsupported file prevents a complete comparison, the result must identify that gap.

Eve 0.52.5's declared subagents support separate authored tool sets and Sandboxes; the built-in `agent` copies the root and shares its Sandbox. We use the declared-specialist boundary. No generic orchestration graph, webhook scheduler, automatic revision loop or additional model framework is needed for these two jobs.

## Host publication

The Sandbox has no GitHub credential. The host reads bounded changed text files, verifies the assigned task and checks, then obtains the existing app-scoped `github/jira-clone` Connect token. The publisher can create Git tree and commit objects, one feature branch and a draft PR in `software-factory-workshop/jira-clone`. There is no generic URL, repository, Git command or branch argument supplied by the model.

The branch is `factory/work-<session hash>`. A retry reuses a branch only when its tree, parent and host-written session marker match the same publication. A different head fails. The publisher does not update existing refs, force push, write `main`, merge or submit a GitHub approval. If `main` advances before the initial publication, the worker must start from a fresh snapshot.

The initial publication allowlist is `apps/factory/app/`, `apps/factory/tests/`, `apps/jira/app/`, `apps/jira/tests/` and `docs/`. Root files, packages and other directories cannot be published by this station. Within those roots, the limit is 30 text files, 500 KB per file and 2 MB total. Existing executable modes are preserved; new files are ordinary files. Symlinks, submodules, directory replacement and traversal fail. Credentials, generated output, evaluation artifacts, the fx experiment, factory/agent policy, workflow files, dependency manifests, verifier configuration and server/module routing are protected in this first station. Checks must reject changes to those protected files before executing candidate code, not merely omit them from the final PR. Expanding that boundary is a separate reviewed factory change.

A reviewer receives no publication tool. Its final report rechecks the PR head and base so a changed candidate requires another review. A review verdict is an assessment, not a merge authorization. Model quality, hosted behavior and GitHub app write permissions require real-run evidence beyond the helper's fixture tests.

## Source decisions

The following source revisions were inspected locally on 12 September 2026:

- [Foreman implementer](https://github.com/vercel-labs/eve-software-factory-template/blob/0d630a284b84e5be38fe7eceec7b231a7e79bfd0/agent/subagents/implementer/agent.ts#L4-L14) separates feature-branch publication from merge. Its [reviewer instructions](https://github.com/vercel-labs/eve-software-factory-template/blob/0d630a284b84e5be38fe7eceec7b231a7e79bfd0/agent/subagents/reviewer/instructions.md#L3-L19) require a fresh review of the real diff and individual acceptance criteria. We reuse those boundaries without its full pipeline.
- [GitHub Factory worker](https://github.com/vercel-labs/github-factory/blob/bc7c71f068868dabe07282e529bb334a60eb06f9/factory/tasks/improve-repository/task.ts#L50-L62) publishes after model execution in trusted task code. Its [review prompt](https://github.com/vercel-labs/github-factory/blob/bc7c71f068868dabe07282e529bb334a60eb06f9/packages/gh-factory/registry/review-pull-request/task.ts#L109-L130) separates base-commit policy from untrusted PR metadata. These are the publication and review-context patterns used here.
- [AI SDK Factory policy resolver](https://github.com/vercel-labs/ai-sdk-factory/blob/bba06132dc0b73217566368938f31a885016ff37/packages/definitions/src/resolve-github-task-policy.ts#L4-L21) treats execution permissions as a host-resolved grant. We keep that principle while retaining Eve's existing runtime.

The installed Eve documentation is the API authority: `docs/subagents/index.mdx` lines 65–91 describes conditional availability, and lines 137–158 describes declared-subagent isolation. `docs/channels/custom.mdx` lines 18–49 shows channel sends and stream attachment. These examples require application authentication and station-binding checks; their sample `auth: null` is not the cockpit's authorization policy.
