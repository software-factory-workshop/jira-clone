# Cockpit API and shared state

The UI and machine clients use the same authenticated APIs. `GET /factory/cockpit` supplies the project context, starter requests, stages and capability links. Tab selection, focus and scrolling remain presentation state. GitHub status uses `GET /api/github`.

## Authentication and storage

Routes use the existing Eve `factoryAuth`: verified Passport behind the cockpit project, Vercel OIDC for machine clients, and local development capability. They share the protected workshop workspace; they do not pretend to implement per-user Jira permissions. Provider tokens and arbitrary repositories are not accepted.

Private Vercel Blob stores `factory/cockpit-v1.json`. `BLOB_READ_WRITE_TOKEN` must be available to the cockpit Eve service in the intended deployment environment. Reads use `get({access:'private',useCache:false})`; writes compare the same content's ETag with `ifMatch`. Initial creation disallows overwrites. There is no cache or filesystem fallback presented as shared persistence.

## Drafts, feedback and run history

- `GET /factory/cockpit/{drafts|feedback|runs}` → `{items:[...]}`.
- `GET /factory/cockpit/{collection}/{id}` → `{item: record|null}`.
- `POST /factory/cockpit/{collection}` with `{id,value}` creates a record. Supply a stable caller-generated ID to reconcile uncertain responses.
- `PUT /factory/cockpit/{collection}/{id}` with `{value,expectedVersion}` creates with version `0` or updates the version last read.
- `DELETE /factory/cockpit/{collection}/{id}` with `{expectedVersion}` clears it.

A record contains `id`, `version`, `createdAt`, `updatedAt`, and `value`. Draft value is `{title,request}`; feedback is `{verdict:'useful'|'not-useful',reason}`; run metadata is `{label,station,operationId?,execution?,deliveryId?}`. Versions remain monotonic across delete/recreate. HTTP409 means the item changed; preserve typed text and reload before explicitly retrying. Whole-document CAS retries preserve unrelated item writes.

`POST /factory/cockpit/import` with `{collection,items:[{id,value}]}` imports old browser records once. It never replaces an existing shared record, never removes the browser source, and remembers imports so deleted feedback cannot reappear on reload. Malformed or unavailable browser storage is retained; no silent destructive migration occurs.

Eve keeps execution history. The shared run index is navigation metadata: index failure does not cancel a started agent. The accepted session ID and Eve stream remain authoritative recovery handles.

## Mining and proposal activation

Mining uses Eve directly: `POST /eve/v1/session` starts it; `POST /eve/v1/session/{id}` sends follow-up text or input responses; `GET /eve/v1/session/{id}/stream` reads/resumes events; `POST /eve/v1/session/{id}/cancel` cancels cooperatively; `/reset` retires a session.

`GET /factory/cockpit/run/{id}?operationId=...&deliveryId=...` projects trusted recorded tool results, discovers worker/reviewer child sessions, and reports snapshot completeness. It uses the same parsers and delivery matching as the cockpit UI. A partial observation is not completion proof.

`POST /factory/cockpit/activate` takes `{sessionId,proposalId?}`. The server reads recorded findings from Eve, selects one host-assigned proposal (or the complete report), and saves an editable draft with provenance. Repeated activation returns the existing draft; it does not start a worker or overwrite edits. A caller cannot supply invented findings/provenance.

`POST /factory/cockpit/issue-link` with `{title,request}` returns a prefilled GitHub issue URL. It does not submit an issue.

## Work and delivery

Existing station endpoints remain `/factory/stations/worker`, `/reviewer`, and `/revisions`; cancellation, streaming and decisions retain Eve's transport. The UI exposes create, same-owner revision and child contribution separately.

Delivery controls use `/factory/delivery`: create, get, advance, cancel and request a revision. The loop UI advances a nonterminal delivery while open; the durable loop and CLI controller provide the crash-recovery contract described by the delivery implementation. Merging remains manual. A saved draft or useful mark never implicitly authorizes execution.
