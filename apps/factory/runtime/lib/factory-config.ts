// Host-owned factory budgets. Keep these values in source control so a
// deployment cannot silently fall back to an uncapped Eve session.
export const factoryModelLimits = {
  maxInputTokensPerSession: 500_000,
  maxOutputTokensPerSession: 100_000,
  maxTokenCostUsdPerSession: 25,
} as const;
