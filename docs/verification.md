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
