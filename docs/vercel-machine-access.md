# Vercel machine access

Verified on 12 September 2026 using the cockpit project's existing development OIDC identity and the same `readVercel` implementation as the native Eve tool. No model run was needed for these access checks.

The API-key connector `factory/jira-clone-machine`, ID `scl_E1SPeKlMXo2stzx5GrYHlw`, stores a dedicated Vercel token scoped to `demo-software-factory`. It expires on 12 October 2026. The token can access projects in that team; the host tool narrows requests to the cockpit and Jira projects and exposes GET operations only. It is not a provider-issued read-only token.

Only `adeo-factory-cockpit`, ID `prj_ZXLHFUJhgo5EdvSf1IstOMn0ft0A`, is attached to the connector, for production, preview and development. Credential retrieval and Vercel requests run on the host; the token is not passed to the agent's Sandbox. Rotate the stored credential before expiry without changing its UID or putting it in source, prompts or browser code.

## Live evidence

| Project | Read | Result |
| --- | --- | --- |
| Cockpit | Project metadata | Passed, 12:24:09 UTC |
| Cockpit | Deployments | Passed, 19 records, 12:24:10 UTC |
| Cockpit | Build events | Passed, latest 100 events from `dpl_7DMQ9yRGYvWXFjsGCn6ScjunmKW5` |
| Jira | Project metadata | Passed, 12:24:31 UTC |
| Jira | Deployments | Passed, 19 records, 12:24:31 UTC |
| Jira | Build events | Passed, latest 100 events from `dpl_5qzvnwSPVuvLe9vCCSJEyBRyhsY4` |
| Both | Runtime stream | Timed out at the 20-second request deadline; no successful runtime-log evidence |

The runtime endpoint follows the official SDK contract, but the two live requests did not finish within the deadline. Do not interpret that as empty runtime logs or infer a successful runtime connection from passing project/build reads. A run records this timeout as an explicit context gap. Hosted agent execution and proposal quality need their own run evidence.

## Credential setup

The API-key connector replaces the attempted user-only `vercel/jira-clone` MCP connection. `getToken('factory/jira-clone-machine', { subject: { type: 'app' } })` succeeds without a viewer authorization flow.

The management CLI could not mint the dedicated token: the official token-creation endpoint returned `403 Cannot create tokens for this app`. The token was created through the Vercel account UI with the demo team scope and entered directly into the Connect credential form. Its value was not printed or placed in repository files.

After the hosted replacement produced findings and opened a draft, the older MCP connector's cockpit link was detached. The CLI returned `detached: true`; the connector itself still exists with no project attachments. Machine, GitHub and Passport connector attachments were rechecked and unchanged.
