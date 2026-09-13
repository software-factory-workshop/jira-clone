# CI and authenticated Eve deployment verification

Eve 0.52.5 prepares Sandbox templates during a Vercel build when a sandbox has bootstrap code or seed files. That step creates or reuses platform resources and requires project OIDC. Setting `VERCEL=1` in a GitHub runner selects the Vercel backend but does not supply that identity.

CI keeps typechecks, tests, ordinary builds and a credential-free Nuxt Vercel-output route check. The generated route configuration must preserve both `/eve/v1` and `/factory/stations` through the Eve service.

The actual Vercel cockpit service runs `build:agent` with its platform-provided OIDC token. After Eve finishes template preparation and compilation, the build script checks that deployment configuration and the Workflow function exist and that no fx/ACP bundles leaked into the output. A failure stops that deployment.

GitHub CI then reads the exact tested head commit's Vercel statuses with the automatically issued, read-only `GITHUB_TOKEN`. Both the cockpit and Jira projects must report success with deployment links under `demo-software-factory`. A missing, failed, blocked or timed-out deployment fails the check. Pull requests use their head SHA because that is the revision Vercel builds; local CI still tests GitHub's merge checkout.

No Vercel credential is copied into GitHub secrets. In particular, do not store a pulled `VERCEL_OIDC_TOKEN` as a static secret or bypass template initialization to make an unauthenticated artifact build pass.

This proves successful platform deployment for that revision. Agent behavior, proposal quality, browser interactions and protected-route authentication still require their own run evidence. Vercel preview authorization must be granted through the existing project process for a new contributor; CI does not silently skip the deployment requirement.

The installed Eve deployment guide, `eve/docs/guides/deployment/vercel.mdx`, documents sandbox prewarming and its deployment-blocking failure behavior. The motivating failure was GitHub Actions run `34705978918` on `95360ebaeb14996ccb9319489767772ab7e91d61`: local checks passed, the synthetic Vercel build lacked OIDC, and the real Vercel deployments succeeded.
