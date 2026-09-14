import test from "node:test";
import assert from "node:assert/strict";
import { proposalInputSchema, recordProposals, renderProposal } from "../runtime/lib/proposals.ts";
import { factoryRepository } from "../runtime/lib/factory-config.ts";

const proposal = {
  title: "Review one candidate", outcome: "A focused review draft", whyNow: "The owner needs to decide",
  evidence: ["factory/CONTRACT.md:5"], existingWork: "Review pending", scope: ["One proposal"],
  acceptanceCriteria: ["Only the selected candidate is in the draft"], uncertainties: ["Owner acceptance"],
};
const context = { sessionId: "wrun_example", revision: "a".repeat(40), capturedAt: "2026-09-12T12:00:00.000Z" };

test("recorded identities are stable within a run and distinct across positions and runs", () => {
  const first = recordProposals([proposal, { ...proposal, title: "Second candidate" }], context);
  const replay = recordProposals([proposal, { ...proposal, title: "Second candidate" }], context);
  assert.deepEqual(first, replay);
  assert.equal(first[0].id, "wrun_example:proposal:1");
  assert.equal(first[1].id, "wrun_example:proposal:2");
  assert.notEqual(first[0].id, recordProposals([proposal], { ...context, sessionId: "wrun_other" })[0].id);
  assert.deepEqual(first.map(item => item.rank), [1, 2]);
});

test("model output cannot choose identity or trusted provenance", () => {
  assert.equal(proposalInputSchema.safeParse({ ...proposal, id: "forged" }).success, false);
  assert.equal(proposalInputSchema.safeParse({ ...proposal, provenance: context }).success, false);
  const [recorded] = recordProposals([proposal], context);
  assert.deepEqual(recorded.provenance, { ...context, repository: factoryRepository, executionSurface: "native-eve", source: "git-revision" });
});

test("recording keeps each candidate independent while preserving Markdown compatibility", () => {
  const records = recordProposals([proposal, { ...proposal, title: "Unselected candidate", evidence: ["other.ts:10"] }], context);
  assert.deepEqual(records[0].evidence, ["factory/CONTRACT.md:5"]);
  assert.deepEqual(records[0].acceptanceCriteria, proposal.acceptanceCriteria);
  assert.match(renderProposal(records[0], records[0].rank), /^## 1\. Review one candidate/);
  assert.doesNotMatch(renderProposal(records[0], records[0].rank), /Unselected candidate|other\.ts/);
  assert.deepEqual(recordProposals([], context), []);
});
