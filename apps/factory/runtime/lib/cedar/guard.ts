import { requireStation, type Station } from "../station-access.ts";
import type { FactoryPrincipal } from "./model.ts";
import { runFactoryOperation, type FactoryDecisionAudit, type RunFactoryOperationInput } from "./operation-runner.ts";

interface StationContext {
  session: {
    auth: {
      initiator?: {
        principalId?: string;
        principalType?: string;
        authenticator?: string;
        attributes: Readonly<Record<string, unknown>>;
      } | null;
    };
  };
}

function scalarTags(attributes: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/** Map only authenticated Eve session identity; station role comes from the host boundary. */
export function factoryPrincipalFromStation(ctx: StationContext, station: Station): FactoryPrincipal {
  requireStation(ctx, station);
  const initiator = ctx.session.auth.initiator;
  if (!initiator?.principalId || !["user", "service", "runtime"].includes(initiator.principalType ?? "")) {
    throw new Error("Factory authorization requires a verified user or service identity.");
  }
  return {
    kind: initiator.principalType === "user" ? "user" : "service",
    id: initiator.principalId,
    tags: {
      ...scalarTags(initiator.attributes),
      role: station,
      station,
      lane: station,
      ...(initiator.authenticator ? { authenticator: initiator.authenticator } : {}),
    },
  };
}

/** This identity is created by the host delivery driver, never supplied by a model. */
export function factoryDeliveryDriverPrincipal(): FactoryPrincipal {
  return {
    kind: "service",
    id: "factory-delivery-driver",
    tags: { role: "merge-coordinator", station: "delivery-driver", lane: "merge" },
  };
}

export type FactoryAuditLogger = { set(value: { factory: { authorization: FactoryDecisionAudit } }): void };

export function auditFactoryDecision(log: FactoryAuditLogger, audit: FactoryDecisionAudit) {
  log.set({ factory: { authorization: audit } });
}

export async function runGuardedFactoryOperation<T>(
  request: Omit<RunFactoryOperationInput<T>, "onAudit"> & { log?: FactoryAuditLogger },
) {
  return runFactoryOperation({
    ...request,
    onAudit: request.log ? (audit) => auditFactoryDecision(request.log!, audit) : undefined,
  });
}
