# Stage-zero verification

## Task-mining station — 12 September 2026

The Eve station supersedes the historical stage-zero execution status below. Local verification during delivery:

- Nuxt and authored-agent typechecks pass; all eight tests pass (draft storage, GitHub input/scope/snapshot boundaries and safe report rendering).
- Both Nuxt production builds and `eve build` pass. CI now compiles the Eve agent as well as the apps.
- A real local Eve session, `wrun_01M2AJWVK77NMP6T3QCMZT0J80`, completed the shared fx miner in 130 seconds. It read revision `b555eb05312e577e289c7046eb28f69bb91317a1`, supplied 45 source files and completed both GitHub inventories (zero issues, zero PRs).
- Browser replay restored the completed report after restarting the local server. A second browser-started session, `wrun_01M2AKBJPQ2PSQ2CBDC5VDHMNH`, resumed the same active sandbox investigation after reload. “Use findings in a draft” populated and focused the existing request editor with findings and provenance.
- The model proposed a concrete demo-scope document, stage-copy alignment and fx provenance. Stage-copy alignment is part of this current delivery; that run inspected the preceding commit. These are proposals, not owner-approved work.
- Explicit H3 1 imports fix Nuxt/Eve helper type collisions. Prebundling `eve/vue` fixes the dev-only CommonJS OIDC import that prevented hydration. Both friction entries were resolved after verification.

- The second browser run was stopped during its sandbox phase. Eve emitted `turn.cancelled`, the cockpit settled to Stopped, and no report was presented as complete.

Initial hosted verification: revision `14dae90` passed CI and deployed Ready, and the signed-in browser created session `wrun_41M2AKG76A0GH9FWYTZ7XZ476Z`. The run failed safely during sandbox startup because the bundle omitted ACP bridge assets. `build:agent` now copies and byte-checks those four assets; the successful hosted rerun is recorded below after deployment.

## Historical stage-zero checks

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
