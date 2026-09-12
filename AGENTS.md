# Working in this repository

- Run `frog list` before guessing at tooling workarounds. Log repository friction with `frog log`; never log global or internal-system issues here.
- The primary product is the growing Eve factory. Jira is its test subject.
- The deployed task-mining station uses native Eve. fx belongs to the separate sandbox experiment for testing context and capabilities, not the production agent loop.
- Clarify consequential architecture or scope ambiguity before lengthy implementation or repeated troubleshooting. Delegate bounded work and use cheap, hypothesis-driven Muse validation; optimize total effort rather than avoiding model calls.
- Read `.mining-snapshot.json` when present for available files and exclusions. Read `factory/context/work-in-progress.md` alongside live issues to check active work. Read `factory/context/goal.md` for current direction and `factory/context/project-map.md` for source navigation. Task mining investigates and proposes. Explicit worker requests authorize a bounded implementation and draft PR; reviewer requests authorize an independent assessment of the exact PR head. Neither station can merge or activate factory-rule changes.
- Both apps extend the ADEO Nuxt UI layer. Read the included adeo-nuxt-ui skill before UI work.
- Do not present fixtures, browser-local drafts, planned capabilities or model assertions as verified runs.
- Run `pnpm typecheck`, `pnpm test` and `pnpm build` before publishing. Verify changed routes in a browser.
- Factory rule changes must be reviewed before activation; a candidate cannot change the rules judging itself.
