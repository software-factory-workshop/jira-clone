import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const projects = ["adeo-factory-cockpit", "adeo-jira-clone"];
export function deploymentStatus(response, sha) {
  if (response.sha !== sha || !Array.isArray(response.statuses)) throw new Error("GitHub returned status for a different revision or an invalid response.");
  return projects.map(project => {
    const status = response.statuses.find(item => item.context === `Vercel – ${project}`);
    if (!status) return { project, state: "pending" };
    const prefix = `https://vercel.com/demo-software-factory/${project}/`;
    if (!status.target_url?.startsWith(prefix)) throw new Error(`Unexpected Vercel team/project URL for ${project}.`);
    if (!["success", "pending", "failure", "error"].includes(status.state)) throw new Error(`Unknown deployment status for ${project}.`);
    return { project, state: status.state, url: status.target_url };
  });
}
async function main() {
  const sha = process.env.VERIFY_COMMIT_SHA;
  const token = process.env.GITHUB_TOKEN;
  if (!sha || !/^[a-f0-9]{40}$/.test(sha) || !token) throw new Error("Expected exact commit SHA and read-only GitHub workflow token.");
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.github.com/repos/software-factory-workshop/jira-clone/commits/${sha}/status`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Cannot read deployment status: HTTP ${response.status}.`);
    const statuses = deploymentStatus(await response.json(), sha);
    for (const status of statuses) console.log(`${status.project}: ${status.state}${status.url ? ` (${status.url})` : ""}`);
    if (statuses.some(status => status.state === "failure" || status.state === "error")) throw new Error("Vercel deployment failed; inspect the linked build instead of accepting local output.");
    if (statuses.every(status => status.state === "success")) {
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Verified Vercel deployments for commit \`${sha}\`:\n\n${statuses.map(status => `- [${status.project}](${status.url})`).join("\n")}\n\nThe cockpit build includes authenticated Eve sandbox-template preparation and native-output verification. This is deployment evidence, not an agent behavior test.\n`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 20_000));
  }
  throw new Error("Timed out waiting for both Vercel deployments on the exact commit. Missing or blocked previews do not count as verified.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
