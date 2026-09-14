import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { factoryModelIds } from "../runtime/lib/factory-config.ts";

const optIn = "FACTORY_RUN_INJECTED_DEFECT_EVAL";
const fixture = readFileSync(join(process.cwd(), "tests/fixtures/defects/non-persisting-save/README.md"), "utf8");
const candidate = readFileSync(join(process.cwd(), "tests/fixtures/defects/non-persisting-save/candidate.patch"), "utf8");

type EventRecord = Record<string, unknown> & { type?: unknown };

function record(value: unknown): EventRecord | undefined {
  return typeof value === "object" && value !== null ? value as EventRecord : undefined;
}

function field(value: unknown, key: string): unknown {
  return record(value)?.[key];
}

async function reviewerEvents(response: Response): Promise<EventRecord[]> {
  if (!response.ok) throw new Error(`Reviewer stream failed with HTTP ${response.status}.`);
  if (!response.body) throw new Error("Reviewer stream returned no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: EventRecord[] = [];
  let pending = "";
  const consume = (line: string) => {
    if (!line.trim()) return false;
    const event = record(JSON.parse(line));
    if (!event) return false;
    events.push(event);
    if (events.length > 2000) throw new Error("Reviewer stream exceeded the 2,000-event safety bound.");
    return ["session.completed", "session.failed", "session.waiting"].includes(String(event.type));
  };
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      if (lines.some(consume)) break;
      if (chunk.done) {
        if (pending.trim()) consume(pending);
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return events;
}

export default defineEval({
  description: "Paid real-reviewer eval for the injected non-persisting-save candidate",
  tags: ["paid", "reviewer", "injected-defect"],
  metadata: { optIn, reviewerModel: factoryModelIds.reviewer },
  async test(t) {
    if (process.env[optIn] !== "1") {
      t.skip(`Set ${optIn}=1 to spend on the real reviewer.`);
      return;
    }
    const prText = process.env.FACTORY_INJECTED_DEFECT_PR?.trim();
    const prNumber = Number(prText);
    if (!prText || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new Error("FACTORY_INJECTED_DEFECT_PR must name the open PR containing the injected fixture.");
    }

    // This eval targets the factory cockpit origin. The existing host station
    // route starts the independent reviewer service and attaches immutable
    // station auth before its first turn; no reviewer model is mocked here.
    const start = await t.target.fetch("/factory/stations/reviewer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId: randomUUID(), prNumber }),
    });
    if (!start.ok) throw new Error(`Reviewer station start failed with HTTP ${start.status}.`);
    const started = record(await start.json());
    const sessionId = field(started, "sessionId");
    if (typeof sessionId !== "string" || sessionId.length === 0) throw new Error("Reviewer station returned no session.");

    const stream = await t.target.fetch(`/reviewer/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`, {
      headers: { accept: "application/x-ndjson" },
    });
    const events = await reviewerEvents(stream);
    const reviewEvent = events.find(event => field(field(event, "data"), "result") && field(field(field(event, "data"), "result"), "toolName") === "record_review");
    const output = field(field(field(reviewEvent, "data"), "result"), "output");
    const modelEvent = events.find(event => event.type === "step.started" && field(field(event, "data"), "modelId") === factoryModelIds.reviewer);

    t.check(modelEvent !== undefined, equals(true));
    t.check(output !== undefined, equals(true));
    t.check(field(output, "verdict"), equals("changes_requested"));
    t.log(`Reviewed ${fixture.split("\n", 1)[0]} with the injected candidate patch (${candidate.length} bytes).`);
  },
});
