# Jira teaching slice: editable priority, assignee filter, save path

Demo-only teaching state. Not Jira API parity, not real permissions, not
production persistence.

## What was added

- Editable issue priority from the issue list (`USelect` per row) and from the
  issue detail slideover (draft + Save priority).
- Assignee filter on the issue list alongside the existing status filter.
- Async save path:
  - `GET /api/issues` reads the demo store.
  - `PATCH /api/issues/:key` saves `{ "priority" }`.
  - `POST /api/issues-reset` restores the seeded fixtures.

## Persistence boundary

Edits live in module-level in-memory state on the Nitro server
(`apps/jira/server/utils/issue-store.ts`), seeded from the synthetic fixtures
in `@jira-clone/context`. Reloading the page keeps saved changes because the
UI reloads from `GET /api/issues`. Restarting the dev/build server clears all
edits back to the seed.

## Forcing a save failure

- UI: enable “Simulate save failure”, then change a priority. The save shows
  the error, displayed rows stay unchanged, and the detail draft stays
  visible with your attempted value.
- API/tests: `PATCH /api/issues/ADEO-1` with `{ "priority": "High",
  "failSave": true }` returns a deterministic 500 and stores nothing.

## Reset

- Click “Reset demo data” in the issue list header, or
  `curl -X POST http://localhost:3001/api/issues-reset`.
- Restarting the server has the same effect.

## Tests

- `pnpm --filter @jira-clone/jira test` runs `apps/jira/tests/*.test.ts`:
  store save/reload agreement, deterministic failure, unknown-value status
  codes, reset, assignee filtering, and failed-save draft handling.
