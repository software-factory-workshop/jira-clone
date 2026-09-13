# Task-mining review rubric

Written before reviewing the baseline output. This rubric is held outside the agent's repository snapshot; it evaluates usefulness rather than matching a preferred task title.

Score each dimension 0 (missing/wrong), 1 (partial), or 2 (supported and useful):

1. **Goal alignment:** prioritizes growing the factory and its context-engineering station; treats Jira demo work as the test subject rather than the main delivery target.
2. **Grounding:** checks actual source, gives precise evidence, distinguishes implemented behavior, plans, observations and model inference.
3. **Issue hygiene:** inspects complete current GitHub issue/PR inventories; checks whether findings are duplicates or already fixed. An empty successful inventory is distinct from an access failure.
4. **Actionability:** offers a small number of bounded proposals with concrete outcomes and verifiable acceptance criteria, without executing them.
5. **Reflection:** identifies specific useful, missing or contradictory context and suggests what to improve without promoting its own guesses into project truth.

A promising run scores at least 8/10 with no critical unsupported claim or duplicate completed task. These are human/assistant review scores, not an independently validated automated evaluator. After changing context, run the same prompt in a fresh session and then a differently worded probe. Keep raw outputs, source hashes, GitHub reads and review notes.

No run alone establishes general reliability. Owner acceptance of proposals remains a separate decision.
