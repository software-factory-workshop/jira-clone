import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationLink, miningProgress, parseMiningOutput } from "../app/utils/mining-output.ts";

const capturedAt = "2026-09-12T12:00:00.000Z";
const revision = "a".repeat(40);

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
