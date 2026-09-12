# What we are growing

Owner: Remi, Vercel solutions architect. Working direction agreed in the development conversation on 12 September 2026. Review this document when that direction changes.

The primary outcome is a software factory that we can grow and explain in a 3–4 hour onsite workshop with Eve at ADEO. The ADEO-branded Jira demo is the factory's test subject and a useful tool for Remi's demos. Shipping more Jira features alone does not demonstrate factory progress.

## Current experiment

### Current owner instruction, 12 September 2026

Grow an API-controlled factory that builds the Jira teaching application. The development session may change the factory, its context, publication policy and verification tools. Jira implementation changes must be authored by the native Eve worker and published as PRs. The current assignment is a stateful teaching slice: seeded issues, editable priority, assignee filtering and a reproducible save path with failure cases. Comment permissions follow once that foundation exists. Fixtures are acceptable when labelled; a static shell does not prove a persistence exercise.

Everything the cockpit UI can do must also be possible through authenticated APIs. The UI and API clients must share saved drafts, proposal feedback and run references. Reuse Eve for execution, streams, controls and durable owners. Add a small explicit build/review/revise loop, preserving one writer per branch and child PRs for separate contributors. Missing review evidence must remain a stopping condition, not something the model can remove to obtain approval.

The owner has authorized integrating reviewed progress into main. This authority belongs to the development session; factory workers and reviewers still cannot merge or activate their own policy changes. Keep main current as factory increments are verified. The sections below preserve the earlier mining experiment and its evidence; they do not override this current delivery direction.

Start with a task-mining station focused on understanding the goal, codebase, existing issues and relevant evidence. Run it asynchronously so a person can return to review proposals. First establish that a bounded invocation returns useful work; then build the cockpit experience around the observed needs.

The initial AI SDK Harness/fx experiment tested whether the agent received useful context. It remains an experimental runner, separate from the deployed station. Remi clarified that shipping means a native Eve investigator: Eve runs the model and its sandbox tools directly. There is no nested fx model loop.

Context means more than documentation. The investigator needs the goal and active work, current GitHub evidence, a runnable pinned codebase and access to the relevant Vercel project evidence. We must distinguish having access from using it correctly, and a completed run from a proposal Remi would actually consider. See `factory/task-mining-station.md` for the execution contract and `docs/verification.md` for dated evidence. The Jira application remains a fixture shell. Mining itself does not implement proposals or publish issues.

A useful proposal connects a present gap to the goal, checks what already exists, names a small outcome and explains how we would tell whether it helped. It can be a context improvement, an investigation or a bounded factory capability. A Jira task is justified when it tests or teaches something relevant to the factory now. There is no required proposal count, and no task is preferable to invented work.

The near-term question is: can a fresh agent understand enough of this project to suggest work Remi would seriously consider, without reconstructing the conversation for it?

## Establish the task before proposing work

Treat the user's focus as a desired outcome to understand, not as an instruction to build whichever missing capability is easiest to spot. Establish who needs the result, what decision or demo it should support, the smallest useful outcome, and the constraints already decided. State any consequential ambiguity explicitly; do not fill it with a large architecture choice.

Connect each proposed task to the evidence needed for that outcome. Documentation explains intent and decisions. Code shows what is implemented. Current issues and the work-in-progress record show what is already underway. A command checks a specific behavioral claim. Vercel evidence establishes what revision is deployed and what that deployment observed. Having one of these sources does not substitute for the others.

A missing source is worth proposing work on only when it prevents a relevant decision or reproduction. Explain which claim remains unresolved and the smallest context addition that would resolve it. Do not automatically rank more infrastructure above understanding the task. A reflection should name the misunderstanding or uncertainty, the proposed context change, and a different question that could test whether the improvement transfers. Keep hypotheses distinct from tested improvements and owner acceptance.

## Product direction and open choices

The demo should have recognizable Jira issue, list and board behavior using the ADEO Nuxt UI design system. Eventual targets include the Jira API operations needed by demos, Vercel Connect, Jira MCP using MCP Toolkit, accounts derived from verified Passport identity, SAML and directory sync. The exact compatibility subset and identity behavior need concrete demo scenarios before implementation. The earlier phrase "feature parity" is not evidence of a complete, agreed endpoint specification.

The first station uses on-demand investigations, a pinned main-branch working tree, live GitHub and Vercel reads, sandbox reproduction and a durable Eve result. Recent session links and editable request drafts are browser-local. Scheduled mining, shared proposal indexing, automated deduplication and promotion of reviewed reflections remain design choices.

## Learning and authority

Keep the goal, project map and reviewed reflections in this repository. A run's observations are evidence; its recommendations are candidates. Remi owns priorities and product taste. The development session may propose context changes and test them, but a mining run cannot change its own instructions or the criteria used to judge it.

Preserve uncertainty. Separate owner decisions, source observations and model hypotheses. Record the sources and date of a reflection and what would invalidate it. Recheck changing facts such as issues and code before carrying a previous proposal forward.

Use this current goal when an older roadmap or UI string still describes request-to-work-order admission as the immediate next step. Those later capabilities remain possible; the current learning experiment is task mining.

Consequential ambiguity about architecture, scope or prolonged work must be clarified with Remi before proceeding. Use delegated implementation and cheap Muse experiments to test specific context hypotheses; do not substitute prolonged infrastructure work for reviewing whether the agent understands the project.
