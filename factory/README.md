# The factory grows here

Start with [the current goal](context/goal.md), then use [the project map](context/project-map.md) to inspect the relevant code and evidence.

The cockpit now includes the first Eve station: understand the goal, current code and GitHub work, then propose useful tasks and reflect on missing context. Eve runs the deployed investigation directly with its own sandbox and tools. The AI SDK Harness/fx runner is a separate experiment that helped test context; it is not nested inside the station. The Jira demo remains a fixture shell. Request-to-work-order admission is a later candidate, not the immediate milestone.

The factory's project instructions, tools, context, evaluations and reviewed lessons belong in this repository. Keep raw runs and evaluation material separate from the context supplied to a fresh agent. Do not feed a run its expected answer.

- `context/`: current goal and source navigation.
- `reflections/`: reviewed observations and hypotheses, with provenance and limits.
- `mining/`: experiment prompt, evaluation criteria, recorded runs and comparison.
- `../packages/fx-sandbox-experiment/`: developer fx experiment and preserved context-calibration evidence.
- `../apps/factory/agent/`: Eve configuration, authentication and investigation tool.
- `task-mining-station.md`: execution, evidence and review contract.

GitHub credentials come from Vercel Connect (`github/jira-clone`). The experiment reads only this repository. The station keeps the tested, bounded GET tool; broader GitHub tools remain a separate capability decision. A working connector does not imply inbound webhooks, agent execution or issue publication.
