# Investigating the supplied context

Status: Codex review of a completed mining experiment on 12 September 2026. These are observations and candidate lessons, not owner acceptance of proposed work. Detailed run output and scoring remain held out under `factory/mining/`.

A run correctly shifted toward the task-mining goal, but proposed creating an evaluation rubric that already existed outside its snapshot. It noted that files referenced by the repository were unavailable, yet still ranked the proposal. The information boundary was ambiguous.

Change: `.mining-snapshot.json` now lists included paths and explicit exclusions. Runner source remains available for inspection. The held-out prompt, rubric, raw runs and scores exist in the repository; exclusion is not absence. If a task depends on an unavailable file, request the smallest missing evidence or make a conditional proposal instead of asserting the file needs to be created.

The same run reproduced a Jira status list incorrectly despite having read the JSON reference. Treat exact IDs, arrays, paths and line references as claims to verify against the source immediately before using them. If an exact value does not help justify the task, omit it. Do not paraphrase an array as though it were a faithful quotation.

Hypotheses to test: an explicit source inventory reduces false missing-work proposals, and checking quoted details reduces transcription errors. The development session is running fresh same-prompt replays and differently worded investigations to test these lessons; see `factory/context/work-in-progress.md` for current status. Do not infer unstarted work from this hypothesis statement. Neither observation proves broad model reliability.

Review this note when the snapshot policy or runner changes. Future runs should inspect the current source, not treat a previous agent's interpretation as the code's behavior.

A later completed run avoided proposing a missing rubric but proposed starting the replay/transfer work already underway. It also described the explicit snapshot inventory as unavailable without inspecting it. Change: check the inventory at `.mining-snapshot.json` and the current-work record before deciding something is absent or unstarted. Hypothesis: representing active work alongside GitHub reduces duplicated investigations. This is a source-selection lesson, not a prescribed task title.
