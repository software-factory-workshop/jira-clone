# Growing the task-mining station

This experiment asks whether a fresh agent can propose useful work from repository context and current GitHub issues. It is the first factory capability under investigation. The cockpit remains stage zero.

Read the comparison in `report.md`, then inspect the underlying run outputs and reviews. The [prompt](prompt.md) stays small. The [review rubric](evaluation.md) was written before reviewing a complete baseline. The [transfer probe](probe.md) uses different wording with the same context.

## Reusable pieces

- The current goal in `../context/goal.md` records owner direction without requiring conversation history.
- The source map in `../context/project-map.md` points to actual code and names evidence limits.
- Reviewed notes in `../reflections/` separate observations, hypotheses and owner decisions.
- `../../packages/task-miner/run.mjs` assembles an isolated snapshot, checks team scope, runs fx with AI SDK Harness, and brokers fixed-repository GitHub reads through Connect.
- Each run directory retains source hashes, its prompt, document context, live GitHub evidence, output and available usage. Evaluation notes are separate from raw output.

These pieces can inform an asynchronous Eve station later. No durable cockpit queue, scheduler, issue publication or Jira implementation is added by this experiment.

## Interpreting the evidence

A failed authentication, unavailable preflight or paused tool call is an infrastructure result, not a bad task proposal. A completed run is still subject to review. An attractive score does not excuse a duplicate task or unsupported claim.

The runner withholds this directory from the miner. Its snapshot manifest explicitly says that the prompt, evaluation and previous runs exist but are held out. Runner code and current project context remain visible. This avoids answer leakage without turning excluded evidence into an apparent missing feature.

Compare source manifests before attributing a change to context. The experiment bundles several context corrections and includes model variation; it is not a controlled causal benchmark. The reviews are Codex assessments for Remi to examine. Owner acceptance is not implied by an assistant score.
