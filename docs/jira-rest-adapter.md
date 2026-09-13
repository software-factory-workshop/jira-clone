# Demo-only Jira-style REST adapter

A small, dependency-free, bounded Jira-shaped REST surface over the existing
ADEO demo store, so the Jira MCP toolkit can wrap stable contracts 1:1.

> Demo boundary: every response carries `demoOnly: true`, the shared
> `roleMatrix` label, and an explicit `boundary` note. Reads plus the four
> explicit write routes below run over the labelled in-memory demo store
> (same boundary as the native routes: edits and created issues survive
> reload against the same server, reset on redeploy or reset). This is not
> full Jira parity, not a JQL engine, not production OAuth/Connect/SAML/SCIM,
> and persistence remains the existing in-memory demo store.
>
> Identity boundary: accounts derive from the platform-injected verified
> `x-vercel-oidc-passport-token` header when present (stable
> `passport:<external_sub>` account id, explicit claims/groups role mapping
> with a documented viewer default, malformed or unrecognised identities fail
> closed with 401 before any mutation, raw token never returned/logged/sent
> to the browser, accounts never keyed by email). Without a Passport identity
> the labelled synthetic `x-demo-user` fallback applies so the workshop still
> runs. Vercel Passport deployment protection is an external prerequisite
> managed outside this demo; this code never enables Passport on a project.

## Endpoints (reads)

| Adapter route | Contract |
| --- | --- |
| `GET /api/rest/api/3/myself` | Resolves the request through the shared request-to-application-account resolver to a Jira-shaped demo user plus a read `permissions` summary (`canCreate/canUpdate/canComment/canReset`). A present Passport identity maps through the explicit claims/groups role mapping (default viewer); otherwise the labelled synthetic `x-demo-user` fallback applies (explicit `demo-member` default). Reads stay open to read-only accounts. The response distinguishes `identitySource` passport versus demoFallback and never exposes the raw token. |
| `GET /api/rest/api/3/project/KAN` | Observed reference project (id `10000`, `My Kanban Space`, simplified next-gen software). Other keys stay 404. |
| `GET /api/rest/api/3/project/KAN/statuses` | Observed statuses per observed issue type (`Epic`, `Subtask`, `Task`, `Story`, `Feature`, `Bug` × `To Do`, `In Progress`, `In Review`, `Done`). An observed list, not a transition graph. |
| `GET /api/rest/api/3/issue/:key` | Jira-like bean: `key`, `fields.summary` (= demo title), `issuetype`, `status`, `priority`, `assignee`, `description`, project ref. Unknown keys stay 404. |
| `GET /api/rest/api/3/search` | List-lite slice of the whole demo store with `startAt` (default 0, integer ≥ 0) and `maxResults` (default 25, integer 1–50) plus `total`. |
| `GET /api/rest/api/3/issue/:key/comment` | Comment list for one issue with the same `startAt`/`maxResults` bounds. Unknown keys stay 404. |
| `GET /api/rest/api/3/issue/:key/transitions` | Allowed targets derived from the same `DEMO_TRANSITIONS` matrix that guards `PATCH /api/issues/:key`, so adapter and save path agree. |

Any `jql`/`JQL` query parameter (any casing) is rejected with a labelled
demoOnly 400 naming unsupported; it is never silently ignored. Out-of-range
`startAt`/`maxResults` values are labelled demoOnly 400s. All failed reads
change nothing. Native write routes and transition semantics are unchanged.

## UI reads

The board list renders `GET /api/rest/api/3/search` with bounded
`startAt`/`maxResults` (the board page uses `startAt=0&maxResults=50`),
single-issue detail renders `GET /api/rest/api/3/issue/:key`, and comments
render `GET /api/rest/api/3/issue/:key/comment` with the same bounds.
`apps/jira/app/utils/restIssues.ts` maps those Jira-shaped envelopes back to
the existing board/comment display shapes (`summary` → `title`,
`author.displayName`, `created`). Demo writes (`PATCH /api/issues/:key`,
creation, reset, comment posts) are unchanged; successful status/priority
saves refresh the affected issue through the canonical single-issue read.
Loading and transport failures clear (or never populate) the affected data
and report the error; the UI no longer seeds from fixtures or the demo
list-store read.

## Bounded writes

Four Jira-shaped write routes reuse the existing issue store and the shared
resolver/`authorizeAppWrite` authority (same admin/member/viewer and
malformed/unknown identity semantics as the native routes). Every HTTP write
route reads only the trusted `x-vercel-oidc-passport-token` header plus the
existing explicit `x-demo-user` fallback, authorizes before mutation, returns
`actor` and `identitySource` metadata, and preserves the deterministic
`{fail:true}` no-write behavior.

| Adapter route | Contract |
| --- | --- |
| `POST /api/rest/api/3/issue` | Bounded creation: `fields.summary` required; `priority`, `assignee`, `description`, `issuetype` and the fixture-defaulted `status` optional. Unknown fields, blank summaries, invalid values and unknown projects fail closed with labelled demoOnly errors that write nothing. |
| `PUT /api/rest/api/3/issue/:key` | Bounded field update: `fields.summary`, `priority`, `assignee`, `description` map onto the demo model (the store now supports title/assignee/description edits on the same boundary; the native PATCH route still sends status and/or priority only). `fields.status` is rejected with a hint to use the transitions route; unknown fields, unknown keys and invalid values write nothing. |
| `POST /api/rest/api/3/issue/:key/comment` | Bounded comment creation: a nonblank `body` string (doc-shaped bodies are best-effort text). Unknown keys, blank bodies and `{fail:true}` write nothing. |
| `POST /api/rest/api/3/issue/:key/transitions` | One status move along the existing `DEMO_TRANSITIONS` matrix using the deterministic demo transition ids from the read transitions route (`transition.id`, also accepted as a bare string or `{name}`/`{to.name}`). Unknown keys, unknown ids, off-matrix moves (409 with `allowedFrom`) and `{fail:true}` write nothing. No permission or transition logic is duplicated: the target resolves through the shared read helpers and the move applies via the shared `updateIssue` store path. |

## MCP mapping

The Jira MCP toolkit wraps these contracts 1:1 without new server
behavior: `me` → myself, `getProject`/`getProjectStatuses` → project routes,
`getIssue` → issue route, `listIssues` → search-lite (exposing
`startAt`/`maxResults`, never `jql`), `listComments` → comment route,
`getAllowedTransitions` → transitions route, plus `createIssue` → issue
creation, `updateIssue` → issue update, `addComment` → comment creation,
`transitionIssue` → transitions. JQL, project mutation, Passport/OAuth,
SAML, SCIM, durable persistence, and full Jira compatibility stay out of
scope.
