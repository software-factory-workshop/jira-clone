import { defineAgent } from "eve";

export default defineAgent({
  model: "meta/muse-spark-1.3-contributor",
  defaultTools: false,
  limits: {
    maxInputTokensPerSession: 100_000,
    maxOutputTokensPerSession: 8_000,
    maxTokenCostUsdPerSession: 0.2,
  },
  build: { externalDependencies: ["@jira-clone/task-miner"] },
});
