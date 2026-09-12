import test from "node:test";
import { defaultMessageReducer } from "eve/client";
import assert from "node:assert/strict";
import { dispatchedTask, parsePullRequest, parseStationResult, pendingStationRequests, stationLinkSchema, latestStationTurn, readStationStream } from "../app/utils/work-station.ts";
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

test("a dispatcher working receipt identifies an admitted background task without a child ID yet", () => {
  assert.equal(dispatchedTask({ agentId: "ag_worker:2500dc293297", status: "working", taskId: "task_2500dc293297713a6bb8850e" }), "task_2500dc293297713a6bb8850e");
  assert.equal(dispatchedTask({ status: "failed", taskId: "task_failed" }), undefined);
  assert.equal(dispatchedTask({ status: "working" }), undefined);
});

test("late parent budget requests remain actionable after the dispatcher completed", () => {
  const reducer = defaultMessageReducer();
  const completed = reducer.reduce(reducer.initial(), { type: "turn.completed", data: { sequence: 0, turnId: "turn_0" } });
  const requestId = "task_worker:wrun_child:limit:input:508440";
  const waiting = reducer.reduce(completed, { type: "input.requested", data: { sequence: 0, stepIndex: 20, turnId: "turn_0", requests: [{ requestId, kind: "session-limit", prompt: "Input budget reached", allowFreeform: false, display: "confirmation", options: [{ id: "continue", label: "Approve", style: "primary" }, { id: "stop", label: "Stop", style: "danger" }], action: { callId: "wrun_child:limit:input:508440", input: { kind: "input", limit: 496496, usedTokens: 508440 }, kind: "tool-call", toolName: "session_limit_continuation" } }] } });
  const requests = pendingStationRequests(waiting);
  assert.equal(requests[0]?.requestId, requestId);
  assert.deepEqual(requests[0]?.options?.map(option => option.id), ["continue", "stop"]);
  const responded = reducer.reduce(waiting, { type: "client.input.responded", data: { createdAt: 0, responses: [{ requestId, optionId: "continue" }] } });
  assert.equal(pendingStationRequests(responded).length, 0);
});

test("a resumed child is not stopped by an earlier cancellation", () => {
  const history = [{ type: "turn.started" }, { type: "turn.cancelled" }];
  assert.equal(latestStationTurn(history), "cancelled");
  history.push({ type: "turn.started" }, { type: "step.started" });
  assert.equal(latestStationTurn(history), "running");
  history.push({ type: "turn.completed" });
  assert.equal(latestStationTurn(history), "completed");
});

test("durable station tail reads late dispatch and child decisions beyond a turn boundary", async (t) => {
  const events = [
    { type: "turn.completed", data: { sequence: 0, turnId: "turn_0" } },
    { type: "subagent.called", data: { childSessionId: "wrun_child", name: "worker" } },
    { type: "input.requested", data: { requests: [{ requestId: "wrun_child:limit:output:32092", prompt: "Continue?" }] } },
  ];
  const text = events.map(event => JSON.stringify(event)).join("\n");
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/eve/v1/session/wrun_child/stream?startIndex=0");
    return new Response(new ReadableStream({ start(controller) {
      const bytes = new TextEncoder().encode(text);
      controller.enqueue(bytes.slice(0, 17)); controller.enqueue(bytes.slice(17)); controller.close();
    } }));
  });
  const received = [];
  for await (const event of readStationStream("wrun_child", new AbortController().signal)) received.push(event);
  assert.deepEqual(received, events);
});
