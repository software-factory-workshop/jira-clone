# What we are growing

Owner: Remi, Vercel solutions architect. Working direction agreed in the development conversation on 12 September 2026. Review this document when that direction changes.

The primary outcome is a software factory that we can grow and explain in a 3–4 hour onsite workshop with Eve at ADEO. The ADEO-branded Jira demo is the factory's test subject and a useful tool for Remi's demos. Shipping more Jira features alone does not demonstrate factory progress.

## Current experiment

Start with a task-mining station focused on understanding the goal, codebase, existing issues and relevant evidence. Run it asynchronously so a person can return to review proposals. First establish that a bounded invocation returns useful work; then build the cockpit experience around the observed needs.

The initial manual AI SDK Harness/fx calibration is complete. Remi then authorized shipping it as an Eve agent wired to the cockpit. The current station uses that shared sandbox miner, pinned GitHub source, current issues/PRs, durable sessions and human review. See `factory/task-mining-station.md` for the implemented contract and `docs/verification.md` for dated verification. The Jira application remains a fixture shell. Mining itself does not implement proposals or publish issues.

A useful proposal connects a present gap to the goal, checks what already exists, names a small outcome and explains how we would tell whether it helped. It can be a context improvement, an investigation or a bounded factory capability. A Jira task is justified when it tests or teaches something relevant to the factory now. There is no required proposal count, and no task is preferable to invented work.

The near-term question is: can a fresh agent understand enough of this project to suggest work Remi would seriously consider, without reconstructing the conversation for it?

## Product direction and open choices

The demo should have recognizable Jira issue, list and board behavior using the ADEO Nuxt UI design system. Eventual targets include the Jira API operations needed by demos, Vercel Connect, Jira MCP using MCP Toolkit, accounts derived from verified Passport identity, SAML and directory sync. The exact compatibility subset and identity behavior need concrete demo scenarios before implementation. The earlier phrase "feature parity" is not evidence of a complete, agreed endpoint specification.

The first station uses on-demand investigations, a pinned main-branch snapshot, live GitHub work and a durable Eve result. Recent session links and editable request drafts are browser-local. Scheduled mining, shared proposal indexing, automated deduplication and promotion of reviewed reflections remain design choices.

## Learning and authority

Keep the goal, project map and reviewed reflections in this repository. A run's observations are evidence; its recommendations are candidates. Remi owns priorities and product taste. The development session may propose context changes and test them, but a mining run cannot change its own instructions or the criteria used to judge it.

Preserve uncertainty. Separate owner decisions, source observations and model hypotheses. Record the sources and date of a reflection and what would invalidate it. Recheck changing facts such as issues and code before carrying a previous proposal forward.

Use this current goal when an older roadmap or UI string still describes request-to-work-order admission as the immediate next step. Those later capabilities remain possible; the current learning experiment is task mining.
