# Working in this repository

- Run `frog list` before guessing at tooling workarounds. Log repository friction with `frog log`; never log global or internal-system issues here.
- The primary product is the growing Eve factory. Jira is its test subject.
- Current scope is stage zero: deployed Nuxt UI shells, reviewable request drafts and source-backed context. Do not add agent execution until stage one is requested.
- Both apps extend the ADEO Nuxt UI layer. Read the included adeo-nuxt-ui skill before UI work.
- Do not present fixtures, browser-local drafts, planned capabilities or model assertions as verified runs.
- Run `pnpm typecheck`, `pnpm test` and `pnpm build` before publishing. Verify changed routes in a browser.
- Factory rule changes must be reviewed before activation; a candidate cannot change the rules judging itself.
