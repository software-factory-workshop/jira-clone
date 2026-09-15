import { createHash } from "node:crypto";
import { connectGitHubCredentials } from "@vercel/connect/eve";
import { githubChannel } from "eve/channels/github";
import { factoryRepository, githubConnectorName } from "../../../../runtime/lib/factory-config.ts";

const reviewActions = ["opened", "reopened", "ready_for_review", "synchronize"];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function operationId(repository: string, number: number, headSha: string) {
  const value = createHash("sha256").update(`${repository}:visual-review:${number}:${headSha}`).digest("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

export default githubChannel({
  credentials: connectGitHubCredentials(githubConnectorName),
  onPullRequest(context, pullRequest) {
    if (!reviewActions.includes(pullRequest.action) || context.repository.fullName !== factoryRepository || !pullRequest.headSha) return null;

    const rawPullRequest = record(pullRequest.raw.pull_request);
    const head = record(rawPullRequest?.head);
    const body = stringValue(rawPullRequest?.body);
    const headRef = stringValue(head?.ref);
    // Only review PRs created by the factory publication path. This keeps the
    // GitHub App from becoming an unsolicited reviewer for human PRs.
    if (!body?.includes("<!-- Factory-Owner:") || !headRef?.startsWith("factory/work-")) return null;

    const request = {
      operationId: operationId(context.repository.fullName, pullRequest.pullRequestNumber, pullRequest.headSha),
      prNumber: pullRequest.pullRequestNumber,
    };
    return {
      auth: {
        authenticator: "github-factory",
        principalId: `github:${context.repository.fullName}`,
        principalType: "service",
        attributes: {
          provider: "github",
          factoryStation: "reviewer",
          factoryRequest: JSON.stringify(request),
        },
      },
      title: `Visual review PR #${pullRequest.pullRequestNumber}`,
      context: [`Run the independent visual review for the factory-owned PR #${pullRequest.pullRequestNumber}. The candidate head from the webhook is ${pullRequest.headSha}.`],
    };
  },
});
