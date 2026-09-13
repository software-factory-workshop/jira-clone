import assert from "node:assert/strict";
import test from "node:test";
import { deliveryFlow, flowStatusLabels, stationFlow } from "../app/utils/observability-flow.ts";

test("failed activity is named plainly instead of looking cancelled", () => {
  assert.equal(flowStatusLabels.failed, "Failed");
});

test("delivery flow highlights the current handoff and preserves the revision loop", () => {
  const flow = deliveryFlow({
    phase: "reviewing",
    history: [{ phase: "worker_starting" }, { phase: "working" }],
    reviewerSessionId: "reviewer-session",
    publication: { number: 42, targetBranch: "main" },
  });

  assert.equal(flow.activeNodeId, "review");
  assert.equal(flow.nodes.find((node) => node.id === "worker")?.status, "complete");
  assert.equal(flow.nodes.find((node) => node.id === "review")?.status, "active");
  assert.equal(flow.nodes.find((node) => node.id === "revision")?.status, "queued");
  assert.equal(flow.nodes.find((node) => node.id === "worker")?.meta, "PR #42");
  assert.ok(flow.edges.some((edge) => edge.id === "review-revision" && edge.label === "findings"));
});

test("blocked delivery flow marks the failed phase and explains the outcome", () => {
  const flow = deliveryFlow({
    phase: "blocked",
    failedPhase: "reviewing",
    error: "Reviewer could not reach the host",
  });

  assert.equal(flow.nodes.find((node) => node.id === "review")?.status, "failed");
  assert.equal(flow.nodes.find((node) => node.id === "outcome")?.status, "failed");
  assert.equal(flow.nodes.find((node) => node.id === "outcome")?.detail, "Reviewer could not reach the host");
});

test("ready delivery flow shows the merge gate as checked before the outcome", () => {
  const flow = deliveryFlow({ phase: "ready", history: [{ phase: "reviewing" }] });

  assert.equal(flow.nodes.find((node) => node.id === "merge")?.status, "complete");
  assert.equal(flow.nodes.find((node) => node.id === "outcome")?.subtitle, "Ready for merge");
  assert.equal(flow.edges.find((edge) => edge.id === "merge-outcome")?.status, "complete");
});

test("station flow shows the latest Eve action and caps long histories", () => {
  const tools = Array.from({ length: 8 }, (_, index) => ({
    id: `tool-${index}`,
    toolName: index === 7 ? "verify_work" : "bash",
    state: index === 7 ? "input-available" : "output-available",
  }));
  const flow = stationFlow({
    station: "worker",
    active: true,
    ended: false,
    stopped: false,
    needsDecision: false,
    awaitingAuthorization: false,
    taskId: "task-123",
    tools,
  });

  assert.equal(flow.nodes.find((node) => node.id === "earlier-tools")?.title, "2 earlier actions");
  assert.equal(flow.nodes.find((node) => node.id === "tool-7")?.status, "active");
  assert.equal(flow.nodes.find((node) => node.id === "tool-7")?.title, "Verify work");
  assert.equal(flow.activeNodeId, "tool-7");
  assert.equal(flow.nodes.find((node) => node.id === "result")?.status, "queued");
});
