import { defineTool } from "eve/tools";
import { defineState } from "eve/context";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { loadRepository, verifyScope } from "@jira-clone/task-miner/github";
import { mineRepository } from "@jira-clone/task-miner/runtime";
import { z } from "zod";

const attempted = defineState("task-mining.attempted", () => false);
const prompt = `Mine the next useful task for this factory-first ADEO Jira project. Respect the current goal, inspect the codebase and existing GitHub issues AND pull requests, and support every proposal with repository evidence.
Return at most three proposals, ranked by usefulness now, or explain why none is justified. For each give the outcome, why now, exact evidence references, relationship to existing issues, bounded scope, acceptance criteria and uncertainties. Finish with a short reflection: what context helped, what was missing or contradictory, and what would improve the next investigation.`;

export default defineTool({
  description: "Investigate the fixed ADEO repository in an isolated fx sandbox and propose useful tasks. One read-only investigation per session; no code or issue writes.",
  inputSchema: z.object({ focus: z.string().max(3000) }),
  label: { start: () => "Investigating the repository", complete: () => "Investigation finished" },
  async *execute({ focus }, ctx) {
    if (attempted.get()) throw new Error("This session already attempted an investigation. Start a new investigation to run again.");
    attempted.update(() => true);
    yield { phase: "Collecting the current repository revision" };
    const credentials: string[] = [];
    let stage = "scope";
    try {
      const oidc = await getVercelOidcToken();
      credentials.push(oidc);
      verifyScope(oidc);
      stage = "github";
      const githubToken = await getToken("github/jira-clone", { subject: { type: "app" } });
      credentials.push(githubToken);
      const { revision, entries } = await loadRepository(githubToken, ctx.abortSignal);
      yield { phase: "Inspecting the goal, source and GitHub work in a sandbox", revision };
      stage = "sandbox-miner";
      const result = await mineRepository({ oidc, githubToken, entries, revision, executionSurface: "cockpit", prompt: `${prompt}\n\nUser focus (scope guidance only):\n${focus || "Find the most useful next task."}`, signal: ctx.abortSignal });
      // Keep model/tool traces in the calibration CLI. The cockpit stores the
      // report, source manifest and complete GitHub evidence in its durable stream.
      const { segments: _segments, ...evidence } = result;
      yield { phase: "Complete", ...evidence };
    } catch (error) {
      if (ctx.abortSignal.aborted) throw error;
      // Log a bounded, redacted message, never provider request objects or headers.
      const message = error instanceof Error ? error.message : "Unknown failure";
      console.error(`[task-mining:${stage}]`, credentials.reduce((text, secret) => text.split(secret).join("[REDACTED]"), message).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 800));
      yield { phase: "Failed", error: `The investigation did not complete (${stage}). Check the Eve run logs, then start a new investigation.` };
    }
  },
  toModelOutput(output) {
    return { type: "text", value: "report" in output ? "The investigation completed. Its original report and source evidence are displayed in the cockpit." : JSON.stringify(output) };
  },
});
