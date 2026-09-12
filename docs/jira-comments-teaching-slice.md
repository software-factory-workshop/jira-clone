# Jira comments teaching slice (demo-only)

Issue comments are the next small stateful slice after the board status save path.

- API: `GET /api/issues/:key/comments` lists demo comments per issue key;
  `POST /api/issues/:key/comments` with `{ "body": "..." }` adds one.
  `{ "fail": true }` takes the deterministic failure path and saves nothing.
- Store: `apps/jira/server/utils/issues.ts` keeps an in-memory per-key comment
  list on top of the labelled synthetic fixtures. Comments survive reload
  against the same running server and reset via `POST /api/issues/reset` or on
  redeploy. All comments use the single labelled fixture identity
  ("Demo member").
- UI: the issue detail panel shows the comment list, a `UTextarea` draft box,
  and an "Add comment" `UButton` (Lucide icons, keyboard operable). A failed
  save shows an error, keeps the draft, and never shows false success.
- No Jira API parity, real permissions, or production persistence is claimed.
