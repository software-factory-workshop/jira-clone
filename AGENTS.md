# Working in this repository

- Run `frog list` before guessing at tooling workarounds. Log repository friction with `frog log`; never log global or internal-system issues here.
- The primary product is the growing Eve factory. Jira is its test subject.
- Read `.mining-snapshot.json` when present for available files and exclusions. Read `factory/context/work-in-progress.md` alongside live issues to check active work. Read `factory/context/goal.md` for current direction and `factory/context/project-map.md` for source navigation. The deployed apps remain stage zero. A developer-run, read-only task-mining experiment is authorized; a deployed Eve workflow and product implementation are separate steps.
- Both apps extend the ADEO Nuxt UI layer. Read the included adeo-nuxt-ui skill before UI work.
- Do not present fixtures, browser-local drafts, planned capabilities or model assertions as verified runs.
- Run `pnpm typecheck`, `pnpm test` and `pnpm build` before publishing. Verify changed routes in a browser.
- Factory rule changes must be reviewed before activation; a candidate cannot change the rules judging itself.
