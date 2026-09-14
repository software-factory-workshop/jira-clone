// Host-owned factory budgets. Keep these values in source control so a
// deployment cannot silently fall back to an uncapped Eve session.
export const factoryModelLimits = {
  maxInputTokensPerSession: 500_000,
  maxOutputTokensPerSession: 100_000,
  maxTokenCostUsdPerSession: 25,
} as const;

export const factoryRepository = "software-factory-workshop/jira-clone";
export const factoryRepositoryUrl = `https://github.com/${factoryRepository}`;

export const vercelTeamName = "demo-software-factory";
export const vercelTeamId = "team_Ljrc7ENgQWsCySwCwijvA0zy";
export const vercelProjects = {
  cockpit: "prj_ZXLHFUJhgo5EdvSf1IstOMn0ft0A",
  jira: "prj_C3sDKTOQIOqpIpNO9w7bqcWYkwp4",
} as const;
export const vercelProjectNames = {
  cockpit: "adeo-factory-cockpit",
  jira: "adeo-jira-clone",
} as const;
export const passportProjectId = vercelProjects.cockpit;

export const githubConnectorName = "github/jira-clone";
export const vercelMachineConnectorName = "factory/jira-clone-machine";
export const vercelMachineCredentialExpiresAt = "2026-10-12";

export const factoryModelIds = {
  taskMiner: "meta/muse-spark-1.3-contributor",
  worker: "meta/muse-spark-1.3-contributor",
  reviewer: "google/gemini-3.8-flash",
} as const;

export const factoryPorts = {
  cockpit: 3000,
  jira: 3001,
  browserFactoryBase: 3100,
  browserJiraBase: 3101,
  taskMiner: 4274,
  worker: 4275,
  reviewer: 4276,
} as const;

export const jiraTestCommand = "node --test tests/*.test.ts";
export const mcpToolkitPackage = "@nuxtjs/mcp-toolkit";
export const mcpToolkitVersion = "0.21.0";
export const mcpZodVersion = "4.6.1";

export const factoryNodeVersion = "24.21.0";
export const factoryPnpmVersion = "10.33.4";
export const agentBrowserVersion = "0.37.1";

export const factoryBlobPaths = {
  cockpit: "factory/cockpit-v1.json",
  stationRegistry: "factory/station-registry-v1.json",
  deliveryPrefix: "factory/delivery/",
  reviewArtifactsPrefix: "factory/review-artifacts/",
} as const;

export const requiredCheckName = "check";
