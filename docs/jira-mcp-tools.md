# Demo-only Jira MCP tools

The Jira app exposes its demo REST subset through Nuxt MCP Toolkit over the
default `/mcp` endpoint (`mcp: { name: "ADEO Jira Demo", version: "0.1.0" }`).
Eleven tools in `apps/jira/server/mcp/tools/*.ts` wrap the contracts in
[`jira-rest-adapter.md`](./jira-rest-adapter.md) 1:1: seven reads plus four
bounded writes.

| Tool | Contract |
| --- | --- |
| `me` | `GET /api/rest/api/3/myself` (optional `demoUser`, explicit demo-member default) |
| `getProject` | `GET /api/rest/api/3/project/KAN` (only `KAN`, defaults to `KAN`) |
| `getProjectStatuses` | `GET /api/rest/api/3/project/KAN/statuses` (observed list, not a transition graph) |
| `getIssue` | `GET /api/rest/api/3/issue/:key` |
| `listIssues` | `GET /api/rest/api/3/search` (`startAt` default 0, `maxResults` default 25, hard-bound 50) |
| `listComments` | `GET /api/rest/api/3/issue/:key/comment` (same pagination bounds) |
| `getAllowedTransitions` | `GET /api/rest/api/3/issue/:key/transitions` (same `DEMO_TRANSITIONS` matrix as the PATCH save path; lists targets, never performs a move) |
| `createIssue` | `POST /api/rest/api/3/issue` (`fields.summary` required; bounded `priority`/`assignee`/`description`/`issuetype`/`status`/`project`; unknown fields rejected) |
| `updateIssue` | `PUT /api/rest/api/3/issue/:key` (`fields.summary`/`priority`/`assignee`/`description`; `status` rejected with a hint to `transitionIssue`) |
| `addComment` | `POST /api/rest/api/3/issue/:key/comment` (nonblank `body`) |
| `transitionIssue` | `POST /api/rest/api/3/issue/:key/transitions` (demo transition id from `getAllowedTransitions`; same `DEMO_TRANSITIONS` matrix) |

Demo boundary: every result carries `demoOnly: true`, the shared
`roleMatrix` label, and the REST boundary note. There is no JQL engine in
this slice: any `jql` input fails closed with a labelled demoOnly 400, never
silently ignored. Unknown issue/project keys stay 404 and write nothing.
Write results carry `actor` and `identitySource` metadata and preserve the
deterministic `{fail:true}` no-write behavior.

Identity boundary: MCP inputs cannot carry the raw Passport header (it only
exists on the HTTP request boundary), so the write tools accept the same
explicit labelled `demoUser` fallback the REST adapter reads accept
(`demo-admin`, `demo-member`, `demo-viewer`, explicit demo-member default).
They run through the same `authorizeAppWrite` authority as the HTTP routes
(viewer writes denied, unknown/malformed identities fail closed, nothing
written on denial), but they run without Passport auth and never claim it:
`identitySource` in write results always reports `demoFallback`.

This is not full Jira parity, not a JQL engine, not production
OAuth/Connect/SAML/SCIM, and it does not replace production authorization.

Issue and comment reads and writes use the shared persistence boundary. The
default is Neon Postgres when `DATABASE_URL` is set. `JIRA_PERSISTENCE=memory`
selects the labelled in-memory fallback, and the test script sets that mode so
tests do not write to a developer database. OAuth clients, grants and tokens
remain in their separate in-memory demo provider.

Protocol coverage lives in `apps/jira/tests/jira-mcp-tools.test.ts`: the
eleven-file surface (reads `readOnlyHint: true`, writes `readOnlyHint:
false`), 1:1 read and write contract mapping, exact helper parity for the
four write tools, viewer/unknown/malformed denial, unknown-key,
unsupported-field, unknown-transition, off-matrix, blank-body, pagination
and JQL cases, deterministic failed writes, and no mutation on denials.
Bounded REST write coverage lives in
`apps/jira/tests/jira-rest-writes.test.ts`.
