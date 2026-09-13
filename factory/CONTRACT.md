# Factory contract

Rules that the host enforces and that every station may read. Present tense
only. Anything dated, historical or aspirational belongs in `factory/evidence/`
(withheld from agent snapshots) or in comments next to the code that enforces it.

## Stations

Three independent Eve root agents: task-miner, worker, reviewer. Each has its own
instructions, tools, sandbox and durable session. A deterministic Vercel Workflow
calls them; no model dispatches another agent. Station identity is immutable
request auth, checked before a model is selected and again inside every
sensitive tool. A tool that is not attached to your station does not exist.

- Task-miner reads a pinned snapshot, GitHub and Vercel evidence, runs local
  probes, and records at most three ranked proposals. It publishes nothing.
- Worker implements one authenticated task in its own sandbox and publishes one
  draft PR through a host tool. It never merges.
- Reviewer inspects the exact PR base and head in separate snapshots, reruns
  checks, captures browser evidence, and records one verdict bound to those
  SHAs. It has no publication or merge tool.

## Snapshot

The workspace is an exported snapshot of `main` (or of a PR head), not a Git
checkout. `/workspace/repo/.mining-snapshot.json` lists the revision, every
included file with its hash, the excluded paths, and `activeWork` (open PRs and
non-terminal deliveries). Excluded paths exist but are withheld on purpose:
treat them as unavailable evidence, never as missing work to create. There is
no commit history or CI log in the snapshot; the GitHub tool returns issues,
pull requests and comments only. Vercel deployment protection (Passport) is a
platform login and says nothing about the Jira application's own roles.

## Branch ownership

At most one durable worker session owns write access to a branch. The branch is
`factory/work-<session hash>` and its PR is a draft. A revision continues the
same owner; an idle or expired owner never transfers ownership silently. A
different contributor gets its own branch and a child PR targeting the parent
branch. If the target advances, `refresh_target` three-way merges into the
owner's workspace, exposes conflicts there, and blocks conflicts in protected
files. Publication uses `force: false` with an expected head; replays return the
recorded result instead of a second commit.

## Publication boundary

The sandbox holds no credentials. The host verifies the assigned task and the
recorded checks, then publishes bounded text files through the Git Data API:
`apps/factory/app/`, `apps/factory/tests/`, `apps/jira/app/`, `apps/jira/tests/`,
`apps/jira/server/api/`, `apps/jira/server/utils/` and `docs/`, at most 30 files,
500 KB per file, 2 MB total. Agent instructions, policies, workflows, dependency
manifests, lockfiles, routing and verifier configuration are protected, with
one exception: the exact Jira MCP integration delta validated by host code.
Widening any of this is a reviewed change made outside a run.

## Evidence and review

Required checks are `pnpm typecheck`, `pnpm test`, `pnpm build`, plus the Jira
test command when Jira files change. The worker's `verify_work` binds results to
a digest of the changed files; `publish_work` refuses if the digest moved. The
reviewer's required evidence is derived by the host from the changed-file
inventory: any change under a browser-facing app root needs real browser
interaction and keyboard evidence captured by the host hook on the exact head.
An `approve` verdict with an open blocker is rejected; wording cannot remove a
requirement. Review policy comes from the PR base, so a candidate cannot change
the rules judging it. A verdict is an assessment.
Stations cannot merge PRs or activate factory policy.
The host delivery driver may perform only the documented narrow low-risk merge
(a cosmetic CSS change with independent approval and green CI);
broad or elevated merges remain human-controlled on GitHub.

## Authorization

Cedar guards `run_check`, `record_verification`, `record_review`,
`publish_change` and `merge_change`. Entities are built by the host from session
auth and stored state. A model-supplied principal, verdict or SHA is never
authoritative. Every decision is audited with its policy revision.

## Limits

Sandbox: 4 vCPU, 10 minute expiry, stopped when the turn completes or is
cancelled. Vercel reads: GET only, two fixed projects, 20 deployments, 100 build
events, runtime sample bounded to 10 s or 100 records; each receipt states its
coverage. GitHub reads: bounded pagination, closed items included, a failed read
is unavailable evidence, not an empty backlog. Model token and cost limits are
disabled per session; `maxRevisions` (default 3) bounds repair rounds.

## Research these rules come from

- Foreman implementer and reviewer, `vercel-labs/eve-software-factory-template`
  at `0d630a28`: publication separated from merge; fresh review of the real diff
  against individual acceptance criteria.
- GitHub Factory, `vercel-labs/github-factory` at `bc7c71f0`: publish from
  trusted task code after the model finishes; base-commit policy separated from
  untrusted PR metadata.
- AI SDK Factory, `vercel-labs/ai-sdk-factory` at `bba06132`: execution
  permissions are a host-resolved grant.
- Academy investigator, `academy-software-factory` at `e863458a`: a reported
  premise is not a reproduced behavior; evidence travels into review.
- Cedar factory application notes: an authorization kernel around consequential
  actions, not a workflow engine.
