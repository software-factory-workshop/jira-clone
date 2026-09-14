import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";
import {
  eventTypes,
  isRecord,
  isSessionTerminal,
  lastToolResultIndex,
  property,
  readNdjsonUntilSessionTerminal,
  stringProperty,
  toolResultEvents,
  toolResultNames,
  toolResultOutput,
} from "./support.ts";

const optIn = "FACTORY_RUN_WORKER_REVISION_EVAL";
const revisionOperationVariable = "FACTORY_WORKER_REVISION_OPERATION_ID";
const revisionPrVariable = "FACTORY_WORKER_REVISION_PR";
const revisionBriefVariable = "FACTORY_WORKER_REVISION_BRIEF";
const workerRootVariable = "FACTORY_WORKER_ROOT";

function publication(value: unknown): Record<string, unknown> | undefined {
  const candidate = property(value, "publication");
  return isRecord(candidate) ? candidate : undefined;
}

function isRevisionPublication(value: unknown, operationId: string, sessionId: string): boolean {
  const result = publication(value);
  const number = property(result, "number");
  const headSha = property(result, "headSha");
  const baseSha = property(result, "baseSha");
  const ownerSessionId = property(result, "ownerSessionId");
  return isRecord(value)
    && property(value, "station") === "worker"
    && property(value, "revisionProtocol") === 1
    && property(value, "operationId") === operationId
    && typeof number === "number"
    && Number.isInteger(number)
    && number > 0
    && typeof headSha === "string"
    && /^[a-f0-9]{40}$/.test(headSha)
    && typeof baseSha === "string"
    && /^[a-f0-9]{40}$/.test(baseSha)
    && ownerSessionId === sessionId;
}

export default defineEval({
  description: "A worker revision continues the same owner and updates one draft PR idempotently",
  tags: ["paid", "worker", "revision", "idempotency"],
  metadata: { optIn, revisionOperationVariable, revisionPrVariable, revisionBriefVariable },
  timeoutMs: 240_000,
  async test(t) {
    if (process.env[optIn] !== "1") {
      t.skip(`Set ${optIn}=1 to exercise an authenticated same-owner worker revision.`);
      return;
    }

    const operationId = process.env[revisionOperationVariable]?.trim();
    const prText = process.env[revisionPrVariable]?.trim();
    const brief = process.env[revisionBriefVariable]?.trim();
    const workerRoot = process.env[workerRootVariable]?.trim() || "worker";
    const prNumber = Number(prText);
    if (!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      throw new Error(`${revisionOperationVariable} must be a UUID for the authenticated revision.`);
    }
    if (!prText || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new Error(`${revisionPrVariable} must name the open PR owned by the worker.`);
    }
    if (!brief || brief.length < 20) {
      throw new Error(`${revisionBriefVariable} must contain the bounded revision brief.`);
    }
    if (workerRoot !== "worker" && workerRoot !== "factory") {
      throw new Error(`${workerRootVariable} must be worker or factory.`);
    }

    const start = await t.target.fetch("/factory/stations/revisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId, prNumber, brief }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!start.ok) throw new Error(`Worker revision start failed with HTTP ${start.status}.`);
    const started: unknown = await start.json();
    const sessionId = stringProperty(started, "sessionId");
    if (!sessionId) throw new Error("Worker revision returned no owner session.");

    const stream = await t.target.fetch(`/${workerRoot}/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`, {
      headers: { accept: "application/x-ndjson" },
      signal: AbortSignal.timeout(180_000),
    });
    const events = await readNdjsonUntilSessionTerminal(stream, 500);
    const prepareResults = toolResultEvents(events, "prepare_work");
    const verifyResults = toolResultEvents(events, "verify_work");
    const publishResults = toolResultEvents(events, "publish_work");
    const successfulPublications = publishResults
      .map(toolResultOutput)
      .filter(value => isRevisionPublication(value, operationId, sessionId));
    const publicationNumbers = successfulPublications.flatMap(value => {
      const number = property(publication(value), "number");
      return typeof number === "number" ? [number] : [];
    });
    const resultNames = toolResultNames(events);
    const lastVerify = lastToolResultIndex(events, "verify_work");
    const lastPublish = lastToolResultIndex(events, "publish_work");

    t.check(eventTypes(events).some(isSessionTerminal), equals(true));
    t.check(prepareResults.length, equals(1));
    t.check(verifyResults.length >= 1 && verifyResults.length <= 3, equals(true));
    t.check(successfulPublications.length >= 1 && successfulPublications.length <= 2, equals(true));
    t.check(new Set(publicationNumbers).size, equals(1));
    t.check(lastVerify >= 0 && lastPublish > lastVerify, satisfies(value => value === true, "publication follows verification"));
    t.check(
      resultNames.filter(name => name === "publish_work").length <= 2,
      equals(true),
    );
    t.log(`Revision ${operationId} produced ${successfulPublications.length} successful publication receipt(s) for PR #${publicationNumbers[0] || prNumber}; the owner session was ${sessionId}.`);
  },
});
