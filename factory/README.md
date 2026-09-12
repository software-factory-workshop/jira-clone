# The factory grows here

Stage zero establishes a repository, two reviewable applications and versioned project context. It deliberately contains no agent runtime.

Stage one will add one Eve capability: turn a user request into a work order grounded in the brief, design system and observed Jira surface, or ask a focused question when the evidence is insufficient.

Before implementing it, agree on a concrete example, its expected outcome and how to distinguish a useful answer from a plausible but unsupported one. Keep the runtime configuration, skills, tools and evaluations in this repository. Do not prebuild all later stages.

GitHub credentials come from Vercel Connect (`github/jira-clone`). Agent-facing GitHub operations should use the official Vercel Labs github-tools integration after checking compatibility with the selected Eve release. Creating the connector does not activate agent tools or webhook triggers.
