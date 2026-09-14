import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { isRecord, property, toolResultOutput } from "./support.ts";

interface ScopeCase {
  readonly description: string;
  readonly prompt: string;
  readonly allowedScope: RegExp;
}

const cases: readonly ScopeCase[] = [
  {
    description: "Board-only requests stay on the requested Jira surface",
    prompt: [
      "Find one useful next task for the Jira issue board only.",
      "Do not broaden into factory architecture, authentication, deployment, or unrelated Jira screens.",
      "Use the current snapshot, GitHub work, and both Vercel projects as evidence. Record the admission and at most one source-backed proposal with exact path and line evidence, bounded scope, and acceptance criteria. If the board request is not justified, record why instead.",
    ].join(" "),
    allowedScope: /board|JiraIssueBoard|apps\/jira\/app/i,
  },
  {
    description: "Factory-observability requests stay on the requested cockpit surface",
    prompt: [
      "Find one useful next task for the factory cockpit's mining-run observability surface.",
      "Keep the proposal inside cockpit run display, event interpretation, or evidence handoff. Do not propose a new Jira feature, a new provider, or a broad factory rewrite.",
      "Inspect the current code and work, cite exact path and line evidence, and record the admission plus at most one bounded proposal. Do not implement or approve anything.",
    ].join(" "),
    allowedScope: /cockpit|MiningRun|observability|run|event|evidence/i,
  },
];

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isScopedFindings(value: unknown, allowedScope: RegExp): boolean {
  if (!isRecord(value)) return false;
  const proposals = property(value, "proposals");
  if (!Array.isArray(proposals) || proposals.length > 1) return false;
  if (proposals.length === 0) return nonEmptyString(property(value, "noProposalReason"));

  return proposals.every(proposal => {
    if (!isRecord(proposal)) return false;
    const scope = property(proposal, "scope");
    const evidence = property(proposal, "evidence");
    if (!Array.isArray(scope) || !scope.every(nonEmptyString)) return false;
    if (!Array.isArray(evidence) || !evidence.some(item => typeof item === "string" && /[\w.-]+(?:\/[\w.-]+)+:\d+/.test(item))) return false;
    return scope.every(item => allowedScope.test(item));
  });
}

export default cases.map(({ description, prompt, allowedScope }) => defineEval({
  description,
  tags: ["native", "paid", "scope", "task-mining"],
  timeoutMs: 600_000,
  async test(t) {
    await t.send(prompt);
    t.succeeded();
    t.calledTool("prepare_context", { count: 1 });
    t.calledTool("record_work_order", { count: 1 });
    t.calledTool("record_findings", { count: 1 });
    t.toolOrder(["prepare_context", "record_work_order", "record_findings"]);
    t.maxToolCalls(32);
    t.notCalledTool("session_limit_continuation");

    const findings = t.events.find(event => {
      const result = property(property(event, "data"), "result");
      return isRecord(result) && result.kind === "tool-result" && result.toolName === "record_findings";
    });
    t.check(
      toolResultOutput(findings),
      satisfies(value => isScopedFindings(value, allowedScope), "proposal scope stays within the requested surface and cites a path with a line"),
    );
  },
}));
