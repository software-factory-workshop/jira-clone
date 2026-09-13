# The factory grows here

Start with [the current goal](context/goal.md), then use [the project map](context/project-map.md) to inspect the relevant code and evidence. Read [work already underway](context/work-in-progress.md) alongside current GitHub issues before proposing work.

The cockpit includes task mining plus two explicit [work stations](work-stations.md): a worker takes an assigned draft and publishes a draft PR; an independent reviewer takes a PR and records a verdict for its exact revisions. Task mining understands the goal, current code and GitHub work, then proposes useful tasks and reflects on missing context. Eve runs the deployed investigation directly with its own sandbox and tools. The AI SDK Harness/fx runner is a separate experiment that helped test context; it is not nested inside the station. The Jira product is a bounded demo slice over synthetic data. See [`docs/jira-current-state.md`](../docs/jira-current-state.md) for its implemented contracts and limits. Request-to-work-order admission is a later candidate, not the immediate milestone.

The factory's project instructions, tools, context, evaluations and reviewed lessons belong in this repository. Keep raw runs and evaluation material separate from the context supplied to a fresh agent. Do not feed a run its expected answer.

- `context/`: current goal and source navigation.
- `reflections/`: reviewed observations and hypotheses, with provenance and limits.
- `mining/`: experiment prompt, evaluation criteria, recorded runs and comparison.
- `../packages/fx-sandbox-experiment/`: developer fx experiment and preserved context-calibration evidence.
- `../apps/factory/agents/`: three independent Eve roots: task-miner, worker and reviewer.
- `../apps/factory/runtime/`: shared authentication, tools and station implementation.
- `../apps/factory/server/workflows/`: deterministic delivery orchestration.
- `tasks/`: explicit bounded worker assignments.
- `work-stations.md`: authority, publication, independent review and research decisions.
- `task-mining-station.md`: execution, evidence and review contract.

GitHub credentials come from Vercel Connect (`github/jira-clone`). The experiment reads only this repository. Mining keeps bounded GET access. The worker publishes through a separate host tool restricted to one draft PR in this repository; its sandbox receives no credential. The reviewer has no publishing or merge capability. The outer Vercel Workflow returns blocking findings to the original worker and requests another independent review. Its host merge policy can merge narrowly defined low-risk changes after independent checks, even when browser evidence is missing. Other changes require human review. See `docs/delivery-loop.md` for the policy and recovery protocol.
