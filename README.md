# ADEO Jira factory

Grow a software factory with Eve, using an ADEO-branded Jira demo as its test subject. The factory is the workshop outcome. Jira gives us concrete work and product feedback with which to improve it.

**Station 01 — task mining.** An Eve agent investigates the goal, source and GitHub work in a Vercel Sandbox, then returns proposals and a reflection for human review. See [the factory contract](factory/CONTRACT.md).

## Review the starting point

- Factory cockpit: https://adeo-factory-cockpit.vercel.app
- Jira demo: https://adeo-jira-clone.vercel.app
- Both applications use the ADEO Nuxt UI layer v0.1.1.

The cockpit starts and resumes durable Eve investigations and keeps request drafts in shared, versioned cockpit storage. “Create issue in GitHub” opens a prefilled issue; the user decides whether to submit it. “Go!” saves the draft and starts durable delivery. Draft storage is shared team state, with version checks for concurrent edits. The task-mining station uses Vercel Connect for fixed-repository context when installed.

The Jira demo has searchable synthetic issues, status and assignee filtering, list/board views, issue details, bounded creation, edits, comments, transitions and reset. Its issue and comment persistence uses Neon Postgres when `DATABASE_URL` is configured, with an explicit in-memory fallback for tests and workshops. Passport-derived accounts, a labelled fallback role matrix, bounded Jira-shaped REST routes, eleven MCP tools and a fake OAuth provider are implemented locally. The exact boundaries are documented in the headers of `apps/jira/server/utils/*.ts`. This is not full Jira parity and does not provide production Connect or OAuth registration, SAML, SCIM or complete Jira permissions.

## Run locally

Requires Node 24.11+ (24.x) and pnpm 10.33.4.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Cockpit: http://127.0.0.1:3000. Jira: http://127.0.0.1:3001.

```sh
pnpm typecheck
pnpm test
pnpm build
```

### Jira persistence

Set `DATABASE_URL` in the Jira app to use Neon Postgres. The first issue or
comment read creates the two small demo tables and seeds the four labelled
issues. `JIRA_PERSISTENCE=neon` requires `DATABASE_URL`; the default selects
Neon when the URL exists and otherwise uses the labelled in-memory fallback.
`JIRA_PERSISTENCE=memory` forces that fallback. The Jira test script sets the
memory mode so local tests never write to a developer database. See
[`apps/jira/.env.example`](apps/jira/.env.example) and the checked-in schema
at [`apps/jira/server/db/neon-schema.sql`](apps/jira/server/db/neon-schema.sql).

## Repository map

| Location | Purpose |
| --- | --- |
| `apps/factory` | Nuxt cockpit and its Eve agent |
| `apps/jira` | Nuxt Jira demo application |
| `packages/project-context` | Shared stage definitions, references and labelled fixtures |
| `factory` | Factory contract, policies and evidence |
| `packages/fx-sandbox-experiment` | Developer fx experiment for context calibration in Vercel Sandbox |
| `.agents/skills` | Universal project skills, including ADEO UI and review guidance |
| `apps/factory/agents/*/agent/skills` | Native Eve skills for task-miner, worker and reviewer |
| `vendor` | Private ADEO v0.1.1 package artifact |

The factory lives with the product so a change to its instructions, tools or checks can be reviewed against the code and the evidence that motivated it. A reusable factory engine can remain an external dependency; project policy and learning belong here.

## Deployment

Two Vercel projects on `demo-software-factory`, each linked to this repository:

| Project | Root directory |
| --- | --- |
| `adeo-factory-cockpit` | `apps/factory` |
| `adeo-jira-clone` | `apps/jira` |

Both projects include files outside their root, use Node 24, and build the Nuxt application. The team allows production deployment from Git only: push to `main`; do not use `vercel deploy --prod`. Their workspace dependency and vendored design-system artifact must be present during installation.

The cockpit's GitHub connector is `github/jira-clone`. Keep all cockpit deployments protected before enabling private repository reads. No personal GitHub token belongs in app configuration.

## Private design-system package

Stage zero consumes the existing v0.1.1 package tarball, checked into this **private** repository. This is the same Nuxt layer, not a reimplementation. It keeps workshop installation reproducible while package-registry access is being configured. See [vendor provenance](vendor/README.md) and the [tracked package-access friction](.agents/friction-log/20260912094635-adeo-private-package/friction.md). Do not publish this repository or package artifact publicly.

## Next review

Read [the factory contract](factory/CONTRACT.md). Review an investigation in the cockpit, then select one bounded task.
