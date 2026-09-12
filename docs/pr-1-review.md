# PR 1 review

Reviewed 12 September 2026 at head `71ed287d9f2612d17289ffeaa3544e2fb7be5058`. Decision: leave open and skip the merge, following Remi's instruction to skip if the review finds blockers.

- `apps/factory/server/utils/cockpit-api.ts:128`: `new URL("/issues/new", repository.url)` produces `https://github.com/issues/new` and drops the repository path. The issue-link API therefore cannot open an issue in the intended repository.
- `apps/factory/app/app.vue:49-51`: a delayed mount-time restore response replaces a newer successful save and writes that stale collection to local storage. Saving before restoration also sends an empty draft collection. A deferred-response reproduction using the actual restore/save function source confirmed the new draft was lost and storage contained only the previous draft.

The seven API tests passed but did not cover those cases. The branch also conflicts with current main in `MiningRun.vue`. No fix, rebase or merge was performed. These findings are independent of the new worker/reviewer station delivery.
