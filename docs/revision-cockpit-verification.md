# Revision cockpit verification

The UI child PR is [#8](https://github.com/software-factory-workshop/jira-clone/pull/8), targeting `codex/branch-owned-revisions`. Its owner updates only `codex/revision-cockpit`; no GitHub PR was merged during this verification.

## Combined preview

Commit `9bdb5b4cf95d7064b9a35eab02ea6c99efe51b94` combines the UI with core `98c05b1`. Vercel reported deployment `dpl_Eh5wKeMRzomCyr7HdLUnQBLsfyea` ready at [the immutable preview](https://adeo-factory-cockpit-fo79156i2-demo-software-factory.vercel.app). Repository typecheck, tests and build passed; the final core sync passed 62 factory tests.

GitHub's separate deployment-output check lacks the sandbox-template OIDC credential. That known CI issue is handled by independent PR #7; it was not copied into this UI branch.

## Browser checks

Observed through the real authenticated preview, with no mocked station responses:

- The work selector exposes Create work, Revise existing PR · same owner, and Contribute via child PR · new owner. Revision requires a brief and PR, without requiring a new title.
- A revision submitted for merged PR #2 showed Station not started. The closed-PR guard rejected it before owner dispatch.
- A revision submitted for open legacy PR #6 showed: “The existing branch owner is unavailable. No replacement took control. You can explicitly choose a separate child PR instead.” The route rejected the old protocol before sending to the owner; no replacement worker or generic steer was requested.
- The existing paid worker root `wrun_41M2B9P85E0GRBGJCR8Z257Z3A` connected and displayed its child’s Running / read file progress. Browser observation did not launch a second worker.

Same-owner publication, identical-operation replay and child contribution browser results are pending the live runs. Their API and UI coverage must not be inferred from local tests.
