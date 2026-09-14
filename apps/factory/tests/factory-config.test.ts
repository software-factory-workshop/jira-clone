import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentBrowserVersion,
  factoryBlobPaths,
  factoryModelIds,
  factoryNodeVersion,
  factoryPnpmVersion,
  factoryPorts,
  factoryRepository,
  factoryRepositoryUrl,
  githubConnectorName,
  jiraTestCommand,
  mcpToolkitPackage,
  mcpToolkitVersion,
  mcpZodVersion,
  passportProjectId,
  requiredCheckName,
  vercelMachineConnectorName,
  vercelMachineCredentialExpiresAt,
  vercelProjectNames,
  vercelProjects,
  vercelTeamId,
  vercelTeamName,
} from "../runtime/lib/factory-config.ts";

test("factory delivery configuration keeps host bindings in one plain module", () => {
  assert.equal(factoryRepository, "software-factory-workshop/jira-clone");
  assert.equal(factoryRepositoryUrl, `https://github.com/${factoryRepository}`);
  assert.deepEqual(vercelProjects, {
    cockpit: "prj_ZXLHFUJhgo5EdvSf1IstOMn0ft0A",
    jira: "prj_C3sDKTOQIOqpIpNO9w7bqcWYkwp4",
  });
  assert.deepEqual(vercelProjectNames, { cockpit: "adeo-factory-cockpit", jira: "adeo-jira-clone" });
  assert.equal(passportProjectId, vercelProjects.cockpit);
  assert.equal(vercelTeamName, "demo-software-factory");
  assert.equal(vercelTeamId, "team_Ljrc7ENgQWsCySwCwijvA0zy");
  assert.equal(githubConnectorName, "github/jira-clone");
  assert.equal(vercelMachineConnectorName, "factory/jira-clone-machine");
  assert.equal(vercelMachineCredentialExpiresAt, "2026-10-12");
  assert.deepEqual(factoryModelIds, {
    taskMiner: "openai/gpt-5.6-sol-fast",
    worker: "openai/gpt-5.6-sol-fast",
    reviewer: "zai/glm-5.3-flash",
  });
  assert.deepEqual(factoryPorts, { cockpit: 3000, jira: 3001, browserFactoryBase: 3100, browserJiraBase: 3101, taskMiner: 4274, worker: 4275, reviewer: 4276 });
  assert.equal(jiraTestCommand, "node --test tests/*.test.ts");
  assert.equal(mcpToolkitPackage, "@nuxtjs/mcp-toolkit");
  assert.equal(mcpToolkitVersion, "0.21.0");
  assert.equal(mcpZodVersion, "4.6.1");
  assert.equal(factoryNodeVersion, "24.21.0");
  assert.equal(factoryPnpmVersion, "10.33.4");
  assert.equal(agentBrowserVersion, "0.37.1");
  assert.deepEqual(factoryBlobPaths, {
    cockpit: "factory/cockpit-v1.json",
    stationRegistry: "factory/station-registry-v1.json",
    deliveryPrefix: "factory/delivery/",
    reviewArtifactsPrefix: "factory/review-artifacts/",
  });
  assert.equal(requiredCheckName, "check");
});
