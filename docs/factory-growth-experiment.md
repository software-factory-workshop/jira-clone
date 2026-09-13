# Grow the factory; use Jira to test it

The primary deliverable is a project-owned Eve factory that becomes more capable through observed work and measured improvements. The ADEO Jira demo supplies useful requests, realistic integrations and a product owner with strong judgment. Its feature count is not the success metric. This document governs preparation and workshop sequencing where earlier plans prioritize application readiness.

Start with an empty product scaffold and the smallest runnable factory. Prepare dependencies, credentials, sandbox access and known reference fixtures, but do not require a completed Jira application or all identity integrations to begin. Keep product and factory source together. Record the factory version, input, candidate version, results and human interventions for each run.

The repeated experiment is:

```text
give the current factory a bounded Jira request
 -> observe its decisions and artifacts
 -> inspect the result with Remi
 -> identify a specific factory limitation, if one appeared
 -> change the relevant instruction, skill, tool, environment or check
 -> rerun the case and try a different related request
 -> retain the improvement when evidence supports it
```

Some failures are product bugs or environment problems. Classify them before changing the factory. Do not add a specialist or a new abstraction for every failed run. A change can remove unnecessary factory logic. When the run already succeeds, test a harder request before inventing a limitation.

1. The factory understands enough to propose useful work.

The current milestone is task mining, as agreed in [the goal](../factory/context/goal.md). Start with one bounded read-only investigation of the goal, source and current GitHub issues and PRs. It returns supported proposals or an explicit reason that more context is needed. It may not write product code or publish tasks.

Use the same small prompt before and after a context change, then try a differently worded request in a fresh session. Judge evidence, relevance, duplicate checks, bounded outcomes and the quality of reflection. Retain raw outputs and record manual interventions. The initial AI SDK Harness/fx runner established the context experiment and remains separately packaged. The asynchronous cockpit station now runs native Eve with its own sandbox and tools. Consult [dated delivery evidence](verification.md) for the runtime and revision actually verified; historical fx-backed transport checks do not verify the native station. Owner judgment of the proposals remains separate.

Request-to-work-order admission remains a possible later capability. The previous plan to start by admitting an ADEO issue-list request has been superseded by task mining. Do not count the existence of a runner as proof that mining is useful.

2. The factory learns the project's expectations.

Load the existing ADEO skill and a short project brief. Ask Remi to assess the proposed behavior and, once a preview exists, its usability. Convert recurring feedback into examples, constraints or checks. Keep subjective review explicitly human where it cannot yet be tested reliably.

Replay the original request and a different one, such as issue details. Evidence of improvement is that relevant guidance carries over and fewer repeated corrections are needed. Avoid a growing transcript dump or a check tailored only to one screen.

3. The factory can produce a bounded candidate.

Add isolated implementation and a fixed set of check commands. A single worker is enough initially. Feed it the supported work order, repository revision and relevant skills. It returns a diff or candidate commit, actual command outcomes and unresolved items. The implementation checkout does not receive publication authority or permission to activate changed factory rules.

The issue list, create-issue action and bounded save path are now a small shipped demo slice. Fixtures remain explicitly labelled, and durable persistence remains a later request when a new capability needs it. Keep fixture data, demo behavior and production integration claims distinct.

4. The factory can reject its own bad work.

Add a fresh verifier only when there is a candidate to inspect. Keep trusted acceptance checks pinned independently of the editable candidate. The verifier can run the UI/API behavior, inspect scope and return structured findings; the controller determines whether required checks and evidence permit proceeding.

Use a prepared defective candidate, clearly labeled as an injected test case: for example, an issue edit appears to save but disappears after reload. Assert that the factory rejects it. Change the candidate revision and assert that the old verification result no longer applies. Different context alone is not proof of correctness.

5. The factory improves from failure and feedback.

Send actionable findings into a bounded correction round. Persist the work order and evidence so the next run does not require reconstructing the conversation. Test the correction on the original request, then a related request that was not used to tune the fix.

As the Jira product grows, use identity and integrations to expose more consequential cases: MCP invents an author ID, a viewer writes through an alternate endpoint, or a deactivated user retains access. Add protocol adapters and authorization checks in response to these cases. Passport, Connect, MCP Toolkit, SAML and directory sync remain product targets; completing all of them is not a prerequisite for demonstrating factory learning.

6. The factory can continue work under explicit limits.

Interrupt one run and resume it. Record stable task/run references and test duplicate-effect handling. Configure bounded elapsed time, correction rounds and spend before unattended execution. Add task state beyond Eve's session record only when the observed recovery case requires it.

The exit evidence is a coherent continued task and no duplicate publication. This is an advanced checkpoint for the workshop, not machinery to build before the first request.

For every growth step, retain an experiment record:

| Field | What to record |
| --- | --- |
| Request and expectation | Exact input and outcome agreed before the run |
| Versions | Factory revision, target base/candidate SHA, suite/fixture version, model/settings |
| Before | Observed limitation with artifact or trace |
| Change | Smallest relevant factory change and its reason |
| Replay | Actual outcome on the original case |
| Transfer | Outcome on a related new case |
| Human effort | Corrections, manual interventions and approximate time |
| Cost and limits | Available usage measurements, elapsed time and stop reason |
| Conclusion | Improved, regressed, inconclusive or environment-blocked |

One successful rerun is a useful observation, not statistical proof. Keep cases repeatable, distinguish model variation from the factory change, and expand evaluation only when needed. Raw traces and test artifacts carry more weight than the agent's self-assessment.

The human/Codex development session initially builds and repairs the factory. The Eve factory performs the product task so there is real execution evidence. If we manually patch the product to unblock a session, record that intervention. Later the factory can propose a change to its own definition through a reviewed PR; it cannot activate new permissions or verification criteria during the run judging that proposal.

The three-hour onsite core should begin with task mining and project knowledge, then grow bounded implementation and verification as time permits. Use the additional 30–60 minutes for a feedback-to-eval loop and recovery. Each checkpoint packages a factory capability, its test cases and just enough Jira code to exercise it. Checkpoint names should follow the factory capability rather than Jira feature names.

Research basis: the [AI SDK Factory history](/Users/remiconnesson/knowledge-work/software-factories/research/histories/ai-sdk-factory/outline.md) records small classification/reproduction tasks preceding the larger orchestration system. The [factory engineering discussion](/Users/remiconnesson/knowledge-work/software-factories/research/slack/brain-lars/software-factory-thinking.md) emphasizes observing blocked/flawed work and improving its cause. These inform this proposed experiment; they do not establish that this ADEO factory has been implemented or evaluated.
