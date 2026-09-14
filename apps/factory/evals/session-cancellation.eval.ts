import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { eventTypes } from "./support.ts";

const optIn = "FACTORY_RUN_SESSION_CANCELLATION_EVAL";

export default defineEval({
  description: "Cancelling an in-flight Eve turn records cancellation without a false completion",
  tags: ["paid", "lifecycle", "cancellation"],
  metadata: { optIn },
  timeoutMs: 120_000,
  async test(t) {
    if (process.env[optIn] !== "1") {
      t.skip(`Set ${optIn}=1 to spend on the in-flight cancellation probe.`);
      return;
    }

    const live = await t.start([
      "Begin a read-only task-mining investigation of the current factory.",
      "Do not make changes or remote writes. Start the investigation and keep the turn in progress while the caller decides whether to continue.",
    ].join(" "));
    await live.waitForEvent("step.started");
    await live.cancel();
    const turn = await live.result();

    turn.event("turn.cancelled", { count: 1 });
    turn.notEvent("turn.completed");
    t.eventOrder([
      { type: "turn.started", count: 1 },
      { type: "turn.cancelled", count: 1 },
    ]);
    t.check(eventTypes(turn.events).includes("turn.completed"), equals(false));
    t.log("Cancellation is evaluated as its own terminal protocol outcome; a durable session may remain available for a later turn.");
  },
});
