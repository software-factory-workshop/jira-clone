---
title: 'Factory production build fails in Eve SWC step transform'
severity: 'major'
---

### Expected Behavior

`pnpm build` should build the factory application and its three Eve root-agent bundles from the current `main` tree.

### Current Behavior

On `main` at `cc0c67d`, `pnpm --filter @jira-clone/factory build` fails while bundling the reviewer output. The Eve SWC workflow plugin reports: `Classes using "use step" methods must be declared at the top level of the module, not inside a function.`

The same failure reproduces twice on the untouched baseline tree and is independent of the documentation changes. The Jira Nuxt build completes before the factory failure.

### Possible Solution

Investigate the Eve/SWC generated bundle and restore a clean factory production build without weakening the step registration checks.

### Minimal Reproducible Example

Run `pnpm --filter @jira-clone/factory build`. The generated error points to `.eve/dev-hosts/*/nitro/dev/index.mjs`, in the `wakeUp` method containing `"use step"`. The captured baseline log is `/tmp/jira-clone-factory-baseline-build.log`.

### Context

This blocks a clean root production build. It is separate from the documentation correction and needs its own factory build investigation.
