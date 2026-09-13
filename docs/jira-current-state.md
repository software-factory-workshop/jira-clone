# Jira demo current state

Checked 13 September 2026 against the current Jira implementation on `main`.

The ADEO Jira application is a bounded demo slice. It uses synthetic seed data
and a labelled persistence boundary. With `DATABASE_URL`, issue and comment
writes go to Neon Postgres. Without it, the app reports and uses the explicit
in-memory fallback. "Implemented" below means present in the source and
covered by local tests. It does not mean hosted browser evidence or production
Jira compatibility.

## Implemented locally

| Area | Current contract |
| --- | --- |
| Issue experience | Search, status and assignee filtering, list and board views, issue details, priority and status edits, issue creation, comments, reset, and keyboard-first status movement. |
| Native API | `/api/issues`, `/api/issues/:key`, comments, reset and `/api/me` provide the application contract used by the UI. |
| Jira-shaped REST | Bounded project and status reads, list-lite search, issue reads, comments, transitions, issue creation and field updates under `/api/rest/api/3`. JQL is rejected explicitly. |
| MCP Toolkit | Eleven tools wrap the REST contract 1:1: seven reads and four bounded writes. |
| Identity and roles | A verified platform Passport token maps to a stable `passport:<external_sub>` account. Without Passport, the labelled `x-demo-user` fallback supports the demo role matrix. Viewer, member and admin writes are enforced by the shared authority and fail closed for malformed or unknown identities. |
| OAuth | A fake, in-memory OAuth provider supports discovery, registration, authorization, consent, code exchange, refresh rotation and revocation for the demo API. |
| Persistence | Neon Postgres is selected when `DATABASE_URL` exists. The app creates `jira_demo_issues` and `jira_demo_comments` lazily, seeds the four labelled issues, and reports the active mode in native and Jira-shaped read envelopes. `JIRA_PERSISTENCE=memory` forces the fallback. |
| Failure and drafts | `{fail:true}` produces a deterministic no-write failure. Client drafts stay available after a failed save. Neon retains issue/comment writes across reloads, cold starts and deploys until reset; the memory fallback retains them only on the same running server. |

The detailed route and boundary contracts live in [the REST adapter guide](jira-rest-adapter.md), [the MCP guide](jira-mcp-tools.md) and [the OAuth provider guide](jira-oauth-provider.md).

## Boundaries that remain

- Data is synthetic. Neon is durable for this demo's issue/comment rows, while the explicit memory fallback resets on cold start or redeploy. The demo reset clears issue and comment rows in either mode.
- The REST search route is a bounded list slice. It does not implement JQL, arbitrary Jira filters, project mutation or the complete Jira REST API.
- MCP tools are demo tooling. They use the labelled demo fallback when no Passport identity is available, and `/mcp` is not bearer-protected by this application.
- Passport identity depends on Vercel deployment protection injecting the verified header. The OAuth provider is a local demo contract. Vercel Connect registration is not live here.
- OAuth clients, grants and tokens remain an intentionally separate in-memory demo provider. SAML, SCIM or directory sync, durable accounts, complete Jira permissions and full workflow/API parity are not implemented.

## Evidence status

At this revision, `pnpm --filter @jira-clone/jira test` passes all 145 local tests covering the UI helpers, native routes, REST adapter, MCP tools, Passport resolver, OAuth provider and the Neon adapter with an injected SQL client. A passing local suite proves the checked-in contract. Hosted production verification is recorded separately in [verification.md](verification.md): the dedicated `jira-clone-db` resource is connected to `adeo-jira-clone`, and authenticated Vercel CLI requests returned `persistence.mode: "neon"` and `durable: true` while exercising create, read and reset. The protected alias still requires Vercel SSO, so no end-user browser or Passport sign-in behavior is claimed. External Connect configuration remains out of scope.

## Source map

- Jira UI: `apps/jira/app/app.vue`
- Native and REST routes: `apps/jira/server/api/`
- Shared issue, identity and authorization logic: `apps/jira/server/utils/`
- MCP tools: `apps/jira/server/mcp/tools/`
- Local contract tests: `apps/jira/tests/`
- Neon bootstrap schema: `apps/jira/server/db/neon-schema.sql`
