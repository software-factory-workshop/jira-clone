---
title: 'Reviewer source collector treats generated .swc as changed binary'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#84'
---

### Expected Behavior
Reviewer verification should ignore generated build output and reach a structured verdict when the candidate source is unchanged.

### Current Behavior
Nuxt builds create apps/factory/.swc/plugins/*.wasmer-v7; collectChanges enumerates that binary as a candidate edit, so verify_review and record_review fail before recording a verdict. Reproduced on PR #25 and again on the outer review of PR #26.

### Possible Solution
Ignore .swc alongside the existing generated roots (.nuxt, .output, .turbo, dist and coverage) and retain a regression test for a generated binary. Draft PR #27 contains the narrow fix.

### Minimal Reproducible Example
Run the reviewer on a PR that changes apps/factory/app, then run pnpm build in the review sandbox and call verify_review followed by record_review. Before PR #27, collection reports Non-text/large changed file: apps/factory/.swc/plugins/...wasmer-v7.

### Context
This is a repository-specific factory blocker. The reviewer must prove the exact candidate is unchanged after its own checks; generated SWC output is not candidate source. The fix is intentionally separate from Jira behavior and remains a draft for review.
