# Read-only Jira MCP delivery

This is the first real integration slice after the REST adapter. It makes the Jira app discoverable through Nuxt MCP Toolkit without claiming Jira authentication, write parity or Atlassian Connect parity.

The worker may publish these integration changes together:

- `apps/jira/package.json`: add exactly `@nuxtjs/mcp-toolkit: 0.21.0` and `zod: 4.6.1`, alongside the existing exact Jira test script.
- `apps/jira/nuxt.config.ts`: add `modules: ["@nuxtjs/mcp-toolkit"]` and `mcp: { name: "ADEO Jira Demo", version: "0.1.0" }` immediately after the existing ADEO design-system `extends` entry.
- `pnpm-lock.yaml`: preserve all existing importer, package and snapshot blocks byte-for-byte. Add the `apps/jira` importer entries and the package and snapshot blocks required by the pinned toolkit closure. A normal pnpm regeneration can rewrite unrelated peer blocks; those rewrites are rejected by the host policy.

The MCP surface is deliberately read-only and bounded. The worker should expose the stable Jira contracts already documented in [`jira-rest-adapter.md`](./jira-rest-adapter.md): current user, project, statuses, one issue, a bounded issue list, comments and allowed transitions. Pagination must stay bounded, JQL must stay out of the first slice, and no write tool or authorization claim belongs in this delivery.

The reviewer checks the package and config policy against the exact PR base, runs the frozen install and repository checks, and records any missing protocol or browser evidence as a limitation. A passing review proves this integration slice only; it does not prove OAuth, Vercel Connect installation, Passport-derived accounts, SAML, SCIM or complete Jira API parity.
