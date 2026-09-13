import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import { FACTORY_POLICY_REVISION, FACTORY_POLICY_TEXT } from "../runtime/lib/cedar/generated-policies.ts";
import { evaluateFactory, factoryPolicyManifest, validateFactoryPolicies } from "../runtime/lib/cedar/engine.ts";
import { changeResource, repositoryResource } from "../runtime/lib/cedar/model.ts";
import { runFactoryOperation, FactoryAuthorizationError } from "../runtime/lib/cedar/operation-runner.ts";
import { FACTORY_POLICY_METADATA } from "../runtime/lib/cedar/policy-metadata.ts";
import { FACTORY_SCHEMA_REVISION, getFactoryCedarSchema } from "../runtime/lib/cedar/schema.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyRoot = resolve(appRoot, "../../factory/policies/cedar");
const candidateSha = "a".repeat(64);
const baseSha = "b".repeat(40);
const branch = "factory/work-test";

const worker = { kind: "service" as const, id: "oidc:worker", tags: { role: "worker", station: "worker", lane: "worker" } };
const reviewer = { kind: "service" as const, id: "oidc:reviewer", tags: { role: "reviewer", station: "reviewer", lane: "reviewer" } };
const mergeDriver = { kind: "service" as const, id: "factory-delivery-driver", tags: { role: "merge-coordinator", station: "delivery-driver", lane: "merge" } };

function change(overrides: Partial<Parameters<typeof changeResource>[0]> = {}) {
  return changeResource({
    id: "operation-1",
    taskId: "task-1",
    candidateSha,
    baseSha,
    branch,
    expectedRevision: baseSha,
    ...overrides,
  });
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    expectedRevision: baseSha,
    candidateSha,
    baseSha,
    verifiedSha: candidateSha,
    branch,
    lane: "worker" as const,
    budget: 0,
    riskClass: "low" as const,
    evidence: { id: "verification-1", source: "factory.verify_work", complete: true, candidateSha },
    ...overrides,
  };
}

test("canonical Cedar files are generated, strictly validated, and revisioned", async () => {
  const report = validateFactoryPolicies();
  assert.equal(report.ok, true, report.issues.map((issue) => issue.message).join("\n"));
  assert.equal(report.policyCount, FACTORY_POLICY_METADATA.length);
  assert.match(FACTORY_POLICY_REVISION, /^sha256:[a-f0-9]{64}$/);
  assert.match(FACTORY_SCHEMA_REVISION, /^sha256:[a-f0-9]{64}$/);
  const records = [] as Array<{ id: string; text: string }>;
  for (const metadata of [...FACTORY_POLICY_METADATA].sort((left, right) => left.id.localeCompare(right.id))) {
    const text = await readFile(resolve(policyRoot, `${metadata.id}.cedar`), "utf8");
    records.push({ id: metadata.id, text });
    assert.equal(FACTORY_POLICY_TEXT[metadata.id], text, metadata.id);
  }
  assert.equal(
    FACTORY_POLICY_REVISION,
    `sha256:${createHash("sha256").update(records.map(({ id, text }) => `${id}\n${text}`).join("\n")).digest("hex")}`,
  );
  const manifest = factoryPolicyManifest();
  assert.equal(manifest.schema, getFactoryCedarSchema());
  assert.equal(manifest.policies.length, 13);
  assert.ok(manifest.actions.every((action) => "inputSchema" in action));
});

test("worker publication is allowed only for its verified candidate and factory branch", () => {
  const result = evaluateFactory({
    principal: worker,
    action: "publish_change",
    input: { branch, candidateSha, baseSha, draft: true },
    resource: change(),
    context: context(),
  });
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.decision, "ALLOW");
  assert.deepEqual(result.determiningPolicies, ["factory-worker-publishes-verified-change"]);

  const stale = evaluateFactory({
    principal: worker,
    action: "publish_change",
    input: { branch, candidateSha, baseSha, draft: true },
    resource: change({ expectedRevision: "c".repeat(40) }),
    context: context(),
  });
  assert.equal(stale.decision, "DENY");
  assert.ok(stale.determiningPolicies.includes("factory-forbid-stale-change-state"));

  const defaultBranch = evaluateFactory({
    principal: worker,
    action: "publish_change",
    input: { branch: "main", candidateSha, baseSha, draft: true },
    resource: change({ branch: "main" }),
    context: context({ branch: "main" }),
  });
  assert.equal(defaultBranch.decision, "DENY");
  assert.ok(defaultBranch.determiningPolicies.includes("factory-forbid-default-branch-publication"));
});

test("review, verification, checks, and low-risk merge bind their host roles", () => {
  const review = evaluateFactory({
    principal: reviewer,
    action: "record_review",
    input: { reviewId: "review-1", verdict: "approved", reviewedSha: candidateSha },
    resource: change(),
    context: context({ lane: "reviewer", reviewedSha: candidateSha, evidence: { id: "review-1", source: "factory.review_gate", complete: true, candidateSha } }),
  });
  assert.equal(review.decision, "ALLOW", review.errors.join("\n"));
  assert.ok(review.determiningPolicies.includes("factory-reviewer-records-review"));

  const check = evaluateFactory({
    principal: reviewer,
    action: "run_check",
    input: { checkId: "typecheck", command: "pnpm typecheck" },
    resource: repositoryResource(),
    context: context({ lane: "reviewer", expectedRevision: candidateSha, baseSha, evidence: { id: "prepare-1", source: "factory.prepare_review", complete: true, candidateSha } }),
  });
  assert.equal(check.decision, "ALLOW", check.errors.join("\n"));

  const mergeSha = "d".repeat(40);
  const merge = evaluateFactory({
    principal: mergeDriver,
    action: "merge_change",
    input: { pullRequest: "42", targetBranch: "main" },
    resource: change({ id: "42", candidateSha: mergeSha, baseSha, branch: "main", expectedRevision: baseSha }),
    context: { expectedRevision: baseSha, candidateSha: mergeSha, baseSha, verifiedSha: mergeSha, reviewedSha: mergeSha, branch: "main", lane: "merge", budget: 0, riskClass: "low", evidence: { id: "merge-1", source: "factory.merge-policy", complete: true, candidateSha: mergeSha } },
  });
  assert.equal(merge.decision, "ALLOW", merge.errors.join("\n"));
  assert.ok(merge.determiningPolicies.includes("factory-delivery-driver-merges-low-risk-change"));

  const elevated = evaluateFactory({
    principal: mergeDriver,
    action: "merge_change",
    input: { pullRequest: "42", targetBranch: "main" },
    resource: change({ id: "42", candidateSha: mergeSha, baseSha, branch: "main", expectedRevision: baseSha }),
    context: { expectedRevision: baseSha, candidateSha: mergeSha, baseSha, verifiedSha: mergeSha, reviewedSha: mergeSha, branch: "main", lane: "merge", budget: 0, riskClass: "elevated", evidence: { id: "merge-1", source: "factory.merge-policy", complete: true, candidateSha: mergeSha } },
  });
  assert.equal(elevated.decision, "DENY");
  assert.ok(elevated.determiningPolicies.includes("factory-forbid-elevated-auto-merge"));
});

test("missing evidence and unbound services fail closed", () => {
  const missing = evaluateFactory({
    principal: worker,
    action: "publish_change",
    input: { branch, candidateSha, baseSha, draft: true },
    resource: change(),
    context: context({ evidence: undefined }),
  });
  assert.equal(missing.decision, "DENY");
  assert.ok(missing.determiningPolicies.includes("factory-forbid-missing-evidence"));

  const unknownService = evaluateFactory({
    principal: { kind: "service", id: "oidc:unknown", tags: { role: "unknown" } },
    action: "publish_change",
    input: { branch, candidateSha, baseSha, draft: true },
    resource: change(),
    context: context(),
  });
  assert.equal(unknownService.decision, "DENY");
  assert.ok(unknownService.determiningPolicies.includes("factory-forbid-unbound-service-mutation"));
});

test("trusted operation runner never executes a denied operation and emits redacted decision audits", async () => {
  const audits: Array<{ outcome: string; inputFields: readonly string[] }> = [];
  let executed = false;
  await assert.rejects(
    runFactoryOperation({
      operationId: "operation-denied",
      principal: worker,
      action: "publish_change",
      input: { branch, candidateSha, baseSha, draft: true },
      resource: change(),
      context: context({ evidence: undefined }),
      execute: async () => {
        executed = true;
        return true;
      },
      onAudit: (audit) => audits.push(audit),
    }),
    FactoryAuthorizationError,
  );
  assert.equal(executed, false);
  assert.equal(audits[0]?.outcome, "blocked");
  assert.deepEqual(audits[0]?.inputFields, ["baseSha", "branch", "candidateSha", "draft"]);

  audits.length = 0;
  const result = await runFactoryOperation({
    operationId: "operation-allowed",
    principal: worker,
    action: "publish_change",
    input: { branch, candidateSha, baseSha, draft: true },
    resource: change(),
    context: context(),
    execute: async () => "receipt",
    onAudit: (audit) => audits.push(audit),
  });
  assert.equal(result.output, "receipt");
  assert.equal(result.audit.outcome, "succeeded");
  assert.deepEqual(audits.map((audit) => audit.outcome), ["pending", "succeeded"]);
});
