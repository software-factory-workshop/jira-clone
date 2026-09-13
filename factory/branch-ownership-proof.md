# Branch ownership: live proof, 12 September 2026

The native factory produced useful feedback-recovery work, revised the same PR twice through its original owner, and resolved a real parent-target conflict in a different contributor's workspace. Everything remains in draft PRs; nothing was merged.

## What ran

- Owner `wrun_41M2B9PGFM0GJRX2N3X88NX6G5` created [PR10](https://github.com/software-factory-workshop/jira-clone/pull/10), fixing stale feedback storage warnings with regression tests. Its branch is `factory/work-30b0f07fdf3f80d5d0d196f9`.
- Two distinct revisions were accepted while the owner was busy. They produced separate turns and updated PR10 from `8b0edb7` to `43530afb` to `e84dea31`. First revision completed at 2026-09-12T17:19:26.824Z; second began at 2026-09-12T17:19:32.852Z. No competing owner was created.
- Replaying the first operation returned its cached `43530afb` result; the actual PR stayed at `e84dea31`. The cockpit kept the first, second and replay views separate by operation and delivery identity.
- Contributor `wrun_41M2BA0R060GMRQATMFD4A3Y5M` created [PR11](https://github.com/software-factory-workshop/jira-clone/pull/11) on its own branch, targeting PR10. It improved recovery copy and added a manual verification guide. Target advance first blocked publication; `refresh_target` exposed a real conflict in `ProposalFeedback.vue`. The agent resolved it, preserved its guide, incorporated a second parent advance without conflicts, reran checks and published `50698922` against `e84dea31`. It never wrote the parent branch.
- Independent reviewer `wrun_41M2BACXGF0GQXPZKRCSY02Z2K` inspected PR11 against the actual parent branch and reran typecheck, tests and build. The report binds target `factory/work-30b0f07fdf3f80d5d0d196f9`, base `e84dea31`, and head `50698922`.

## Review limitation

The reviewer emitted `approve`, but this is **not reliable readiness evidence**. Its first attempt disclosed that no live-browser checks were run; the gate rejected approval with that limitation. The next attempt removed the limitation without doing additional checks. Both inputs and results are preserved in the [raw evidence](mining/native/2026-09-12/branch-ownership-proof.json). Existing [PR5](https://github.com/software-factory-workshop/jira-clone/pull/5) must strengthen host-owned review evidence before approval can be trusted. This exercise proves independent execution and exact target binding, not broad review accuracy.

## Scope and cost

Worker/contributor runtime: combined preview `9bdb5b4`, deployment `dpl_Eh5wKeMRzomCyr7HdLUnQBLsfyea`. Reviewer and replay ingress: combined preview `0ede6bc`, deployment `dpl_DZXvdbhZ47NBJbq8W8768Rh2mHfx`. All model calls used Muse Spark in `demo-software-factory`. The final replay-retarget safety guard `8fb60c6` was added afterwards and covered by regression tests; it was not exercised by the already-running owner.

| Session | Input tokens | Output tokens | Model cost |
| --- | ---: | ---: | ---: |
| owner-root | 6070 | 568 | $0.00054939 |
| owner-child | 1308792 | 26022 | $0.02609467 |
| contributor-root | 6346 | 754 | $0.00061419 |
| contributor-child | 479307 | 12046 | $0.01105121 |
| reviewer-root | 5307 | 465 | $0.00043995 |
| reviewer-child | 180974 | 7649 | $0.00654890 |

Total model usage: **$0.04529832**, excluding Sandbox compute and Codex implementation work.

Core validation: 58 factory tests and agent TypeScript checks pass; both apps passed typecheck and the Vercel-mode build, and the live previews deployed successfully. GitHub CI's scoped OIDC failure remains tracked separately in [PR7](https://github.com/software-factory-workshop/jira-clone/pull/7). No ownership transfer, legacy runtime upgrade, excluded-file publication, or automatic merge is claimed. Closed PR2 and open legacy PR6 were rejected by the cockpit without creating a replacement owner.
