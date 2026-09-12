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

The fresh paid worker later showed Draft PR created, Open draft PR #10 at head `8b0edb7ffcdb4f1db4435d3d9445a9885d841619`, PR target main, and branch owner `wrun_41M2B9PGFM0GJRX2N3X88NX6G5`. The Stop worker action was absent after publication.

The first revision returned the same owner session, with delivery `05aa3955-9f4c-47a4-8acf-496235c90b51` and operation `85da878f-97a0-4225-bfb7-f22a30768d80`. Opening its scoped run link showed “Queued for branch owner” and “Earlier results belong to earlier work.” Neither the previous PR #10 result nor a Stop action appeared while queued.

The first delivery then showed “PR revised”, PR #10, new head `43530afb5a5172e3de3ad913e0979592b00a4dae`, and the same owner. A second distinct operation (`191427ab-82f7-4fed-8bac-9a6c5b944b1a`, delivery `8d4a88de-3420-4dfd-8316-e398bb5d129f`) initially stayed queued while the first ran, then displayed its own result at head `e84dea31d1bffa5fc8d1e0178a27325c20e20565`. The first view retained its earlier result. Completed views had no Stop action.

An identical first-operation retry received new delivery `dac8e692-cf6c-4ccf-b11c-3c79cce9379a`. The latest UI displayed the cached first result from `prepare_work` at head `43530afb5a5172e3de3ad913e0979592b00a4dae`. An independent GitHub read confirmed actual PR #10 remained open at the newer head `e84dea31d1bffa5fc8d1e0178a27325c20e20565`; the retry did not replace newer work.

The independent contributor root `wrun_41M2BA07DC0GSFTX2XCV7C28NN` displayed draft PR #11 at head `50698922fe11c71942da5c942c9c092413c5ba5e`, target `factory/work-30b0f07fdf3f80d5d0d196f9` / parent PR #10, and distinct owner `wrun_41M2BA0R060GMRQATMFD4A3Y5M`. GitHub independently confirmed PR #11 is open on its own branch `factory/work-82167597f545ef1760c14d9d` targeting the parent branch. The completed view had no Stop action.

The runtime validator launched the paid operations through the real station API; browser verification attached their existing deliveries without duplicating them. Independent reviewer rendering is pending its live run.

## Contributor target advance

The native runtime validator captured the contributor’s publication sequence. Its first `publish_work` failed with “Target advanced; call refresh_target to preserve and merge your work before rechecking.” The first `refresh_target` reached target `43530afb5a5172e3de3ad913e0979592b00a4dae` and reported a real conflict in `apps/factory/app/components/ProposalFeedback.vue`. The worker read and resolved conflict markers, then reverified.

The parent advanced again. A second `refresh_target` reached `e84dea31d1bffa5fc8d1e0178a27325c20e20565` without conflicts, preserving the contributor’s copy edits and `docs/feedback-storage-recovery.md`. After `verify_work` passed, publication created PR #11 at `50698922fe11c71942da5c942c9c092413c5ba5e` against the updated parent target. This sequence is runtime trace evidence from the native validator; the browser independently confirmed the final PR, owner and target listed above.

## Visual correction

The first result screenshot exposed a scoped anchor style overriding Nuxt UI’s button text color: the accessible “Open draft PR” link looked blank because its text and background were both teal. The UI branch now limits that styling to ordinary links. A real screenshot on commit `0ede6bcf8518618778f47126be876581968ff2ec`, deployment `dpl_DZXvdbhZ47NBJbq8W8768Rh2mHfx`, confirmed readable white text on the teal Open PR #10 button. That [immutable preview](https://adeo-factory-cockpit-ic2c82p7g-demo-software-factory.vercel.app) also replayed the earlier revision correctly. This combined tree passed typecheck, build and 64 factory tests. The result route had no captured browser warnings or errors.
