import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "A completed Eve turn settles into a reusable waiting session without being misclassified as stuck",
  tags: ["native", "paid", "lifecycle", "fast"],
  timeoutMs: 180_000,
  async test(t) {
    await t.send("Reply with the exact phrase `settlement probe` and do not use any tools.");
    t.succeeded();
    t.eventOrder([
      { type: "turn.completed", count: 1 },
      { type: "session.waiting", count: 1 },
    ]);
    t.notEvent("turn.failed");
    t.notEvent("turn.cancelled");
    t.messageIncludes("settlement probe");
    t.check(t.reply, includes("settlement probe"));
  },
});
