# Build Jira through the factory

Owner instruction: 12 September 2026. The development session builds the factory; native Eve workers build Jira. Do not implement the Jira slice manually to make the demonstration pass.

## Factory prerequisites

- Authenticated API equivalents for every cockpit capability, with the UI using the same operations. Preserve existing drafts during migration. Retain Eve's session transport instead of introducing a second execution protocol.
- Shared draft, feedback and run-reference storage with conditional updates. A retry must not duplicate execution or overwrite a concurrent edit.
- A reusable delivery loop: explicit task -> owned worker PR -> independent review of exact head and target -> findings returned to the same owner -> fresh review. Stop when evidence is missing, the task needs clarification, the owner is unavailable, or a person must decide. A different worker may only contribute through a child PR.
- Narrow host policy allowing Jira API/utility files and the Jira test command, while preserving factory rules, credentials, dependency manifests and deployment configuration as protected boundaries. The worker must author any Jira manifest edit; the host validates the allowed semantic delta.
- Verification must actually execute Jira tests. A green root test command that omits them is insufficient.

## First useful worker assignment

Turn the synthetic Jira shell into a small stateful teaching application using the existing ADEO Nuxt UI design system. Reuse its seeded issues. Add editable issue priority, assignee filtering and an asynchronous save path with deterministic failure testing. Saved state and displayed state must agree after reload within the declared persistence boundary. Failed saves must not show false success or lose the user's draft. Label fixture identities and demo-only persistence accurately. Include reset instructions and focused behavior tests.

Do not claim full Jira API parity, real user permissions or production persistence. Comment permissions can be the next assignment once issues can be changed and saved. Keep the change small enough to inspect in the onsite workshop.

## Completion evidence

Record the API request, accepted session IDs, source revision, agent-authored PR, verification commands, review head/target, and browser behavior. Demonstrate at least one revision through the factory loop and recovery after reconnecting to its existing execution. Merge only after development-session review; keep unfinished or missing evidence visible.

## Research decisions reused

- `research/workshops/adeo-workshop-planning.md`: one useful engineering change, explicit evidence and stopping cases, synthetic fixtures labelled, no extra execution ledger merely for appearances.
- `research/walkthroughs/eve-software-factory-template.md`: specialist worker/reviewer handoffs using Eve's durable background tasks.
- `research/walkthroughs/vercel-factory.md` and the extracted review-gate block: bind decisions to candidate evidence instead of trusting an agent's final sentence.

Research root: `/Users/remiconnesson/knowledge-work/software-factories`. These are design sources, not proof that the current implementation satisfies the contract.
