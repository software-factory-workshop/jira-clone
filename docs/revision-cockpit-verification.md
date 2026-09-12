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

The fresh paid worker later showed Draft PR created, Open draft PR #10, PR target main, and branch owner `wrun_41M2B9PGFM0GJRX2N3X88NX6G5`. The Stop worker action was absent after publication.

The first revision returned the same owner session, with delivery `05aa3955-9f4c-47a4-8acf-496235c90b51` and operation `85da878f-97a0-4225-bfb7-f22a30768d80`. Opening its scoped run link showed “Queued for branch owner” and “Earlier results belong to earlier work.” Neither the previous PR #10 result nor a Stop action appeared while queued.

Same-owner revised publication, identical-operation replay and child contribution browser results are pending the live runs. Their API and UI coverage must not be inferred from local tests.

## Visual correction

The first result screenshot exposed a scoped anchor style overriding Nuxt UI’s button text color: the accessible “Open draft PR” link looked blank because its text and background were both teal. The UI branch now limits that styling to ordinary links. Its deployed visual recheck is pending. The result route had no captured browser warnings or errors.
