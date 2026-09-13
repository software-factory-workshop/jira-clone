# Factory Cedar policy audit

The factory now authorizes its consequential operation boundaries with a
reviewable Cedar policy set. The current scope is the Jira-clone factory
workflow, not Jira business permissions.

The implementation follows this shape:

```text
factory action catalog -> generated Cedar schema -> shared guard
  -> existing host operation -> decision audit
```

## What is active

Canonical policy source lives in
`factory/policies/cedar/*.cedar`. The generated policy text is committed at
`apps/factory/runtime/lib/cedar/generated-policies.ts`; it is not an editable
runtime configuration. Run this after changing a canonical policy:

```bash
pnpm --filter @jira-clone/factory factory:policies:sync
```

The action catalog is
`apps/factory/runtime/lib/cedar/catalog.ts`. It owns the input shape,
mutating/read-only classification, and resource type used to generate the
schema. The current actions are:

| Action | Resource | Kind | Trusted operation |
| --- | --- | --- | --- |
| `run_check` | Repository | read-only | worker/reviewer sandbox checks |
| `record_verification` | Change | mutating state | worker/reviewer verification evidence |
| `record_review` | Change | mutating state | reviewer exact-head review record |
| `publish_change` | Change | mutating | worker draft PR publication |
| `merge_change` | Change | mutating | host delivery-driver low-risk merge |

There is deliberately no `deploy_change` rule: this checkout has no factory
deployment operation to authorize. Adding one requires a real operation,
resource model, evidence path, and tests first.

## Trust model

`factoryPrincipalFromStation()` maps only the authenticated Eve session
initiator to Cedar. The station role is attached by the host after the
station boundary has been authenticated; it is not taken from model output.
The delivery-driver merge principal is a fixed host-created service identity.
Unknown or local-only identities fail closed.

`runFactoryOperation()` evaluates Cedar before calling `execute`. A deny or a
strict-validation error means the operation is not called. It emits a
redacted decision audit containing the operation ID, principal/resource IDs,
action, policy and schema revisions, determining policy IDs, outcome, and
field names rather than raw inputs. Worker and reviewer tool audits go through
`evlog`; merge audits are returned in the durable `mergeDecision` record.

Cedar does not replace business validation. Existing host code still checks
the actual Git tree, exact GitHub PR head/base, repository checks, review
findings, browser limitations, and low-risk file policy. Cedar binds those
facts to the authorization request before the external operation runs.

For worker publication, the pre-publication candidate value is the SHA-256
digest of the collected change set. It is intentionally a candidate digest,
not a Git commit SHA; after GitHub creates the draft PR, later review and merge
decisions use the real PR head SHA.

## Rules currently in force

The 13 rules are listed by the read-only manifest and have stable `@id`
annotations:

- missing evidence is forbidden for every consequential mutation;
- evidence must be complete, from a known host source, and bound to the candidate;
- stale candidate, base, verified, or expected revisions are forbidden;
- publication to the default branch is forbidden;
- unbound service principals cannot mutate;
- elevated-risk automatic merges are forbidden;
- worker and reviewer identities may run only their fixed check lane;
- worker and reviewer identities may record their own complete verification;
- reviewers may record an exact candidate review;
- workers may publish only a verified draft on a `factory/*` branch;
- only the host delivery driver may automatically merge a low-risk exact review.

The current low-risk merge policy intentionally does not use a human approval
field. The host's separate `mergeEligibility()` gate requires independent
review and restricts automatic merging to small documentation or cosmetic CSS
changes; everything else remains manual. Approval, authorization, and
idempotency therefore remain distinct concerns.

## Audit surface

Authenticated operators can inspect the active source, generated schema,
action catalog, validation report, and both revisions at:

```text
GET /api/factory/policies
```

The endpoint is read-only and sends `Cache-Control: private, no-store`. The
response includes `readOnly: true`, `canonicalDirectory`, `schemaRevision`,
`policyRevision`, the generated schema, every canonical Cedar body, strict
validation issues, and the action input schemas.

For CI or operator probes, the authenticated read-only endpoint
`POST /api/factory/policies/test` evaluates a supplied request and returns
`simulation: true`. It never grants permission or executes an operation; the
principal in that body is a test vector, not proof of caller identity.

## Change and activation discipline

Policy and schema revisions are included in every decision audit. A canonical
policy edit is not active merely because a file changed: regenerate the
committed evaluator, run strict validation and allow/deny tests, then review
and activate it through the normal development path. The factory has no
policy edit or activation endpoint, and its worker publication boundary
rejects `factory/` and `apps/factory/scripts/` changes.

Validation and focused tests:

```bash
pnpm --filter @jira-clone/factory typecheck
pnpm --filter @jira-clone/factory test
pnpm --filter @jira-clone/factory build
```

The authorization wrapper supplies the Cedar decision audit. Existing durable
work-state and delivery receipts remain the CAS/lease and external-side-effect
receipt boundary; the wrapper does not pretend that a policy allow proves a
remote write happened exactly once.
