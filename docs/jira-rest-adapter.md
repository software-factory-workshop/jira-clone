# Demo-only Jira-style REST adapter

A small, dependency-free, GET-only Jira-shaped REST surface over the existing
ADEO demo store, so a later Jira MCP toolkit can wrap stable contracts 1:1.

> Demo boundary: every response carries `demoOnly: true`, the shared
> `roleMatrix` label, and an explicit `boundary` note. Reads run over the
> labelled in-memory demo store (same boundary as the native routes: edits and
> created issues survive reload against the same server, reset on redeploy or
> reset). There is no full Jira parity, no JQL engine, no writes, and no
> production auth.

## Endpoints (all GET-only)

| Adapter route | Contract |
| --- | --- |
| `GET /api/rest/api/3/myself` | Resolves `x-demo-user` (or the explicit `demo-member` default) to a Jira-shaped demo user. Reads stay open to the demo viewer. |
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

## Later MCP mapping

A future Jira MCP toolkit wraps these contracts 1:1 without new server
behavior: `me` → myself, `getProject`/`getProjectStatuses` → project routes,
`getIssue` → issue route, `listIssues` → search-lite (exposing
`startAt`/`maxResults`, never `jql`), `listComments` → comment route,
`getAllowedTransitions` → transitions route. POST/PUT/DELETE parity, JQL,
project mutation, Passport/OAuth, SAML, SCIM, durable persistence, and full
Jira compatibility stay out of scope.
