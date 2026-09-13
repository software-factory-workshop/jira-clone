# FILE: .agents/friction-log/20260912104654-task-mining-fx/friction.md

---
title: 'Task-mining fx adapter pauses before the authorized GitHub read'
severity: 'minor'
---

## Expected Behavior
The isolated task miner reads GitHub issues through its authorized host tool and returns proposals in one bounded run.

## Current Behavior
With @ai-sdk/harness 1.0.107 and harness-fx 1.0.20, fx emits a native approval request for mcp_ai-sdk-harness-tools_github_read before reaching the host tool. generate returns finishReason tool-calls with no GitHub read even when toolApproval.github_read is approved. Native tool names and inputs also differ from the adapter schemas in trace validation.

## Possible Solution
Continue the in-flight turn with approval only for the fixed repository GET tool after validating its inputs. Keep read-only native permissions. Do not score a paused or failed run as a task-mining baseline. Track compatibility separately from context quality.

## Minimal Reproducible Example
See factory/mining/runs/baseline-read-tool-retry/result.json for acp-permission-1 and its native tool name. The runner at packages/task-miner/run.mjs now handles this bounded continuation. Direct VERCEL_OIDC_TOKEN auth also returned 401; passing the same verified team OIDC bearer through the adapter's explicit AI_GATEWAY_API_KEY record reached inference.

## Context
Repository experiment on 12 September 2026 using meta/muse-spark-1.3-contributor and demo-software-factory. No credentials are included in artifacts. The adapter installs the current fx binary, so installed adapter and runtime compatibility must be verified together.


# FILE: factory/context/goal.md

# What we are growing

Owner: Remi, Vercel solutions architect. Working direction agreed in the development conversation on 12 September 2026. Review this document when that direction changes.

The primary outcome is a software factory that we can grow and explain in a 3–4 hour onsite workshop with Eve at ADEO. The ADEO-branded Jira demo is the factory's test subject and a useful tool for Remi's demos. Shipping more Jira features alone does not demonstrate factory progress.

## Current experiment

Start with a task-mining station focused on understanding the goal, codebase, existing issues and relevant evidence. Run it asynchronously so a person can return to review proposals. First establish that a bounded invocation returns useful work; then build the cockpit experience around the observed needs.

For now the developer runs an isolated AI SDK Harness/fx experiment manually. That runner is not an Eve service, a scheduled workflow or a shipped cockpit feature. The deployed applications remain stage-zero shells. The current authorization is to investigate, improve repository context and evaluate proposals. Mining itself does not implement proposals or publish issues.

A useful proposal connects a present gap to the goal, checks what already exists, names a small outcome and explains how we would tell whether it helped. It can be a context improvement, an investigation or a bounded factory capability. A Jira task is justified when it tests or teaches something relevant to the factory now. There is no required proposal count, and no task is preferable to invented work.

The near-term question is: can a fresh agent understand enough of this project to suggest work Remi would seriously consider, without reconstructing the conversation for it?

## Product direction and open choices

The demo should have recognizable Jira issue, list and board behavior using the ADEO Nuxt UI design system. Eventual targets include the Jira API operations needed by demos, Vercel Connect, Jira MCP using MCP Toolkit, accounts derived from verified Passport identity, SAML and directory sync. The exact compatibility subset and identity behavior need concrete demo scenarios before implementation. The earlier phrase "feature parity" is not evidence of a complete, agreed endpoint specification.

Task-mining source selection, cadence, proposal persistence, deduplication and review behavior remain design choices. Do not assume these were settled because a UI sketch or research example shows them.

## Learning and authority

Keep the goal, project map and reviewed reflections in this repository. A run's observations are evidence; its recommendations are candidates. Remi owns priorities and product taste. The development session may propose context changes and test them, but a mining run cannot change its own instructions or the criteria used to judge it.

Preserve uncertainty. Separate owner decisions, source observations and model hypotheses. Record the sources and date of a reflection and what would invalidate it. Recheck changing facts such as issues and code before carrying a previous proposal forward.

Use this current goal when an older roadmap or UI string still describes request-to-work-order admission as the immediate next step. Those later capabilities remain possible; the current learning experiment is task mining.


# FILE: factory/context/project-map.md

# Project map for an investigation

Source review: 12 September 2026, application source at `9f22e30`. Recheck the files below against the run snapshot. This is a navigation aid, not proof that a deployed route works today.

| Question | Start here | What the source currently supports |
| --- | --- | --- |
| What is already underway? | `factory/context/work-in-progress.md`, current GitHub reads | Developer work can be active without an issue; inspect both |
| What are we trying to learn? | `factory/context/goal.md` | Current owner direction and unresolved decisions |
| What does the cockpit do? | `apps/factory/app/app.vue` | Starter requests, browser-local drafts, knowledge and growth views; issue composition opens GitHub for human submission |
| What GitHub access exists? | `apps/factory/server/api/github.get.ts` | Fixed-repository metadata GET through Connect; it does not list issues or run agents |
| What Jira behavior exists? | `apps/jira/app/app.vue` | Search, status filter, list, board and details over synthetic fixtures; no issue mutation or application API |
| Which context is shared with the UI? | `packages/project-context/src/index.ts` | Stage copy, reference summaries, starter examples, draft parser and fixture issues |
| What was observed in real Jira? | `packages/project-context/src/jira-reference.json` | Dated sandbox capture; distinguish observed statuses from an unobserved transition graph |
| Which design system applies? | `.agents/skills/adeo-nuxt-ui/SKILL.md`, app Nuxt configs, `vendor/README.md` | Existing private ADEO Nuxt UI layer 0.1.1; both applications use it |
| What checks exist? | `packages/project-context/tests/drafts.test.ts`, `.github/workflows/check.yml`, `docs/verification.md` | Draft parser coverage, typechecks/builds and dated manual UI evidence; no task-mining quality evaluation in the deployed app |
| What friction is recorded? | `.agents/friction-log/` | Read the entry body and current source before proposing a fix; pending metadata can lag a completed correction |
| What experiments are running? | `factory/README.md` | Developer-run mining and shipped behavior have separate status |

GitHub issue and PR facts must come from the current run's authorized read. Include closed work when looking for duplicates. A failed read is unavailable evidence, not an empty backlog. The current mining session has no local Git history; use its source snapshot and the supplied GitHub reader rather than inventing commit facts.

Platform Passport deployment protection is separate from application accounts and roles. A Connect token grants delegated provider access; it is not evidence of an application's authorization model. Do not infer Jira API parity, MCP, SAML or directory sync from a working connector.

The research paths in older documents point outside this repository and are unavailable to a repo-only mining session. Their summaries are context, not inspected primary evidence. If a proposal depends on one of those sources, name the missing source or propose a scoped excerpt instead of claiming to have read it.

The developer experiment has an existing runner in `packages/task-miner/run.mjs`, with setup and limits in its README. Its current prompt, review rubric and raw runs exist under `factory/mining/` but are withheld from the mining snapshot to avoid answer leakage. Treat them as unavailable for detailed inspection, not missing work. A proposal to change the experiment should inspect the available runner and identify the specific unproven behavior, rather than assume no runner or rubric exists.


# FILE: factory/context/work-in-progress.md

# Work already underway

Updated 12 September 2026 during the development session. This supplements GitHub; an empty issue list does not imply no active work.

## Task-mining context calibration

Owner: Codex development session, requested by Remi. Status: active, awaiting review of fresh replay and transfer results.

The current work is to make the small task-mining prompt return useful proposals. It already includes the runner, team-scoped model access, current issues/PR reads, explicit source inventory, held-out review criteria, baseline runs, context revisions, same-prompt replays and differently worded probes. Its deliverable is a reviewed comparison with remaining limitations, not a deployed station.

If you are reading this inside a mining session, your invocation is part of that work. Do not propose creating the runner, publishing the inventory or starting the same replay/transfer comparison as a new task. Inspect the available implementation; name a specific gap or new case if further work is justified. A future regression or changed context can justify another experiment, but absence of held-out results does not prove the current experiment has not run.

Artifacts exist in `factory/mining/`, intentionally outside your snapshot. Completion, usefulness and owner acceptance are different states. A completed model call does not establish owner acceptance. Current run scores and candidate answers are withheld to keep your judgment independent.

## Other work

The deployed applications remain stage zero. No implementation or publication of mined proposals is underway as part of this experiment. Check GitHub issues and PRs for work started elsewhere. Do not assume this dated local record supersedes newer repository or GitHub evidence.


# FILE: factory/reflections/2026-09-12-context-review.md

# Context review, 12 September 2026

Status: development-session review. The owner chose task mining in conversation; the observations below were checked by Codex against the repository. Model recommendations remain unaccepted until reviewed. This is not a mining agent changing its own rules.

## Observation: the next step had two definitions

At `9f22e30`, `factory/README.md` and `docs/factory-growth-experiment.md` prioritize request-to-work-order admission. `docs/cockpit.md` also records the newer direction of asynchronous task mining, but leaves its stage undecided. The current conversation chooses task understanding, code and issue context, goals and reflection as the first station.

Change: put the current direction in `factory/context/goal.md` and reconcile the planning documents. The deployed UI stage strings still describe the earlier roadmap in `packages/project-context/src/index.ts`. That is a source observation, not evidence that a deployed mining workflow exists.

Hypothesis: a single current goal reduces irrelevant proposals caused by conflicting plans. Compare fresh runs to assess this; writing the document alone proves nothing about proposal quality.

## Observation: pending friction included completed corrections

The hydration entry already says its fix is applied. `apps/factory/app/app.vue` has `immediate: false` and refreshes the GitHub request after mount. `docs/verification.md` records the subsequent browser check.

The starter-selection entry also describes a completed fix. The same Vue file calls `focusEditor()` after compose/reopen, waits for `nextTick()`, scrolls the editor into view and focuses its input. Commit `c5d3d11` and that entry record browser verification.

The deployment-source restriction is a team policy, not a product defect to remove. `README.md` documents Git-origin deployment and `docs/verification.md` records successful Git deployments. The earlier bootstrap friction is resolved by that documented path.

Change: resolve those three Frog entries, preserving their provenance in Git history and this reflection. Private package-registry access remains outstanding; the checked-in package is a working workaround, documented in `vendor/README.md`.

Hypothesis: reconciling status with evidence prevents recycled fixes from filling the proposal queue. Recheck code and current issues before accepting that claim for a future run.

## Limits

The source review does not retest hosted UI behavior, verify full Jira API compatibility or settle the task-mining UX. Research files referenced outside this repository are not in the mining snapshot. A model should state that boundary instead of implying it read them.

Retire or update these observations when the corresponding code, goal or deployment arrangement changes. Retain dated evidence rather than growing an undifferentiated transcript.


# FILE: factory/reflections/2026-09-12-snapshot-boundaries.md

# Investigating the supplied context

Status: Codex review of a completed mining experiment on 12 September 2026. These are observations and candidate lessons, not owner acceptance of proposed work. Detailed run output and scoring remain held out under `factory/mining/`.

A run correctly shifted toward the task-mining goal, but proposed creating an evaluation rubric that already existed outside its snapshot. It noted that files referenced by the repository were unavailable, yet still ranked the proposal. The information boundary was ambiguous.

Change: `.mining-snapshot.json` now lists included paths and explicit exclusions. Runner source remains available for inspection. The held-out prompt, rubric, raw runs and scores exist in the repository; exclusion is not absence. If a task depends on an unavailable file, request the smallest missing evidence or make a conditional proposal instead of asserting the file needs to be created.

The same run reproduced a Jira status list incorrectly despite having read the JSON reference. Treat exact IDs, arrays, paths and line references as claims to verify against the source immediately before using them. If an exact value does not help justify the task, omit it. Do not paraphrase an array as though it were a faithful quotation.

Hypotheses to test: an explicit source inventory reduces false missing-work proposals, and checking quoted details reduces transcription errors. The development session is running fresh same-prompt replays and differently worded investigations to test these lessons; see `factory/context/work-in-progress.md` for current status. Do not infer unstarted work from this hypothesis statement. Neither observation proves broad model reliability.

Review this note when the snapshot policy or runner changes. Future runs should inspect the current source, not treat a previous agent's interpretation as the code's behavior.

A later completed run avoided proposing a missing rubric but proposed starting the replay/transfer work already underway. It also described the explicit snapshot inventory as unavailable without inspecting it. Change: check the inventory at `.mining-snapshot.json` and the current-work record before deciding something is absent or unstarted. Hypothesis: representing active work alongside GitHub reduces duplicated investigations. This is a source-selection lesson, not a prescribed task title.


# FILE: packages/task-miner/README.md

# Task-mining experiment runner

This developer command runs fx through AI SDK Harness in a temporary Vercel Sandbox. It reads a repository snapshot and current GitHub issues/PRs through a fixed-repository host tool. It returns proposals for review. It is not the deployed Eve station or a scheduler.

From `apps/factory`, refresh the existing project's development credential:

```sh
vercel env pull .env.local --yes --scope demo-software-factory
```

From the repository root:

```sh
pnpm --filter @jira-clone/task-miner mine my-run
```

Run names cannot overwrite an existing directory. An optional prompt path and Git revision support replay:

```sh
pnpm --filter @jira-clone/task-miner mine old-context factory/mining/prompt.md 9f22e30
```

Without a revision, the snapshot includes tracked and untracked nonignored working-tree files, excluding deleted files, environment files, package archives and held-out mining evaluation/run artifacts. With a revision, source comes from that Git revision. `.mining-snapshot.json` identifies the available inputs. No Git checkout, local credentials or dependencies are copied into the sandbox. Hidden source files are included; inspect them explicitly when a glob omits them.

The runner refuses an absent, expiring or wrong-team/project OIDC token before starting a model run. The expected scope is `demo-software-factory`, project `adeo-factory-cockpit`; the model is `meta/muse-spark-1.3-contributor`. Explicit fx credentials avoid the developer's saved fx team, model and MCP configuration. The current adapter accepts the scoped OIDC bearer through its `AI_GATEWAY_API_KEY` record; this does not create a new key or use a personal account key.

GitHub Connect credentials stay on the host. The custom tool only performs GET requests for issues, pulls and issue comments in `software-factory-workshop/jira-clone`. Pagination must finish or the read fails. The model has read-only native permissions and instructions to stay within the repository. These instructions are not a formal egress allowlist. The runner only continues approval requests for its exact fixed-repository tool and validated input.

Each run records source hashes, exact prompt, document snapshot, GitHub evidence, model output, available usage, stop reason and team Gateway balances. Compare total-used before and after across a nonoverlapping experiment window; overlapping runs or unrelated team traffic prevent exact per-run cost attribution. Sandbox costs are separate. ACP native tool previews can be truncated and their names may fail adapter validation even when executed. Preserve those diagnostics instead of calling the trace complete.

A sandbox expires after five minutes. Session startup, generation and tool continuations have explicit timeouts, and continuation approval rounds are bounded. A paused, failed or GitHub-incomplete run exits unsuccessfully and is not a useful-result baseline. The adapter currently installs the current fx binary; package versions alone do not freeze that binary. Check compatibility when replaying.

Review the output with `factory/mining/evaluation.md`. It is deliberately held out from the miner along with past raw runs and comparison scores. The criteria exist even when those files are not in its snapshot; the miner should not propose creating them merely because they are withheld.


# FILE: .agents/friction-log/20260912094635-adeo-private-package/friction.md

---
title: 'ADEO private package requires a package-read credential'
severity: 'minor'
---

## Expected Behavior
A clean checkout installs the ADEO design-system package.

## Current Behavior
The existing GitHub CLI credential can create the repository but npm returns HTTP 403 for the private package because its token lacks package scopes.

## Possible Solution
Stage zero uses the existing v0.1.1 local package tarball under vendor. Later configure a read:packages credential and grant the consumer repository GitHub Actions package access.

## Minimal Reproducible Example
Request version 0.1.1 from the GitHub Packages scoped registry with a credential lacking read:packages.

## Context
No secret is stored in the repository. The vendored artifact makes the two stage-zero Nuxt deployments reproducible.


# FILE: .agents/friction-log/README.md

# Friction log

Friction hit while working in this repository, one directory per item:

```
<id>/
  friction.md   the write-up
  artifacts/    optional, whatever reproduces it
```

Reporting an entry gives it an owner. The write-up then carries an `issue:` link and mirrors what happens
to it. The whole directory is deleted once the friction is resolved. Every entry left here is still
outstanding, including friction in dependencies.

Do not maintain an index here. This directory is the index.

## Logging Friction

```sh
pnpx frog list    # what is already known
pnpx frog log     # add one
```

`pnpx frog log` writes the sections to fill in. Each id is when the friction was hit plus its title, so
the directory reads oldest-first.

Put anything that reproduces the friction in that entry's `artifacts/` and reference it from the
write-up. The next reader runs the reproduction instead of rebuilding it.

## For Agents

Add these rules near the top of `AGENTS.md`, under the appropriate section. Create the file if missing; otherwise amend it in place, preserve all existing content, and never replace the file.

- Log papercuts and friction (tooling, docs, APIs, tests, conventions) as you hit them with `pnpx frog log`.
- Do not add global, system, or internal friction.
- Run `pnpx frog list` first to see what is already known.

Managed by [Frog](https://github.com/wevm/frog).


# FILE: .agents/skills/adeo-nuxt-ui/SKILL.md

---
name: adeo-nuxt-ui
description: Install and use the ADEO Nuxt UI design system in Nuxt 4 applications, including its private package, ADEO components, theme overrides, and CI setup. Use for ADEO application work; this is not a Leroy Merlin or other Mozaic brand preset.
---

# ADEO Nuxt UI

Build with `@software-factory-workshop/nuxt-adeo-ds`, a Nuxt layer built on Nuxt UI 4 and Mozaic's ADEO preset. It supplies 22 composed ADEO components, Nuxt UI components, ADEO tokens and locally served Roboto fonts. The catalogue is a separate application.

## Integrate into the application

Inspect the app's package manager, Nuxt version, existing modules, CSS entrypoint and root component first. Preserve its routes and app-specific configuration. This package targets Nuxt 4.5.2+ within Nuxt 4, Vue 3.5+, and Node 22.19+ or 24.11+. Nuxt UI is pinned to 4.11.1 in the initial release. Do not migrate a non-Nuxt application implicitly.

The initial published version is `0.1.1`. Keep an existing consumer's version unless an upgrade is part of the task; check the package metadata and changelog before upgrading.

1. Follow [private package access](references/private-package.md) when registry authentication or CI access is not already configured.
2. Install using the app's package manager. For a new npm consumer:

   ```sh
   npm install @software-factory-workshop/nuxt-adeo-ds@0.1.1
   ```

3. Add the package to the existing layer list:

   ```ts
   // nuxt.config.ts
   export default defineNuxtConfig({
     extends: ['@software-factory-workshop/nuxt-adeo-ds']
   })
   ```

4. Wrap the existing root content in `UApp`, or retain the existing `UApp`:

   ```vue
   <!-- app/app.vue -->
   <template>
     <UApp>
       <NuxtLayout>
         <NuxtPage />
       </NuxtLayout>
     </UApp>
   </template>
   ```

The layer registers `@nuxt/ui`, imports CSS and fonts, and auto-imports components. Consolidate duplicate Nuxt UI registration and duplicate Tailwind/Nuxt UI CSS imports when integrating into an already themed app. Keep unrelated application CSS. No sibling Mozaic or design-system checkout is required.

## Build with the components

Use Nuxt UI's `UButton`, `UInput`, `UForm`, `UFormField`, `USelect`, `UTable`, `UModal`, `UTabs` and other `U*` components directly. They receive the ADEO theme and retain Nuxt UI 4 APIs. Do not invent parallel `AdeoButton` or `AdeoTable` components.

```vue
<template>
  <section class="space-y-6">
    <AdeoPageHeader title="Projects" description="Manage your team's projects.">
      <template #actions>
        <UButton icon="i-lucide-plus" to="/projects/new">New project</UButton>
      </template>
    </AdeoPageHeader>
    <AdeoEmptyState title="No projects yet" description="Create your first project.">
      <UButton to="/projects/new">Create project</UButton>
    </AdeoEmptyState>
  </section>
</template>
```

Before using a composed component, read [component choices and constraints](references/components.md). The installed package's `COMPONENTS.md` is the full API reference. Verify unfamiliar Nuxt UI APIs against the installed version or its official documentation.

## Preserve the ADEO theme

Use semantic colors (`primary`, `secondary`, `neutral`, `success`, `info`, `warning`, `error`) and utilities such as `text-highlighted`, `text-muted`, `bg-default`, `bg-elevated`, and `border-default`. Primary is ADEO teal `#007f8c`; secondary is ADEO purple. Green represents success. Do not substitute Leroy Merlin green or import another Mozaic brand preset.

Roboto, the token palettes, spacing basis and 2/4/6px radii are supplied by the layer. Use Lucide icons with `i-lucide-*` names. Change component defaults in the consumer's `app/app.config.ts`, preserving inherited ADEO colors unless the user explicitly requests a brand change:

```ts
export default defineAppConfig({
  ui: { button: { defaultVariants: { size: 'lg' } } }
})
```

Light mode is the reference. The optional dark mapping is a local adaptation, not an official Mozaic dark preset. This package adapts Mozaic to Nuxt UI; do not promise pixel-for-pixel parity with Mozaic SCSS.

## Verify the consumer

Run the application's existing typecheck and production build, or `npx nuxt typecheck` and `npx nuxt build` where appropriate. Check a rendered route for ADEO styling, working controls, and hydration or unresolved-component errors. Confirm that app actions navigate or update real state. Labels, validation and backend operations remain the application's responsibility.

For registry failures, use the targeted diagnosis in [private package access](references/private-package.md); do not remove authentication or switch the private package to public npm.

Sources: [package and installation guide](https://github.com/software-factory-workshop/nuxt-adeo-ds/tree/main/layer), [full component APIs](https://github.com/software-factory-workshop/nuxt-adeo-ds/blob/main/COMPONENTS.md), [Nuxt UI documentation](https://ui.nuxt.com/docs/getting-started), [Mozaic ADEO colors](https://mozaic.adeo.cloud/foundations/colours/adeo/).


# FILE: .agents/skills/adeo-nuxt-ui/references/components.md

# Component choices and constraints

Use the installed `@software-factory-workshop/nuxt-adeo-ds/COMPONENTS.md` file for exact APIs. With npm it is normally under `node_modules/@software-factory-workshop/nuxt-adeo-ds/`. Read the file directly; it is documentation, not a JavaScript package export. Source reference: [COMPONENTS.md](https://github.com/software-factory-workshop/nuxt-adeo-ds/blob/main/COMPONENTS.md).

## Choose the right primitive

| Need | Use |
| --- | --- |
| Buttons, inputs, cards, alerts, tables, modal dialogs | Native Nuxt UI `U*` components with the ADEO theme |
| Search suggestions | `UInputMenu` |
| Searchable select popover | `USelectMenu` |
| Page title and actions | `AdeoPageHeader` with `title`, optional `description` and `actions` slot |
| Empty results | `AdeoEmptyState` with `title`, optional `description` and default action slot |
| Metric and trend | `AdeoStatCard` with `label`, `value`, optional `detail`, `evolution`, `direction` and semantic `color` |
| Date, password, phone, quantity | `AdeoDatePicker`, `AdeoPasswordInput`, `AdeoPhoneInput`, `AdeoQuantitySelector` |
| Option cards or segmented views | `AdeoOptionGroup`, `AdeoSegmentedControl` |
| Form steps and persistent actions | `AdeoStepper`, `AdeoStepperBar`, `AdeoActionBar` |
| Section or sidebar navigation | `AdeoBuiltInMenu`, `AdeoSidebar` with Nuxt UI `NavigationMenuItem[]` |

Other composed components are `AdeoHeading`, `AdeoHero`, `AdeoLink`, `AdeoFlag`, `AdeoTag`, `AdeoLoader`, `AdeoFileUpload` and `AdeoRating`. All 22 are auto-imported by the layer.

## Avoid common integration mistakes

- `AdeoDatePicker` binds a string and uses native browser date/time UI. It is not a calendar widget taking a JavaScript Date.
- `AdeoPhoneInput` keeps the national number in `v-model` and ISO country code in `v-model:country`. It does not validate or convert to E.164.
- `AdeoQuantitySelector` binds a number. Default minimum is 0 and step is 1.
- `AdeoFileUpload` binds `File[]`, emits `reject(message)`, and preserves accepted files after a rejection. It does not upload files. The application supplies an upload endpoint and server validation.
- `AdeoOptionGroup` binds a string for single selection or `string[]` with `multiple`. Items have `value`, `label` and optional `description`, `icon`, `disabled`.
- `AdeoSegmentedControl` binds a string. Connect that value to the displayed content; the component does not switch content itself.
- `AdeoStepper` uses a zero-based numeric model. The parent validates and advances. `AdeoStepperBar` takes a zero-based `step` and emits `previous`, `next`, `cancel`.
- `AdeoActionBar` announces `busy`; the caller disables action buttons while submitting.
- `AdeoTag` has separate link, selectable, removable and plain modes. Use one mode at a time. The selection model is boolean; removal emits `remove`.
- `AdeoRating` accepts integer input from 0 to 5. Fractional values are for read-only display.
- `AdeoHero` renders an h2. Place it below the page's h1. `AdeoPageHeader` renders h1 by default and accepts `level="2"` as a numeric prop via `:level="2"`.
- `AdeoStatCard` trend direction and semantic status are independent. An increase need not be positive.

For upstream component props, use the [Nuxt UI 4 documentation](https://ui.nuxt.com/docs/components) or installed type declarations. Vue component models use `modelValue` and `update:modelValue` unless a named model is specified.


# FILE: .agents/skills/adeo-nuxt-ui/references/private-package.md

# Private package access

The package is hosted on GitHub Packages under `software-factory-workshop`. Access to this skills repository does not itself grant access to the design-system package.

## Developer machine

Add the scoped registry to the app's `.npmrc`, preserving existing settings:

```ini
@software-factory-workshop:registry=https://npm.pkg.github.com
```

A GitHub account with package access and a personal access token (classic) with `read:packages` is required. Authorize organizational SSO if applicable. Authenticate interactively with the GitHub username and the token as the password:

```sh
npm login --scope=@software-factory-workshop --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @software-factory-workshop/nuxt-adeo-ds@0.1.1
```

Use existing configured credentials when available. Do not ask the user to paste a token into chat or commit a token. Git/SSH access to the repository and npm package authentication are separate.

## GitHub Actions consumer

An administrator must grant the consuming repository read access under the design-system package's **Manage Actions access** settings. Then adapt the app's existing workflow:

```yaml
permissions:
  contents: read
  packages: read
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 24
      cache: npm
      registry-url: https://npm.pkg.github.com
      scope: '@software-factory-workshop'
  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Merge required permissions from the existing workflow. `packages: read` alone does not grant another repository access to this private package.

## Other CI providers

Store a classic token with `read:packages` in the provider's secret store as `NODE_AUTH_TOKEN`. Add this literal placeholder to npm configuration:

```ini
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Keep the scoped registry line too. The actual token stays in the secret store. Install with the committed lockfile.

## Diagnose access failures

- Requests to `registry.npmjs.org`: the scoped registry setting is missing or overridden.
- HTTP 401: authentication is missing or invalid.
- HTTP 403: check token scope, SSO and package permissions.
- HTTP 404 for a known private package: verify authenticated access and the requested version; GitHub can hide inaccessible packages.
- GitHub Actions failure despite `packages: read`: check **Manage Actions access** for that specific repository.
- An already-installed `UApp` or duplicated module is not an authentication issue; inspect Nuxt configuration separately.

Report the concrete missing access if it requires an administrator. Continue work that does not depend on that access, but do not claim a successful installation until it has been tested.

Reference: [GitHub npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).


# FILE: AGENTS.md

# Working in this repository

- Run `frog list` before guessing at tooling workarounds. Log repository friction with `frog log`; never log global or internal-system issues here.
- The primary product is the growing Eve factory. Jira is its test subject.
- Read `.mining-snapshot.json` when present for available files and exclusions. Read `factory/context/work-in-progress.md` alongside live issues to check active work. Read `factory/context/goal.md` for current direction and `factory/context/project-map.md` for source navigation. The deployed apps remain stage zero. A developer-run, read-only task-mining experiment is authorized; a deployed Eve workflow and product implementation are separate steps.
- Both apps extend the ADEO Nuxt UI layer. Read the included adeo-nuxt-ui skill before UI work.
- Do not present fixtures, browser-local drafts, planned capabilities or model assertions as verified runs.
- Run `pnpm typecheck`, `pnpm test` and `pnpm build` before publishing. Verify changed routes in a browser.
- Factory rule changes must be reviewed before activation; a candidate cannot change the rules judging itself.


# FILE: README.md

# ADEO Jira factory

Grow a software factory with Eve, using an ADEO-branded Jira demo as its test subject. The factory is the workshop outcome. Jira gives us concrete work and product feedback with which to improve it.

**Deployed stage: 00 — a place to begin.** The cockpit has no agent execution. A separate developer-run task-mining experiment is being evaluated; see [the factory goal](factory/context/goal.md).

## Review the starting point

- Factory cockpit: https://adeo-factory-cockpit.vercel.app
- Jira shell: https://adeo-jira-clone.vercel.app
- Both applications use the ADEO Nuxt UI layer v0.1.1.

The cockpit has browser-local request drafts, starter prompts, project knowledge and the factory growth path. “Review in GitHub” opens a prefilled issue; the user decides whether to submit it. Draft storage is local to a browser, not shared team state. GitHub repository context uses Vercel Connect when installed.

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
| `apps/factory` | Nuxt cockpit; home for requests and project context |
| `apps/jira` | Nuxt Jira demo shell |
| `packages/project-context` | Shared stage definitions, references and labelled fixtures |
| `factory` | Goal, project context, reflections and mining experiments |
| `packages/task-miner` | Isolated AI SDK Harness/fx experiment runner |
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

Read [the cockpit scope](docs/cockpit.md) and [the growth experiment](docs/factory-growth-experiment.md). Review the mining evidence before implementing a cockpit workflow.


# FILE: docs/cockpit.md

# Stage-zero cockpit

The first cockpit should let us express useful work, inspect the context available to the factory, and see what capability we are growing next.

## Initial features

| Feature | Why it earns its place now | Current behavior |
| --- | --- | --- |
| Work requests | A stable work object can later connect attempts and decisions | Title, brief, local save/reopen, starter examples |
| GitHub connection | Work and factory changes should have a shared repository home | Connect for read-only repository context; issue composition opens GitHub for human submission |
| Project knowledge | We must inspect what the factory knows before judging its output | Brief, ADEO guidance, observed Jira metadata, research rationale |
| Factory growth | Make the workshop's learning progression explicit | Stage zero current; five future capabilities visibly planned |
| Product link | Keep domain feedback close to factory work | Open the ADEO Jira shell and inspect synthetic issues |

Do not show run counts, traces, spend, approvals, evaluation scores or verified badges until those capabilities exist. A browser-local draft is not a shared work order. An issue's existence is not evidence that an agent ran.

## Planned evolution: asynchronous task mining and proposals

Product direction recorded on 12 September 2026: the **“Start with a concrete problem”** starter-card area should become a task-mining and proposal surface.

A background workflow should discover candidate work from the project's available sources and propose useful tasks asynchronously. The cockpit should let the user review those proposals when ready, without waiting for mining to finish in an interactive request.

Proposed flow: **mine signals → form task proposals → review, refine or dismiss → accept into the work queue**. Each proposal should explain the suggested outcome, why it matters, and the source evidence behind it. Accepting a proposal should create a work request; execution remains a separate step.

The current static examples are the stage-zero placeholder for this capability. This is now the first factory experiment; see [the current goal](../factory/context/goal.md). A developer-run mining experiment is separate from the deployed cockpit, which still shows static examples. Source selection, triggers or cadence, and proposal deduplication remain design decisions.

## Research basis

Sources inspected in `/Users/remiconnesson/knowledge-work/software-factories`:

- `research/ui-report/report.md`
- `exploration-app/content/guide/factory-uis.md`
- `research/histories/evi/course.md`

The UI comparison suggests keeping one work object across attempts, showing specific reasons for human attention, and placing evidence next to decisions. AI SDK Factory informs the work/attempt relationship, Mastra the attention view, Vercel Factory the plan/evidence relationship, and Devbox continuity between conversation and change inspection. These are design interpretations from the research, not claims that this starter implements those systems.

## What waits for a backend

The first planned Eve station mines tasks from the goal, repository and current issues, then leaves proposals for review. We are testing its context and output with a developer-run experiment first. Add a run workspace and durable proposal records when that behavior has been established. Later capabilities may introduce work-order admission, bounded edits and verification.

For GitHub tools, use [Vercel Labs github-tools](https://github.com/vercel-labs/github-tools), including `@github-tools/eve-extension`, with the Connect connector. Check the installed extension and Eve versions before integrating; the historical Evi example in the research is not a current API contract. Start with the operations the stage actually needs. There is no inbound GitHub webhook or agent execution in stage zero.

## Review together

1. Open a starter request, edit it and save. Reload and reopen it.
2. Open project knowledge. Is the distinction between observations and assumptions clear?
3. Inspect the Jira list, board and issue details. Use these to give taste and product feedback.
4. Read the stage-one description. Agree on one capability and one observable acceptance case.

The workshop succeeds if we can show why the factory improved and whether that improvement transfers to different work.


# FILE: docs/factory-growth-experiment.md

# Grow the factory; use Jira to test it

The primary deliverable is a project-owned Eve factory that becomes more capable through observed work and measured improvements. The ADEO Jira demo supplies useful requests, realistic integrations and a product owner with strong judgment. Its feature count is not the success metric. This document governs preparation and workshop sequencing where earlier plans prioritize application readiness.

Start with an empty product scaffold and the smallest runnable factory. Prepare dependencies, credentials, sandbox access and known reference fixtures, but do not require a completed Jira application or all identity integrations to begin. Keep product and factory source together. Record the factory version, input, candidate version, results and human interventions for each run.

The repeated experiment is:

```text
give the current factory a bounded Jira request
 -> observe its decisions and artifacts
 -> inspect the result with Remi
 -> identify a specific factory limitation, if one appeared
 -> change the relevant instruction, skill, tool, environment or check
 -> rerun the case and try a different related request
 -> retain the improvement when evidence supports it
```

Some failures are product bugs or environment problems. Classify them before changing the factory. Do not add a specialist or a new abstraction for every failed run. A change can remove unnecessary factory logic. When the run already succeeds, test a harder request before inventing a limitation.

1. The factory understands enough to propose useful work.

The current milestone is task mining, as agreed in [the goal](../factory/context/goal.md). Start with one bounded read-only investigation of the goal, source and current GitHub issues and PRs. It returns supported proposals or an explicit reason that more context is needed. It may not write product code or publish tasks.

Use the same small prompt before and after a context change, then try a differently worded request in a fresh session. Judge evidence, relevance, duplicate checks, bounded outcomes and the quality of reflection. Retain raw outputs and record manual interventions. The initial AI SDK Harness/fx runner is an experiment for growing context; an asynchronous Eve station comes after its output is useful.

Request-to-work-order admission remains a possible later capability. The previous plan to start by admitting an ADEO issue-list request has been superseded by task mining. Do not count the existence of a runner as proof that mining is useful.

2. The factory learns the project's expectations.

Load the existing ADEO skill and a short project brief. Ask Remi to assess the proposed behavior and, once a preview exists, its usability. Convert recurring feedback into examples, constraints or checks. Keep subjective review explicitly human where it cannot yet be tested reliably.

Replay the original request and a different one, such as issue details. Evidence of improvement is that relevant guidance carries over and fewer repeated corrections are needed. Avoid a growing transcript dump or a check tailored only to one screen.

3. The factory can produce a bounded candidate.

Add isolated implementation and a fixed set of check commands. A single worker is enough initially. Feed it the supported work order, repository revision and relevant skills. It returns a diff or candidate commit, actual command outcomes and unresolved items. The implementation checkout does not receive publication authority or permission to activate changed factory rules.

Use a very small issue list or create-issue action as the first task. The initial application may use explicitly labeled fixtures. Persisted behavior becomes a later request when needed to test a new capability. Keep fixture rendering and functional integration claims distinct.

4. The factory can reject its own bad work.

Add a fresh verifier only when there is a candidate to inspect. Keep trusted acceptance checks pinned independently of the editable candidate. The verifier can run the UI/API behavior, inspect scope and return structured findings; the controller determines whether required checks and evidence permit proceeding.

Use a prepared defective candidate, clearly labeled as an injected test case: for example, an issue edit appears to save but disappears after reload. Assert that the factory rejects it. Change the candidate revision and assert that the old verification result no longer applies. Different context alone is not proof of correctness.

5. The factory improves from failure and feedback.

Send actionable findings into a bounded correction round. Persist the work order and evidence so the next run does not require reconstructing the conversation. Test the correction on the original request, then a related request that was not used to tune the fix.

As the Jira product grows, use identity and integrations to expose more consequential cases: MCP invents an author ID, a viewer writes through an alternate endpoint, or a deactivated user retains access. Add protocol adapters and authorization checks in response to these cases. Passport, Connect, MCP Toolkit, SAML and directory sync remain product targets; completing all of them is not a prerequisite for demonstrating factory learning.

6. The factory can continue work under explicit limits.

Interrupt one run and resume it. Record stable task/run references and test duplicate-effect handling. Configure bounded elapsed time, correction rounds and spend before unattended execution. Add task state beyond Eve's session record only when the observed recovery case requires it.

The exit evidence is a coherent continued task and no duplicate publication. This is an advanced checkpoint for the workshop, not machinery to build before the first request.

For every growth step, retain an experiment record:

| Field | What to record |
| --- | --- |
| Request and expectation | Exact input and outcome agreed before the run |
| Versions | Factory revision, target base/candidate SHA, suite/fixture version, model/settings |
| Before | Observed limitation with artifact or trace |
| Change | Smallest relevant factory change and its reason |
| Replay | Actual outcome on the original case |
| Transfer | Outcome on a related new case |
| Human effort | Corrections, manual interventions and approximate time |
| Cost and limits | Available usage measurements, elapsed time and stop reason |
| Conclusion | Improved, regressed, inconclusive or environment-blocked |

One successful rerun is a useful observation, not statistical proof. Keep cases repeatable, distinguish model variation from the factory change, and expand evaluation only when needed. Raw traces and test artifacts carry more weight than the agent's self-assessment.

The human/Codex development session initially builds and repairs the factory. The Eve factory performs the product task so there is real execution evidence. If we manually patch the product to unblock a session, record that intervention. Later the factory can propose a change to its own definition through a reviewed PR; it cannot activate new permissions or verification criteria during the run judging that proposal.

The three-hour onsite core should begin with task mining and project knowledge, then grow bounded implementation and verification as time permits. Use the additional 30–60 minutes for a feedback-to-eval loop and recovery. Each checkpoint packages a factory capability, its test cases and just enough Jira code to exercise it. Checkpoint names should follow the factory capability rather than Jira feature names.

Research basis: the [AI SDK Factory history](/Users/remiconnesson/knowledge-work/software-factories/research/histories/ai-sdk-factory/outline.md) records small classification/reproduction tasks preceding the larger orchestration system. The [factory engineering discussion](/Users/remiconnesson/knowledge-work/software-factories/research/slack/brain-lars/software-factory-thinking.md) emphasizes observing blocked/flawed work and improving its cause. These inform this proposed experiment; they do not establish that this ADEO factory has been implemented or evaluated.


# FILE: docs/verification.md

# Stage-zero verification

Checked 12 September 2026.

- `pnpm check`: typechecks, draft-boundary test and both production builds pass.
- Initial GitHub Actions workflow passes installation, typechecks, test and builds.
- Browser: starter request populates title and brief; save survives reload; saved request reopens.
- Browser: project knowledge and factory growth navigation render the expected context and current/planned stages.
- Browser: Jira issue details open/close; search handles an empty result and clearing; board renders all four statuses; status filtering selects the single In Progress fixture.
- Browser: fresh cockpit navigation has no hydration warnings after deferring the connection check until mounted. Jira navigation has no captured browser warnings/errors.
- GitHub: `github/jira-clone` is installed and attached to the cockpit. SDK token exchange followed by a read of the fixed repository returned HTTP 200. No token is returned to the browser.
- Deployment: both projects are linked to the private GitHub repository. Team policy requires Git-origin production deployments; CLI-origin attempts are blocked before build.

This does not verify stage-one agent behavior, issue mutations, Jira API compatibility, application accounts, SAML, directory sync, Jira MCP or demo integrations. They are not implemented in stage zero. The team's platform Passport protection is separate from Jira application accounts.

## Hosted result

Application revision `8308ea9` passed GitHub Actions and both Git-origin production deployments reached Ready.

- https://adeo-factory-cockpit.vercel.app — authenticated HTTP 200; rendered cockpit heading and Nuxt assets present.
- https://adeo-jira-clone.vercel.app — authenticated HTTP 200; rendered issue-list heading and Nuxt assets present.
- Cockpit `/api/github` — HTTP 200, `state: connected`, private repository `software-factory-workshop/jira-clone`, branch `main`.

The unauthenticated browser entry redirects to Vercel authentication. Hosted requests were checked using the Vercel CLI authenticated protection bypass; this does not verify an end-user Passport sign-in flow. Interactive controls and console warnings were checked in the local browser against the same application source.


# FILE: factory/README.md

# The factory grows here

Start with [the current goal](context/goal.md), then use [the project map](context/project-map.md) to inspect the relevant code and evidence.

The deployed cockpit and Jira demo are stage-zero applications. The current development experiment is task mining: understand the goal, current code and GitHub work, then propose useful tasks and reflect on missing context. A manually invoked AI SDK Harness/fx runner is being evaluated before adding an asynchronous Eve station to the cockpit. Request-to-work-order admission is a later candidate, not the immediate milestone.

The factory's project instructions, tools, context, evaluations and reviewed lessons belong in this repository. Keep raw runs and evaluation material separate from the context supplied to a fresh agent. Do not feed a run its expected answer.

- `context/`: current goal and source navigation.
- `reflections/`: reviewed observations and hypotheses, with provenance and limits.
- `mining/`: experiment prompt, evaluation criteria, recorded runs and comparison.
- `../packages/task-miner/`: developer experiment runner. It is not a deployed agent service.

GitHub credentials come from Vercel Connect (`github/jira-clone`). The experiment reads only this repository. For the eventual Eve station, assess the official Vercel Labs github-tools integration against the selected Eve release. A working connector does not imply inbound webhooks, agent execution or issue publication.


# FILE: vendor/README.md

# ADEO design-system artifact

Private package `@software-factory-workshop/nuxt-adeo-ds`, version 0.1.1. Copied from the existing design-system checkout output for the stage-zero workshop bootstrap. Both applications extend this Nuxt layer.

Source: https://github.com/software-factory-workshop/nuxt-adeo-ds

SHA-256: `f0146d2666651c65e190f33781ee7f2020eb3318b9147d69766dba6ac7113ea7`

This repository must remain private. Once registry access is configured, replace the file dependency with the exact package version and regenerate the lockfile.

