# Jira teaching rehearsal checklist (onsite)

Derived from `factory/tasks/jira-teaching-loop.md`. Delivery mechanics follow
`docs/delivery-loop.md` (factory API, CLI reconnect, same-owner revision handoff).

> Status notice: every Jira behavior below is a **required future acceptance
> check, not a currently implemented or verified capability**. The Jira app is
> still a fixture shell. Do not present any checklist item as passing until it
> is demonstrated against a reviewed worker PR with executed Jira tests and
> browser evidence.

## 1. Reset

- [ ] Seeded issues restore to their labelled fixture identities.
- [ ] Reset instructions are visible in the app or its tests.
- [ ] Reset does not destroy unrelated saved drafts outside the declared
  persistence boundary.

## 2. Edit priority

- [ ] Issue priority is editable in the UI (ADEO Nuxt UI components).
- [ ] Displayed state and saved state agree after the edit.

## 3. Assignee filtering

- [ ] Issue list filters by assignee.
- [ ] Filtering does not alter saved state.

## 4. Save and reload

- [ ] Asynchronous save path persists edits within the declared persistence
  boundary (labelled demo-only where applicable).
- [ ] After reload, displayed state matches saved state.

## 5. Deterministic failed save

- [ ] A deterministic failure mode exists for testing (not a random outage).
- [ ] Failed saves never show false success.
- [ ] The user's draft is retained after a failed save.

## 6. Draft retention

- [ ] Existing drafts survive migration-format changes (no silent overwrite).
- [ ] A retry does not duplicate execution or clobber a concurrent edit.

## 7. Delivery loop (per `docs/delivery-loop.md`)

- [ ] Assignment delivered as: explicit task -> owned worker PR ->
  independent review of the exact head and target.
- [ ] Findings returned to the **same owner** for revision, then fresh review
  (`POST /factory/delivery/:id/revise` is original-owner only).
- [ ] CLI reconnect demonstrated: close the process, reconnect with the saved
  state file to advance the same durable delivery (no duplicate task).
- [ ] At least one revision round demonstrated onsite.
- [ ] Missing evidence stops the loop (`human_review`); `ready` is never
  presented as merge authorization. Nobody merges from the workshop.

## 8. Evidence to record

- [ ] API request, accepted session IDs, source revision, agent-authored PR.
- [ ] Verification commands actually run, including
  `pnpm --filter @jira-clone/jira test` (a green root command alone is
  insufficient).
- [ ] Review head/target and browser behavior for the changed routes.
- [ ] Unfinished or missing evidence kept visible, not filled in by assertion.

> Board status-move note (worker draft, 12 Sep 2026): Kanban cards now move
> through a keyboard-first `Move to …` control with HTML5 drag-and-drop as a
> pointer enhancement. Moves save through `PATCH /api/issues/:key`, a labelled
> demo-only in-memory path that survives reload on the same server, resets on
> redeploy, and keeps the card in its original column on deterministic failure.
> Pointer-drag approval still needs trusted human browser evidence.
>
> Demo-only transition guard (worker draft, 13 Sep 2026): status moves on the
> PATCH save path follow a fixed **demo-only** matrix — To Do → In Progress →
> In Review → Done → To Do (reopen). Any other move is rejected with a
> structured demoOnly 409 naming the allowed target(s), and nothing is
> written. Authorization still runs first, so viewer writes stay 403. The
> matrix is a small explicit teaching default: it is **not verified Jira
> workflow parity and not production authorization**. No REST/MCP parity,
> Passport/OAuth, SAML, SCIM, durable accounts or full Jira permissions are
> claimed here.
