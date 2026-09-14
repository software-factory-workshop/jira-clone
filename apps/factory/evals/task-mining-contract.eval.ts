import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { factoryRepository } from "../runtime/lib/factory-config.ts";
import { isRecord, property, toolResultOutput } from "./support.ts";

const prompt = [
  "Mine the next useful task for the current ADEO Jira factory.",
  "Follow the task-mining contract exactly: prepare the pinned context first, inspect current GitHub issues and pull requests, read deployment evidence for both Vercel projects, and run only a focused reproduction or inspection probe.",
  "Record one admission decision and then one structured findings result with at most three ranked proposals. Every proposal must cite exact repository evidence, bounded scope, acceptance criteria, existing work, and uncertainties. Do not implement or approve anything.",
].join(" ");

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown, minimum: number): value is readonly string[] {
  return Array.isArray(value) && value.length >= minimum && value.every(nonEmptyString);
}

function isAuditableFindings(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const phase = property(value, "phase");
  if (phase !== "Complete" && phase !== "Incomplete") return false;

  const proposals = property(value, "proposals");
  if (!Array.isArray(proposals) || proposals.length > 3) return false;
  if (proposals.length === 0 && !nonEmptyString(property(value, "noProposalReason"))) return false;

  const validProposals = proposals.every(proposal => {
    if (!isRecord(proposal)) return false;
    return nonEmptyString(property(proposal, "title"))
      && nonEmptyString(property(proposal, "outcome"))
      && nonEmptyString(property(proposal, "whyNow"))
      && stringArray(property(proposal, "evidence"), 1)
      && typeof property(proposal, "existingWork") === "string"
      && stringArray(property(proposal, "scope"), 1)
      && stringArray(property(proposal, "acceptanceCriteria"), 1)
      && stringArray(property(proposal, "uncertainties"), 0);
  });
  if (!validProposals) return false;

  const reflection = property(value, "reflection");
  if (!isRecord(reflection)) return false;
  const reflectionKeys = ["helpfulContext", "missingContext", "contradictions", "suggestedImprovements"];
  if (!reflectionKeys.every(key => stringArray(property(reflection, key), 0))) return false;
  if (!stringArray(property(value, "contextGaps"), 0)) return false;

  const revision = property(value, "revision");
  return typeof revision === "string"
    && /^[a-f0-9]{40}$/.test(revision)
    && property(value, "repository") === factoryRepository
    && property(value, "executionSurface") === "native-eve"
    && isRecord(property(value, "admission"))
    && (property(property(value, "admission"), "kind") === "work_order"
      || property(property(value, "admission"), "kind") === "clarification"
      || property(property(value, "admission"), "kind") === "unsupported");
}

export default defineEval({
  description: "Task mining obeys the bounded investigation and structured receipt contract",
  tags: ["native", "paid", "contract", "task-mining"],
  timeoutMs: 600_000,
  async test(t) {
    await t.send(prompt);
    t.succeeded();
    t.calledTool("prepare_context", { count: 1 });
    t.calledTool("github_read", { count: count => count >= 2 });
    t.calledTool("vercel_read", { count: count => count >= 2 });
    t.calledTool("bash", { count: count => count >= 1 && count <= 2 });
    t.calledTool("record_work_order", { count: 1 });
    t.calledTool("record_findings", { count: 1 });
    t.toolOrder(["prepare_context", "record_work_order", "record_findings"]);
    t.maxToolCalls(32);
    t.notCalledTool("session_limit_continuation");

    const findings = t.events.find(event => {
      const result = property(property(event, "data"), "result");
      return isRecord(result) && result.kind === "tool-result" && result.toolName === "record_findings";
    });
    t.check(toolResultOutput(findings), satisfies(isAuditableFindings, "record_findings contains a bounded, auditable receipt"));
    t.log("This eval gates protocol and evidence shape. Proposal usefulness remains a separate human or judge review.");
  },
});
