# Jira demo current state

Checked 13 September 2026 against the Jira implementation at `cc0c67d7a10df4ae3e5170e4644094f3c896c4fc`; the documentation and implementation are now synchronized on `main`.

The ADEO Jira application is a bounded demo slice. It is no longer a fixture-only shell. It still uses synthetic seed data and a demo-only in-memory store. "Implemented" below means present in the source and covered by local tests. It does not mean hosted browser evidence or production Jira compatibility.

## Implemented locally

| Area | Current contract |
| --- | --- |
| Issue experience | Search, status and assignee filtering, list and board views, issue details, priority and status edits, issue creation, comments, reset, and keyboard-first status movement. |
| Native API | `/api/issues`, `/api/issues/:key`, comments, reset and `/api/me` provide the application contract used by the UI. |
| Jira-shaped REST | Bounded project and status reads, list-lite search, issue reads, comments, transitions, issue creation and field updates under `/api/rest/api/3`. JQL is rejected explicitly. |
| MCP Toolkit | Eleven tools wrap the REST contract 1:1: seven reads and four bounded writes. |
| Identity and roles | A verified platform Passport token maps to a stable `passport:<external_sub>` account. Without Passport, the labelled `x-demo-user` fallback supports the demo role matrix. Viewer, member and admin writes are enforced by the shared authority and fail closed for malformed or unknown identities. |
| OAuth | A fake, in-memory OAuth provider supports discovery, registration, authorization, consent, code exchange, refresh rotation and revocation for the demo API. |
| Failure and drafts | `{fail:true}` produces a deterministic no-write failure. Client drafts stay available after a failed save. Same-server reloads retain demo edits and created issues. |

The detailed route and boundary contracts live in [the REST adapter guide](jira-rest-adapter.md), [the MCP guide](jira-mcp-tools.md) and [the OAuth provider guide](jira-oauth-provider.md).

## Boundaries that remain

- Data is synthetic. The store is in memory, survives reload on the same running server, and resets on cold start, redeploy or explicit reset. It is not durable production persistence.
- The REST search route is a bounded list slice. It does not implement JQL, arbitrary Jira filters, project mutation or the complete Jira REST API.
- MCP tools are demo tooling. They use the labelled demo fallback when no Passport identity is available, and `/mcp` is not bearer-protected by this application.
- Passport identity depends on Vercel deployment protection injecting the verified header. The OAuth provider is a local demo contract. Vercel Connect registration is not live here.
- SAML, SCIM or directory sync, durable accounts, complete Jira permissions and full workflow/API parity are not implemented.

## Evidence status

At this revision, `pnpm --filter @jira-clone/jira test` passes 141 tests covering the local UI helpers, native routes, REST adapter, MCP tools, Passport resolver and OAuth provider. A passing local suite proves the checked-in contract. It does not prove that the hosted aliases have been exercised in a browser or that external Passport and Connect configuration is enabled. Record those observations separately in [verification.md](verification.md).

## Source map

- Jira UI: `apps/jira/app/app.vue`
- Native and REST routes: `apps/jira/server/api/`
- Shared issue, identity and authorization logic: `apps/jira/server/utils/`
- MCP tools: `apps/jira/server/mcp/tools/`
- Local contract tests: `apps/jira/tests/`
