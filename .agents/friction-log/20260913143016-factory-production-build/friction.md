---
title: 'Stale Eve dev-host artifacts poison the local factory build'
severity: 'minor'
---

### Expected Behavior

`pnpm build` should build the factory application and its three Eve root-agent bundles after local Eve development sessions.

### Current Behavior

After an earlier Eve development session leaves ignored generated files under
`apps/factory/.eve/dev-hosts`, `pnpm build` fails while Nuxt's Workflow/SWC
plugin scans those already compiled Nitro host bundles. It reports:
`Classes using "use step" methods must be declared at the top level of the module, not inside a function.`

The committed source is not the cause. On `main` at `6b12e83`, removing the
stale `apps/factory/.eve/dev-hosts` directory made the same `pnpm build` pass;
GitHub Actions run `34760041557` also passed on that SHA from a clean checkout.

### Possible Solution

Make the local build boundary clean or isolated so stale Eve development
artifacts cannot be fed back into Nuxt's Workflow/SWC transform. Keep the
step-registration checks enabled.

### Minimal Reproducible Example

With stale generated output present, run `pnpm --filter @jira-clone/factory build`.
The error points to `.eve/dev-hosts/*/nitro/dev/index.mjs`, in a generated
method containing `"use step"`. Remove the ignored `apps/factory/.eve/dev-hosts`
directory and rerun the command; it passes. The original failure log is
`/tmp/jira-clone-factory-build.log`.

### Context

This is local generated-state hygiene, separate from the documentation
correction. Vercel and clean CI builds use the service-specific or clean
checkout paths and are not blocked by this stale state. The local build should
still be made resilient so developers do not receive a false source failure.
