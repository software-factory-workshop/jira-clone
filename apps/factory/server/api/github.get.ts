import { defineEventHandler, setResponseHeader, setResponseStatus } from "h3";
import { getToken, ConnectError } from "@vercel/connect";
import { z } from "zod";
import { repository } from "@jira-clone/context";

const repositorySchema = z.object({
  full_name: z.literal(repository.name),
  private: z.boolean(),
  default_branch: z.string(),
  open_issues_count: z.number().int().nonnegative(),
});

// This endpoint is deployed behind the project's all-deployment protection.
// It reads only this workshop repository, never a caller-supplied repository.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
  try {
    const token = await getToken("github/jira-clone", {
      subject: { type: "app" },
    });
    const response = await fetch(
      `https://api.github.com/repos/${repository.name}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      setResponseStatus(event, 503);
      return {
        state: "unavailable" as const,
        message:
          response.status === 404
            ? "The GitHub installation cannot access jira-clone yet."
            : "GitHub repository access is temporarily unavailable.",
      };
    }
    const data = repositorySchema.parse(await response.json());
    return {
      state: "connected" as const,
      name: data.full_name,
      private: data.private,
      branch: data.default_branch,
      openItems: data.open_issues_count,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    setResponseStatus(event, 503);
    // Do not expose provider error bodies, token data or infrastructure details.
    return {
      state: "unavailable" as const,
      message:
        error instanceof ConnectError
          ? "The GitHub connection needs installation or project access. Check Vercel Connect."
          : "Repository context could not be loaded. Try again shortly.",
    };
  }
});
