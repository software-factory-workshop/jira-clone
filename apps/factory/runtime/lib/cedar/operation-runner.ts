import { createHash } from "node:crypto";
import type { FactoryActionName } from "./catalog.ts";
import { evaluateFactory, type FactoryAuthorizeResult } from "./engine.ts";
import type { FactoryContext, FactoryPrincipal, FactoryResource } from "./model.ts";

export type FactoryOperationOutcome = "blocked" | "pending" | "succeeded" | "failed" | "threw";

export interface FactoryDecisionAudit {
  readonly decisionId: string;
  readonly operationId: string;
  readonly action: FactoryActionName;
  readonly principal: { kind: FactoryPrincipal["kind"]; id: string };
  readonly resource: { kind: FactoryResource["kind"]; id: string };
  readonly decision: FactoryAuthorizeResult["decision"];
  readonly outcome: FactoryOperationOutcome;
  readonly valid: boolean;
  readonly policyRevision: string;
  readonly schemaRevision: string;
  readonly determiningPolicies: readonly string[];
  readonly errors: readonly string[];
  readonly inputFields: readonly string[];
  readonly contextFields: readonly string[];
  readonly durationMs: number;
  readonly executionError?: string;
}

export interface RunFactoryOperationInput<T> {
  operationId: string;
  principal: FactoryPrincipal;
  action: FactoryActionName;
  input: Record<string, unknown>;
  resource: FactoryResource;
  context: FactoryContext;
  execute: () => PromiseLike<T> | T;
  isSuccess?: (output: T) => boolean;
  onAudit?: (audit: FactoryDecisionAudit) => void;
}

export interface FactoryOperationResult<T> {
  output: T;
  audit: FactoryDecisionAudit;
}

export class FactoryAuthorizationError extends Error {
  readonly audit: FactoryDecisionAudit;

  constructor(message: string, audit: FactoryDecisionAudit) {
    super(message);
    this.name = "FactoryAuthorizationError";
    this.audit = audit;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function decisionId(request: RunFactoryOperationInput<unknown>, evaluation: FactoryAuthorizeResult): string {
  return createHash("sha256")
    .update(
      stableJson({
        operationId: request.operationId,
        principal: request.principal,
        action: request.action,
        resource: request.resource,
        context: request.context,
        input: request.input,
        policyRevision: evaluation.policyRevision,
        schemaRevision: evaluation.schemaRevision,
      }),
    )
    .digest("hex");
}

function boundedError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500);
}

function auditFor(
  request: RunFactoryOperationInput<unknown>,
  evaluation: FactoryAuthorizeResult,
  outcome: FactoryOperationOutcome,
  id: string,
  executionError?: string,
): FactoryDecisionAudit {
  return {
    decisionId: id,
    operationId: request.operationId,
    action: request.action,
    principal: { kind: request.principal.kind, id: request.principal.id },
    resource: { kind: request.resource.kind, id: request.resource.id },
    decision: evaluation.decision,
    outcome,
    valid: evaluation.valid,
    policyRevision: evaluation.policyRevision,
    schemaRevision: evaluation.schemaRevision,
    determiningPolicies: evaluation.determiningPolicies,
    errors: evaluation.errors,
    inputFields: Object.keys(request.input).sort(),
    contextFields: Object.keys(request.context).sort(),
    durationMs: evaluation.durationMs,
    ...(executionError ? { executionError } : {}),
  };
}

function emit(onAudit: RunFactoryOperationInput<unknown>["onAudit"], audit: FactoryDecisionAudit) {
  onAudit?.(audit);
}

/** Cedar -> trusted operation -> audit. Durable host state remains the CAS/idempotency boundary. */
export async function runFactoryOperation<T>(request: RunFactoryOperationInput<T>): Promise<FactoryOperationResult<T>> {
  const evaluation = evaluateFactory({
    principal: request.principal,
    action: request.action,
    input: request.input,
    resource: request.resource,
    context: request.context,
  });
  const id = decisionId(request as RunFactoryOperationInput<unknown>, evaluation);

  if (!evaluation.valid || evaluation.decision !== "ALLOW") {
    const audit = auditFor(request as RunFactoryOperationInput<unknown>, evaluation, "blocked", id);
    emit(request.onAudit, audit);
    const reason = !evaluation.valid
      ? "Factory Cedar evaluation failed closed; the operation was not executed."
      : evaluation.determiningPolicies.length
        ? `Factory Cedar denied the operation: ${evaluation.determiningPolicies.join(", ")}.`
        : "Factory Cedar denied the operation by default.";
    throw new FactoryAuthorizationError(reason, audit);
  }

  emit(request.onAudit, auditFor(request as RunFactoryOperationInput<unknown>, evaluation, "pending", id));
  let output: T;
  try {
    output = await request.execute();
  } catch (error) {
    const audit = auditFor(request as RunFactoryOperationInput<unknown>, evaluation, "threw", id, boundedError(error));
    emit(request.onAudit, audit);
    throw error;
  }

  const succeeded = request.isSuccess ? request.isSuccess(output) : true;
  const audit = auditFor(request as RunFactoryOperationInput<unknown>, evaluation, succeeded ? "succeeded" : "failed", id);
  emit(request.onAudit, audit);
  return { output, audit };
}
