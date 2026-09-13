# Demo-only Jira MCP tools

The Jira app exposes its demo REST subset through Nuxt MCP Toolkit over the
default `/mcp` endpoint (`mcp: { name: "ADEO Jira Demo", version: "0.1.0" }`).
Seven read-only tools in `apps/jira/server/mcp/tools/*.ts` wrap the contracts
in [`jira-rest-adapter.md`](./jira-rest-adapter.md) 1:1:

| Tool | Contract |
| --- | --- |
| `me` | `GET /api/rest/api/3/myself` (optional `demoUser`, explicit demo-member default) |
| `getProject` | `GET /api/rest/api/3/project/KAN` (only `KAN`, defaults to `KAN`) |
| `getProjectStatuses` | `GET /api/rest/api/3/project/KAN/statuses` (observed list, not a transition graph) |
| `getIssue` | `GET /api/rest/api/3/issue/:key` |
| `listIssues` | `GET /api/rest/api/3/search` (`startAt` default 0, `maxResults` default 25, hard-bound 50) |
| `listComments` | `GET /api/rest/api/3/issue/:key/comment` (same pagination bounds) |
| `getAllowedTransitions` | `GET /api/rest/api/3/issue/:key/transitions` (same `DEMO_TRANSITIONS` matrix as the PATCH save path) |

Demo boundary: every result carries `demoOnly: true`, the shared
`roleMatrix` label, and the REST boundary note. There is no JQL engine in
this slice: any `jql` input fails closed with a labelled demoOnly 400, never
silently ignored. Unknown issue/project keys stay 404 and write nothing.
There are no write tools and no auth or Atlassian Connect claims; the
transitions tool only lists allowed targets and never performs a move.

Protocol coverage lives in `apps/jira/tests/jira-mcp-tools.test.ts`: the
seven-file surface, 1:1 contract mapping with no-write behavior, and
fail-closed unknown-key, pagination and JQL cases.
