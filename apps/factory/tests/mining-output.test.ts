import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationLink, miningProgress, parseMiningOutput, proposalDeliveryRequest, proposalDraft, terminalMiningFailure } from "../app/utils/mining-output.ts";
import { factoryRepository } from "../runtime/lib/factory-config.ts";

const capturedAt = "2026-09-12T12:00:00.000Z";
const revision = "a".repeat(40);
const workOrder = { kind: "work_order" as const, outcome: "Build the bounded issue flow.", scope: ["apps/jira/server/api/issues.get.ts"], evidence: ["The route returns the current issue list."], verification: ["pnpm --filter @jira-clone/jira test"] };

test("replays historical fx reports and normalizes GitHub inventory counts", () => {
  const result = parseMiningOutput({ phase: "Complete", report: "Legacy findings", revision, capturedAt, githubReads: [{ resource: "issues", complete: true, capturedAt, items: [{ number: 1 }] }] });
  assert.equal(result?.report, "Legacy findings");
  assert.equal(result?.githubReads?.[0]?.count, 1);
});

test("retains native incomplete findings and actual reproduction failures", () => {
  const result = parseMiningOutput({ phase: "Incomplete", report: "A bounded proposal", revision, capturedAt, executionSurface: "native-eve", githubReads: [{ resource: "pulls", complete: true, capturedAt, count: 0 }], commands: [{ command: "pnpm test", exitCode: 1, stdout: "2 tests failed", stderr: "", capturedAt }], contextGaps: ["Deployment logs unavailable"], vercelReads: [{ resource: "deployments", projectId: "project", capturedAt, complete: false }] });
  assert.equal(result?.phase, "Incomplete");
  assert.equal(result?.commands?.[0]?.exitCode, 1);
  assert.equal(result?.githubReads?.[0]?.count, 0);
  assert.deepEqual(result?.contextGaps, ["Deployment logs unavailable"]);
  assert.equal(result?.vercelReads?.[0]?.complete, false);
});

test("preserves each host admission outcome and carries work-order admission into a draft", () => {
  const clarification = { kind: "clarification" as const, questions: ["Which transition should be supported first?"], blockingDecision: "The owner must choose the first transition." };
  const unsupported = { kind: "unsupported" as const, reason: "The required provider evidence is unavailable.", evidence: ["The provider read was denied."] };
  assert.equal(parseMiningOutput({ phase: "Complete", admission: workOrder })?.admission?.kind, "work_order");
  assert.equal(parseMiningOutput({ phase: "Incomplete", admission: clarification })?.admission?.kind, "clarification");
  assert.equal(parseMiningOutput({ phase: "Incomplete", admission: unsupported })?.admission?.kind, "unsupported");
  const draft = proposalDraft({ proposal: firstProposal, index: 0, sessionId: "wrun_admission", phase: "Complete", admission: workOrder });
  assert.deepEqual(draft.admission, workOrder);
});

test("shows incomplete findings when preparation did not obtain a revision", () => {
  const result = parseMiningOutput({ phase: "Incomplete", report: "Source unavailable", revision: "", contextGaps: ["GitHub unavailable"] });
  assert.equal(result?.report, "Source unavailable");
  assert.equal(result?.revision, undefined);
});

test("rejects malformed evidence rather than manufacturing valid source links", () => {
  assert.equal(parseMiningOutput({ phase: "Complete", revision: "../not-a-revision", report: "text" }), undefined);
  assert.equal(parseMiningOutput({ phase: "Complete", githubReads: [{ resource: "issues", complete: true, capturedAt, count: -1 }] }), undefined);
});

test("native tool progress reflects the latest tool without exposing command input", () => {
  assert.equal(miningProgress("prepare_context", { phase: "Installing pinned dependencies" }), "Installing pinned dependencies");
  assert.equal(miningProgress("bash", undefined), "Checking behavior in the sandbox");
  assert.equal(miningProgress("record_findings", undefined), "Recording proposals and their evidence");
});

test("authorization links permit secure provider redirects but reject script URLs", () => {
  assert.equal(authorizationLink("https://vercel.com/connect/authorize?request=example"), "https://vercel.com/connect/authorize?request=example");
  assert.equal(authorizationLink("javascript:alert(1)"), undefined);
  assert.equal(authorizationLink("http://example.com"), undefined);
  assert.equal(authorizationLink(undefined), undefined);
});

const firstProposal = { title: "First candidate", outcome: "A bounded first outcome", whyNow: "A verified gap", evidence: ["app.ts:12"], existingWork: "No duplicate", scope: ["First scope"], acceptanceCriteria: ["First criterion"], uncertainties: ["Owner preference pending"] };
const secondProposal = { ...firstProposal, title: "Second candidate", outcome: "A different selected outcome", scope: ["Second scope"] };

test("each task draft contains only the selected proposal and retains host provenance and gaps", () => {
  const output = parseMiningOutput({ phase: "Incomplete", report: "Combined report", revision, capturedAt, proposals: [firstProposal, { ...secondProposal, id: "wrun_host:proposal:2", rank: 2, provenance: { sessionId: "wrun_host", repository: factoryRepository, revision, capturedAt, executionSurface: "native-eve", source: "git-revision" } }], contextGaps: ["Deployment access pending"] });
  const selected = output?.proposals?.[1];
  assert(selected);
  const draft = proposalDraft({ proposal: selected, index: 1, sessionId: "wrun_host", revision, capturedAt, phase: "Incomplete", contextGaps: output.contextGaps });
  assert.equal(draft.title, "Second candidate");
  assert(draft.body.includes("Second scope"));
  assert(!draft.body.includes("First scope"));
  assert(!draft.body.includes("Combined report"));
  assert(draft.body.includes("wrun_host:proposal:2"));
  assert(draft.body.includes(revision));
  assert(draft.body.includes("Deployment access pending"));
  assert(draft.body.includes("Investigation status: Incomplete"));
  assert(draft.body.includes("Implementation has not started"));
});

test("proposal delivery handoff does not carry draft-only wording", () => {
  const request = proposalDeliveryRequest({ proposal: firstProposal, index: 0, sessionId: "wrun_delivery", revision, capturedAt, phase: "Complete" });
  assert.equal(request.title, "First candidate");
  assert(request.body.includes("Selected to start the durable delivery"));
  assert(!request.body.includes("Selected for review as an editable draft"));
});

test("legacy structured proposal identifiers are stable and explicitly derived", () => {
  const input = { proposal: firstProposal, index: 0, sessionId: "wrun_legacy", phase: "Complete" };
  assert.deepEqual(proposalDraft(input), proposalDraft(input));
  assert(proposalDraft(input).body.includes("wrun_legacy:proposal:1"));
  assert(proposalDraft(input).body.includes("Derived from the legacy session"));
  assert(!proposalDraft({ ...input, sessionId: "wrun_other" }).body.includes("wrun_legacy"));
});

test("Vercel evidence preserves the bounded coverage alongside completion", () => {
  const output = parseMiningOutput({ phase: "Complete", vercelReads: [{ resource: "deployments", projectId: "project", capturedAt, complete: true, coverage: "Most recent 20 deployments; older history was not inspected." }] });
  assert.equal(output?.vercelReads?.[0]?.coverage, "Most recent 20 deployments; older history was not inspected.");
  assert.equal(output?.vercelReads?.[0]?.complete, true);
});

test("recoverable tool errors do not become terminal investigation failures", () => {
  const input = { status: "streaming", events: [{ type: "step.failed" }], hasReport: false, awaitingAuthorization: false, outputError: false };
  assert.equal(terminalMiningFailure(input), false);
  assert.equal(terminalMiningFailure({ ...input, status: "idle" }), false, "a disconnected stream with a historical step failure remains recoverable");
  assert.equal(terminalMiningFailure({ ...input, status: "idle", events: [...input.events, { type: "turn.failed" }] }), true);
  assert.equal(terminalMiningFailure({ ...input, status: "idle", events: [{ type: "session.completed" }] }), true);
  assert.equal(terminalMiningFailure({ ...input, status: "idle", events: [{ type: "turn.completed" }], hasReport: true }), false, "recorded findings supersede earlier tool failures");
  assert.equal(terminalMiningFailure({ ...input, status: "idle", events: [{ type: "turn.cancelled" }] }), false);
});
