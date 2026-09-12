import test from "node:test";
import assert from "node:assert/strict";
import { parsePullRequest, parseStationResult, stationLinkSchema } from "../app/utils/work-station.ts";
const sha = "a".repeat(40);
test("review input only accepts PRs in the configured repository", () => {
  assert.equal(parsePullRequest("2"), 2);
  assert.equal(parsePullRequest("https://github.com/software-factory-workshop/jira-clone/pull/2"), 2);
  assert.equal(parsePullRequest("https://github.com/other/repo/pull/2"), undefined);
  assert.equal(parsePullRequest("https://github.com/software-factory-workshop/jira-clone/issues/2"), undefined);
  assert.equal(parsePullRequest("0"), undefined);
});
test("worker success requires a real scoped PR link and exact head/base identity", () => {
  const result = { station: "worker", sessionId: "wrun_test", revision: sha, summary: "Changed code", commands: [], publication: { branch: "factory/change", number: 2, url: "https://github.com/software-factory-workshop/jira-clone/pull/2", headSha: sha, baseSha: sha } };
  assert.equal(parseStationResult(result)?.station, "worker");
  assert.equal(parseStationResult({ ...result, publication: { ...result.publication, headSha: "unknown" } }), undefined);
});
test("review findings retain exact reviewed head, limitations and command failures", () => {
  const result = parseStationResult({ station: "reviewer", sessionId: "wrun_test", prNumber: 2, url: "https://github.com/software-factory-workshop/jira-clone/pull/2", baseSha: sha, headSha: sha, verdict: "changes_requested", summary: "A regression", findings: [{ severity: "blocking", path: "app.ts", line: 12, message: "Lost draft", evidence: "Reproduced save/restore race" }], commands: [{ command: "pnpm test", exitCode: 1, stdout: "Failed", stderr: "" }], limitations: ["No hosted browser run"], capturedAt: "2026-09-12T14:00:00Z" });
  assert(result?.station === "reviewer");
  assert.equal(result.headSha, sha);
  assert.equal(result.findings[0]?.line, 12);
  assert.equal(result.commands[0]?.exitCode, 1);
  assert.deepEqual(result.limitations, ["No hosted browser run"]);
});
test("run links retain station identity across reload", () => {
  assert.deepEqual(stationLinkSchema.parse({ station: "reviewer", run: "wrun_test" }), { station: "reviewer", run: "wrun_test" });
  assert(!stationLinkSchema.safeParse({ station: "worker", run: "../elsewhere" }).success);
});
