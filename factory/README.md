# The factory grows here

Start with [the current goal](context/goal.md), then use [the project map](context/project-map.md) to inspect the relevant code and evidence.

The deployed cockpit and Jira demo are stage-zero applications. The current development experiment is task mining: understand the goal, current code and GitHub work, then propose useful tasks and reflect on missing context. A manually invoked AI SDK Harness/fx runner is being evaluated before adding an asynchronous Eve station to the cockpit. Request-to-work-order admission is a later candidate, not the immediate milestone.

The factory's project instructions, tools, context, evaluations and reviewed lessons belong in this repository. Keep raw runs and evaluation material separate from the context supplied to a fresh agent. Do not feed a run its expected answer.

- `context/`: current goal and source navigation.
- `reflections/`: reviewed observations and hypotheses, with provenance and limits.
- `mining/`: experiment prompt, evaluation criteria, recorded runs and comparison.
- `../packages/task-miner/`: developer experiment runner. It is not a deployed agent service.

GitHub credentials come from Vercel Connect (`github/jira-clone`). The experiment reads only this repository. For the eventual Eve station, assess the official Vercel Labs github-tools integration against the selected Eve release. A working connector does not imply inbound webhooks, agent execution or issue publication.
