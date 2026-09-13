# Jira teaching rehearsal checklist (onsite)

Derived from `factory/tasks/jira-teaching-loop.md`. Delivery mechanics follow
`docs/delivery-loop.md` (factory API, CLI reconnect, same-owner revision handoff).

> Current status, 13 September 2026: reset, priority editing, assignee
> filtering, save/reload, deterministic failed saves, per-issue draft
> retention and Neon-backed issue/comment persistence are implemented in the
> demo-only Jira app and covered by local tests. The checks below record the
> onsite and browser evidence still to collect. They do not claim that a
> hosted Neon URL, hosted aliases or external identity configuration has been
> verified.

## 1. Reset

- Implemented locally: reset restores labelled fixtures and clears demo-created
  and overridden issue/comment state in either persistence mode.
- [ ] Rehearsal: demonstrate reset and record the declared persistence boundary.
- [ ] Rehearsal: confirm reset does not destroy unrelated browser-local drafts.

## 2. Edit priority

- Implemented locally: priority is editable through the ADEO Nuxt UI and the
  native save path.
- [ ] Rehearsal: show the displayed value and the canonical read agreeing after
  an edit and reload.

## 3. Assignee filtering

- Implemented locally: the issue list filters by assignee and composes with
  search and status.
- [ ] Rehearsal: show filtering without changing saved issue state.

## 4. Save and reload

- Implemented locally: the asynchronous demo-only save path uses Neon when
  `DATABASE_URL` is set and the labelled in-memory fallback otherwise.
- [ ] Rehearsal: reload the page and show the displayed state matches the
  canonical saved state.

## 5. Deterministic failed save

- Implemented locally: `{fail:true}` produces a deterministic no-write failure,
  leaves the original value in place and retains the draft.
- [ ] Rehearsal: trigger the failure and record the error, unchanged value and
  retained draft.

## 6. Draft retention

- Implemented locally: per-issue drafts survive close/reopen and storage
  failures without being silently cleared.
- [ ] Rehearsal: exercise migration-format compatibility and concurrent retry
  behavior before treating those cases as accepted.

## 7. Delivery loop (per `docs/delivery-loop.md`)

- [ ] Assignment delivered as: explicit task -> owned worker PR ->
  independent review of the exact head and target.
- [ ] Findings returned to the **same owner** for revision, then fresh review
  (`POST /factory/delivery/:id/revise` is original-owner only).
- [ ] CLI reconnect demonstrated: close the process, reconnect with the saved
  state file to advance the same durable delivery (no duplicate task).
- [ ] At least one revision round demonstrated onsite.
- [ ] Required evidence or checks stop the loop at `human_review`; low-risk
  documentation or cosmetic changes may be host-merged only after independent
  checks. `ready` is never merge authorization for an agent.

## 8. Evidence to record

- [ ] API request, accepted session IDs, source revision, agent-authored PR.
- [ ] Verification commands actually run, including
  `pnpm --filter @jira-clone/jira test` (a green root command alone is
  insufficient).
- [ ] Review head/target and browser behavior for the changed routes.
- [ ] Unfinished or missing evidence kept visible, not filled in by assertion.

> Board status-move note (worker draft, 12 Sep 2026): Kanban cards now move
> through a keyboard-first `Move to …` control with HTML5 drag-and-drop as a
> pointer enhancement. Moves save through `PATCH /api/issues/:key`, the
> configured demo persistence path. Neon retains them across reloads, cold
> starts and redeploys; the memory fallback retains them on the same server
> and resets on redeploy. Both paths keep the card in its original column on
> deterministic failure.
> Pointer-drag approval still needs trusted human browser evidence.
>
> Demo-only transition guard (worker draft, 13 Sep 2026): status moves on the
> PATCH save path follow a fixed **demo-only** matrix — To Do → In Progress →
> In Review → Done → To Do (reopen). Any other move is rejected with a
> structured demoOnly 409 naming the allowed target(s), and nothing is
> written. Authorization still runs first, so viewer writes stay 403. The
> matrix is a small explicit teaching default: it is **not verified Jira
> workflow parity and not production authorization**. The demo does expose
> bounded REST and MCP contracts, Passport-derived identity and a fake OAuth
> provider. Those contracts are demo-only. Full Jira compatibility, production
> Connect or OAuth registration, SAML, SCIM, durable accounts and complete Jira
> permissions remain out of scope. OAuth clients, grants and tokens remain in
> their separate in-memory provider.
