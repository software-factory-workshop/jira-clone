import test from "node:test";
import { defaultMessageReducer } from "eve/client";
import assert from "node:assert/strict";
import { dispatchedTask, parsePullRequest, parseStationResult, pendingStationRequests, stationLinkSchema, latestStationTurn, readStationStream, stationStreamPath, workerRequest, stationLaunchError, matchesStationDelivery, parseStationToolResult, appendStationTail, advanceStationTurn, boundStationProjection, eventToolId, MAX_STATION_TAIL_EVENTS, MAX_STATION_PROJECTION_MESSAGES, MAX_STATION_PROJECTION_PARTS } from "../app/utils/work-station.ts";
import { factoryPorts, factoryRepositoryUrl } from "../runtime/lib/factory-config.ts";
const sha = "a".repeat(40);
const pullUrl = (number: number) => `${factoryRepositoryUrl}/pull/${number}`;
const jiraOrigin = `http://127.0.0.1:${factoryPorts.jira}`;
test("review input only accepts PRs in the configured repository", () => {
  assert.equal(parsePullRequest("2"), 2);
  assert.equal(parsePullRequest(pullUrl(2)), 2);
  assert.equal(parsePullRequest("https://github.com/other/repo/pull/2"), undefined);
  assert.equal(parsePullRequest(`${factoryRepositoryUrl}/issues/2`), undefined);
  assert.equal(parsePullRequest("0"), undefined);
});
test("worker success requires a real scoped PR link and exact head/base identity", () => {
  const result = { station: "worker", sessionId: "wrun_test", revision: sha, summary: "Changed code", commands: [], browserEvidence: { complete: false, observations: [{ origin: "http://127.0.0.1:3001", headSha: sha, sessionId: "wrun_test", source: "head", snapshot: true, interaction: false, keyboard: false, screenshot: true, afterInteraction: false, route: "/issues", eventIds: ["event-1"] }] }, publication: { branch: "factory/change", number: 2, url: pullUrl(2), headSha: sha, baseSha: sha } };
  assert.equal(parseStationResult(result)?.station, "worker");
  assert.equal(parseStationResult(result)?.browserEvidence?.observations[0]?.route, "/issues");
  assert.equal(parseStationResult({ ...result, publication: { ...result.publication, headSha: "unknown" } }), undefined);
});
test("review findings retain exact reviewed head, limitations and command failures", () => {
  const result = parseStationResult({ station: "reviewer", sessionId: "wrun_test", prNumber: 2, url: pullUrl(2), baseSha: sha, headSha: sha, targetBranch: "factory/parent", verdict: "changes_requested", summary: "A regression", findings: [{ severity: "blocking", path: "app.ts", line: 12, message: "Lost draft", evidence: "Reproduced save/restore race" }], commands: [{ command: "pnpm test", exitCode: 1, stdout: "Failed", stderr: "" }], limitations: ["No hosted browser run"], capturedAt: "2026-09-12T14:00:00Z" });
  assert(result?.station === "reviewer");
  assert.equal(result.headSha, sha);
  assert.equal(result.targetBranch, "factory/parent");
  assert.equal(result.findings[0]?.line, 12);
  assert.equal(result.commands[0]?.exitCode, 1);
  assert.deepEqual(result.limitations, ["No hosted browser run"]);
});
test("station projections retain the host-owned visual packet", () => {
  const packet = { version: 1, status: "complete", requiredApps: ["jira"], baseSha: sha, headSha: sha, targetBranch: "main", reviewerSessionId: "wrun_reviewer", capturedAt: "2026-09-12T14:00:00Z", artifacts: [{ id: "a".repeat(32), app: "jira", origin: jiraOrigin, route: "/issues", baseSha: sha, headSha: sha, targetBranch: "main", capturedAt: "2026-09-12T14:00:00Z", before: { phase: "before", url: "https://factory.example/frame?phase=before", sha256: "b".repeat(64), mediaType: "image/png" }, after: { phase: "after", url: "https://factory.example/frame?phase=after", sha256: "c".repeat(64), mediaType: "image/png" } }], limitations: [] } as const;
  const result = parseStationResult({ station: "reviewer", sessionId: "wrun_reviewer", prNumber: 2, url: pullUrl(2), baseSha: sha, headSha: sha, targetBranch: "main", verdict: "approve", summary: "Reviewed", findings: [], commands: [], limitations: [], visualReview: packet, capturedAt: "2026-09-12T14:00:00Z" });
  assert(result?.station === "reviewer");
  assert.equal(result.visualReview?.status, "complete");
  assert.equal(result.visualReview?.artifacts[0]?.after?.url, "https://factory.example/frame?phase=after");
});
test("review projections retain the GitHub feedback receipt", () => {
  const result = parseStationResult({ station: "reviewer", sessionId: "wrun_reviewer", prNumber: 2, url: pullUrl(2), baseSha: sha, headSha: sha, targetBranch: "main", verdict: "changes_requested", summary: "Published feedback", findings: [], limitations: [], commands: [], publication: { body: "published", githubReview: "published", review: { id: 7, url: "https://github.com/software-factory-workshop/jira-clone/pull/2#review-7", deduplicated: false }, errors: [] }, capturedAt: "2026-09-15T00:00:00Z" });
  assert.equal(result?.station, "reviewer");
  assert.equal(result?.publication?.review?.id, 7);
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
  assert.equal(pendingStationRequests(waiting, true).length, 0, "a recorded child result supersedes a stale parent budget request");
  assert.equal(pendingStationRequests(waiting, false).length, 1, "a turn boundary without a recorded result preserves a genuine pause");
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
  assert.equal(advanceStationTurn("running", { type: "session.completed" }), "completed");
});

test("station event tails stay bounded while turn state remains incremental", () => {
  const tail = [] as Parameters<typeof appendStationTail>[0];
  const event = (sequence: number) => ({ type: "step.started", data: { sequence } }) as Parameters<typeof appendStationTail>[1];
  let turn = advanceStationTurn("unknown", { type: "turn.started" });
  for (let sequence = 0; sequence < MAX_STATION_TAIL_EVENTS + 2; sequence++) {
    appendStationTail(tail, event(sequence));
    turn = advanceStationTurn(turn, event(sequence));
  }
  assert.equal(tail.length, MAX_STATION_TAIL_EVENTS);
  assert.equal((tail[0]?.data as { sequence: number }).sequence, 2);
  assert.equal((tail.at(-1)?.data as { sequence: number }).sequence, MAX_STATION_TAIL_EVENTS + 1);
  assert.equal(turn, "running");
});

test("station event tails correlate requests and results by Eve call ID", () => {
  assert.equal(eventToolId({ type: "action.input.appended", data: { callId: "call_input" } }), "call_input");
  assert.equal(eventToolId({ type: "action.result", data: { result: { callId: "call_result" } } }), "call_result");
  assert.equal(eventToolId({ type: "actions.requested", data: { actions: [{ callId: "call_a" }, { callId: "call_b" }] } }), "call_a, call_b");
  assert.equal(eventToolId({ type: "step.started", data: { stepIndex: 1 } }), undefined);
});

test("station projections bound messages and parts without losing active request or result", () => {
  const reducer = defaultMessageReducer();
  let data = reducer.initial();
  const operationId = "d4c2d7da-37da-45ad-a782-c903e59a3c5d";
  const result = { station: "worker", sessionId: "wrun_worker", operationId, revision: sha, summary: "Published", commands: [], publication: { branch: "factory/work", number: 2, url: pullUrl(2), headSha: sha, baseSha: sha } };
  const pinned = { messages: [{ id: "old", role: "assistant", metadata: { turnId: "old" }, parts: [
    { type: "dynamic-tool", state: "approval-requested", toolCallId: "request", toolName: "session_limit_continuation", input: {}, approval: { id: "request" }, toolMetadata: { eve: { kind: "tool-call", name: "session_limit_continuation", inputRequest: { requestId: "request", prompt: "Continue?" } } } },
    { type: "dynamic-tool", state: "output-available", toolCallId: "publish", toolName: "publish_work", input: {}, output: result },
  ] }] } as typeof data;
  data = boundStationProjection(pinned, "worker", operationId);
  for (let index = 0; index < MAX_STATION_PROJECTION_MESSAGES + 16; index++) {
    data = boundStationProjection(reducer.reduce(data, { type: "step.started", data: { turnId: `turn_${index}`, stepIndex: 0 } }), "worker", operationId);
  }
  const partCount = data.messages.reduce((count, message) => count + message.parts.length, 0);
  assert.ok(data.messages.length <= MAX_STATION_PROJECTION_MESSAGES);
  assert.ok(partCount <= MAX_STATION_PROJECTION_PARTS);
  assert.equal(pendingStationRequests(data).at(0)?.requestId, "request");
  assert.equal(parseStationToolResult("publish_work", data.messages.flatMap(message => message.parts).find(part => part.type === "dynamic-tool" && part.toolName === "publish_work" && part.state === "output-available")?.output, operationId)?.station, "worker");
});

test("durable station tail reads late dispatch and child decisions beyond a turn boundary", async (t) => {
  const events = [
    { type: "turn.completed", data: { sequence: 0, turnId: "turn_0" } },
    { type: "subagent.called", data: { childSessionId: "wrun_child", name: "worker" } },
    { type: "input.requested", data: { requests: [{ requestId: "wrun_child:limit:output:32092", prompt: "Continue?" }] } },
  ];
  const text = events.map(event => JSON.stringify(event)).join("\n");
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/worker/eve/v1/session/wrun_child/stream?startIndex=0");
    return new Response(new ReadableStream({ start(controller) {
      const bytes = new TextEncoder().encode(text);
      controller.enqueue(bytes.slice(0, 17)); controller.enqueue(bytes.slice(17)); controller.close();
    } }));
  });
  const received = [];
  for await (const event of readStationStream("wrun_child", new AbortController().signal, "worker")) received.push(event);
  assert.deepEqual(received, events);
});

test("durable station tail accepts Eve session completion without data", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(`${JSON.stringify({ type: "session.completed" })}\n`));
  const received = [];
  for await (const event of readStationStream("wrun_child", new AbortController().signal, "worker")) received.push(event);
  assert.deepEqual(received, [{ type: "session.completed" }]);
});

test("station tail follows the selected Eve root", () => {
  assert.equal(stationStreamPath("wrun_child", "worker"), "/worker/eve/v1/session/wrun_child/stream?startIndex=0");
  assert.equal(stationStreamPath("wrun_child"), "/eve/v1/session/wrun_child/stream?startIndex=0");
});

test("work actions keep same-owner revision distinct from a new child contribution", () => {
  const draft = { title: "Fix feedback", brief: " Preserve the selected proposal " };
  assert.deepEqual(workerRequest("create", draft, ""), { path: "/factory/stations/worker", body: { title: "Fix feedback", brief: "Preserve the selected proposal" } });
  assert.deepEqual(workerRequest("revise", { ...draft, title: "" }, "2"), { path: "/factory/stations/revisions", body: { prNumber: 2, brief: "Preserve the selected proposal" } });
  assert.deepEqual(workerRequest("contribute", draft, "2"), { path: "/factory/stations/worker", body: { parentPrNumber: 2, title: "Fix feedback", brief: "Preserve the selected proposal" } });
  assert.throws(() => workerRequest("revise", draft, "https://github.com/other/repo/pull/2"));
  assert.throws(() => workerRequest("contribute", { ...draft, title: "" }, "2"));
  assert.throws(() => workerRequest("create", { title: "Task", brief: "Too short" }, ""), /at least 20 characters/);
});

test("unavailable ownership does not suggest silently taking the branch", () => {
  assert.match(stationLaunchError({ data: { error: { code: "owner_unavailable", message: "internal detail" } } }), /No replacement took control/);
  assert.match(stationLaunchError({ data: { error: { code: "ownership_unverified", message: "internal detail" } } }), /No worker was assigned/);
});

test("child PR results preserve target branch and owner provenance", () => {
  const result = parseStationResult({ station: "worker", sessionId: "wrun_child", revision: sha, summary: "Contributed", commands: [], publication: { branch: "factory/child", number: 3, url: pullUrl(3), headSha: sha, baseSha: sha, targetBranch: "factory/parent", targetHeadSha: sha, ownerSessionId: "wrun_child", parentPrNumber: 2 } });
  assert(result?.station === "worker");
  assert.equal(result.publication.parentPrNumber, 2);
  assert.equal(result.publication.targetBranch, "factory/parent");
  assert.equal(result.publication.ownerSessionId, "wrun_child");
});

test("revision run links and event projection identify the new delivery", () => {
  const link = { station: "worker", run: "wrun_owner", execution: "owner", operationId: "d4c2d7da-37da-45ad-a782-c903e59a3c5d", deliveryId: "delivery_revision" };
  assert.deepEqual(stationLinkSchema.parse(link), link);
  assert.equal(matchesStationDelivery({}, link.deliveryId, false), false);
  assert.equal(matchesStationDelivery({ meta: { deliveryIds: ["delivery_old"] } }, link.deliveryId, false), false);
  assert.equal(matchesStationDelivery({ meta: { deliveryIds: [link.deliveryId] } }, link.deliveryId, false), true);
  assert.equal(matchesStationDelivery({}, link.deliveryId, true), true);
  assert.equal(matchesStationDelivery({ meta: { deliveryIds: ["delivery_other"] } }, link.deliveryId, true), false);
});

test("the previous publication is not a completed revision of the same owner session", () => {
  const operationId = "d4c2d7da-37da-45ad-a782-c903e59a3c5d";
  const output = { station: "worker", sessionId: "wrun_owner", revision: sha, summary: "Changed", commands: [], publication: { branch: "factory/owner", number: 2, url: pullUrl(2), headSha: sha, baseSha: sha } };
  assert.equal(parseStationResult(output, operationId), undefined);
  assert.equal(parseStationResult({ ...output, operationId: "77e646cd-a877-43c3-a87f-b69e302e4a94" }, operationId), undefined);
  assert.equal(parseStationResult({ ...output, operationId }, operationId)?.sessionId, "wrun_owner");
});

test("an identical revision replay displays only the owner's matching cached publication", () => {
  const operationId = "d4c2d7da-37da-45ad-a782-c903e59a3c5d";
  const result = { station: "worker", sessionId: "wrun_owner", operationId, revision: sha, summary: "Already done", commands: [], publication: { branch: "factory/owner", number: 2, url: pullUrl(2), headSha: sha, baseSha: sha } };
  const output = { phase: "Already published", result };
  assert.equal(parseStationToolResult("prepare_work", output, operationId)?.sessionId, "wrun_owner");
  assert.equal(parseStationToolResult("prepare_work", output, "77e646cd-a877-43c3-a87f-b69e302e4a94"), undefined);
  assert.equal(parseStationToolResult("prepare_work", { ...output, phase: "Prepared" }, operationId), undefined);
  assert.equal(parseStationToolResult("read_file", output, operationId), undefined);
});
