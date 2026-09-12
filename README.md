# ADEO Jira factory

Grow a software factory with Eve, using an ADEO-branded Jira demo as its test subject. The factory is the workshop outcome. Jira gives us concrete work and product feedback with which to improve it.

**Station 01 — task mining.** An Eve agent investigates the goal, source and GitHub work in a Vercel Sandbox, then returns proposals and a reflection for human review. See [the station contract](factory/task-mining-station.md) and [verification](docs/verification.md).

## Review the starting point

- Factory cockpit: https://adeo-factory-cockpit.vercel.app
- Jira shell: https://adeo-jira-clone.vercel.app
- Both applications use the ADEO Nuxt UI layer v0.1.1.

The cockpit starts and resumes durable Eve investigations. Its [API manifest](docs/cockpit-api.md) exposes the same read-only context and stateful draft/review operations used by the UI. Request drafts remain caller-owned browser state, not shared team state. “Review in GitHub” opens a prefilled issue; the user decides whether to submit it. GitHub repository context uses Vercel Connect when installed.

The Jira shell has searchable fixture issues, status filtering, list/board views and issue details. Its rows are synthetic. It has no issue mutations, accounts, permissions, Jira-compatible API or integration endpoints yet.

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

## Repository map

| Location | Purpose |
| --- | --- |
| `apps/factory` | Nuxt cockpit and its Eve agent |
| `apps/jira` | Nuxt Jira demo shell |
| `packages/project-context` | Shared stage definitions, references and labelled fixtures |
| `factory` | Goal, project context, reflections and mining experiments |
| `packages/fx-sandbox-experiment` | Developer fx experiment for context calibration in Vercel Sandbox |
| `.agents/skills/adeo-nuxt-ui` | Versioned design-system instructions |
| `docs` | Workshop experiment, cockpit rationale and verification |
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

Read [the cockpit scope](docs/cockpit.md) and [the growth experiment](docs/factory-growth-experiment.md). Review an investigation in the cockpit, then improve its context or select one bounded task.
