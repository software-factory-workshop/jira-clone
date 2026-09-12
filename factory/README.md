# The factory grows here

Start with [the current goal](context/goal.md), then use [the project map](context/project-map.md) to inspect the relevant code and evidence. Read [work already underway](context/work-in-progress.md) alongside current GitHub issues before proposing work.

The cockpit includes task mining plus two explicit [work stations](work-stations.md): a worker takes an assigned draft and publishes a draft PR; an independent reviewer takes a PR and records a verdict for its exact revisions. Task mining understands the goal, current code and GitHub work, then proposes useful tasks and reflects on missing context. Eve runs the deployed investigation directly with its own sandbox and tools. The AI SDK Harness/fx runner is a separate experiment that helped test context; it is not nested inside the station. The Jira demo remains a fixture shell. Request-to-work-order admission is a later candidate, not the immediate milestone.

The factory's project instructions, tools, context, evaluations and reviewed lessons belong in this repository. Keep raw runs and evaluation material separate from the context supplied to a fresh agent. Do not feed a run its expected answer.

- `context/`: current goal and source navigation.
- `reflections/`: reviewed observations and hypotheses, with provenance and limits.
- `mining/`: experiment prompt, evaluation criteria, recorded runs and comparison.
- `../packages/fx-sandbox-experiment/`: developer fx experiment and preserved context-calibration evidence.
- `../apps/factory/agent/`: Eve configuration, authentication, mining tools and declared worker/reviewer specialists.
- `tasks/`: explicit bounded worker assignments.
- `work-stations.md`: authority, publication, independent review and research decisions.
- `task-mining-station.md`: execution, evidence and review contract.

GitHub credentials come from Vercel Connect (`github/jira-clone`). The experiment reads only this repository. Mining keeps bounded GET access. The worker publishes through a separate host tool restricted to one draft PR in this repository; its sandbox receives no credential. The reviewer has no publishing or merge capability. Inbound webhooks, automatic scheduling, revision loops and merges are not part of these stations.
