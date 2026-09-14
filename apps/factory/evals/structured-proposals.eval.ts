import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { factoryRepository } from "../runtime/lib/factory-config.ts";

export default defineEval({
  description: "Native Eve records independently reviewable proposals with host-owned identity and provenance",
  tags: ["native", "paid", "structured-proposals"],
  async test(t) {
    await t.send("Review the already-pending usefulness-feedback capture and bounded ADEO Jira demo-scope candidates for Remi's review. Inspect the current goal, codebase, GitHub work and Vercel evidence. Record justified candidates as separate proposals, acknowledging their existing pending status rather than calling them newly discovered work. Do not implement or approve them. Keep the investigation focused.");
    t.succeeded();
    t.calledTool("prepare_context");
    t.calledTool("record_findings");
    const event = t.events.find(event => event.type === "action.result" && event.data.result.kind === "tool-result" && event.data.result.toolName === "record_findings");
    const output = event?.type === "action.result" ? event.data.result.output : undefined;
    const record = output && typeof output === "object" ? output as Record<string, unknown> : {};
    const proposals = Array.isArray(record.proposals) ? record.proposals as Array<Record<string, unknown>> : [];
    t.check(proposals.length > 0 && proposals.length <= 3, equals(true));
    t.check(new Set(proposals.map(proposal => proposal.id)).size === proposals.length, equals(true));
    t.check(proposals.every((proposal, index) => {
      const provenance = proposal.provenance as Record<string, unknown> | undefined;
      return proposal.id === `${t.sessionId}:proposal:${index + 1}`
        && proposal.rank === index + 1
        && provenance?.sessionId === t.sessionId
        && provenance?.revision === record.revision
        && provenance?.capturedAt === record.capturedAt
        && provenance?.repository === factoryRepository
        && provenance?.executionSurface === "native-eve";
    }), equals(true));
    t.log("Proposal identity is host-derived; this check does not approve any task draft or establish proposal usefulness.");
  },
});
