# Task mining: the first agent station

The input is a question or an open request to find useful work. The output is up to three ranked proposals with evidence, acceptance criteria, uncertainties and a reflection. No proposal is automatically approved, implemented or published.

## Execution

The Nuxt cockpit and Eve 0.52.5 deploy together through `eve/nuxt`. Eve owns the durable session and streams the investigation tool's progress and result. The tool fetches the current `main` commit, then its immutable Git tree and blobs through the app's `github/jira-clone` Connect connection. It excludes environment files, binary packages, dependencies, the lockfile and held-out mining evaluations/runs. The source manifest records each supplied path, byte count and SHA-256.

The shared `packages/task-miner/runtime.mjs` runs fx through AI SDK Harness in a fresh Vercel Sandbox. Its only custom tool reads this repository's issues, pull requests and comments. Inventories include closed items and follow pagination; failed or truncated reads fail the investigation rather than becoming an empty backlog. A successful result requires a completed model response and complete issue and PR inventories.

Both the model and Sandbox use the cockpit's scoped Vercel OIDC credential. The runtime checks `demo-software-factory`, its team ID and the cockpit project ID before spending. The model is `meta/muse-spark-1.3-contributor`; no personal fx configuration or inherited API key is selected. GitHub credentials stay in the host tool, outside the sandbox and report.

The investigation has a five-minute runtime deadline, at most 30 harness steps and four native approval continuations. Only the fixed GitHub read tool is approved. The Eve wrapper has separate model usage limits; those do not account for the miner's calls or Sandbox infrastructure. Sandbox network access is not a domain allowlist. Read-only tool permissions, fixed-repository access and prompt constraints are distinct controls; do not claim a network-isolated environment.

## Review and persistence

The cockpit displays the original findings rather than asking a second model to rewrite them. It stores the report, source revision/manifest and GitHub evidence in the durable Eve tool result. “Use findings in a draft” opens the existing editable request form; saving stays browser-local. Publishing still requires the person to submit the prefilled GitHub issue.

The recent-investigation index stores session links in this browser. Opening a link replays the Eve stream from zero and follows an active turn. Navigating away disconnects the browser without cancelling the run. “Stop investigation” requests durable cancellation. A failed run is labelled incomplete and can be retried in a new session. One investigation is allowed per session.

An interrupted tool step may be replayed by Eve and repeat read-only work and model spend. Completed steps are durable; this is not an exactly-once billing guarantee. The Sandbox has its own expiry and is destroyed in the tool's cleanup path.

## Access and scope

All deployments remain protected with Vercel Passport. The Eve channel accepts the platform-injected visitor identity or verified project OIDC; local development accepts only Eve's local-dev context. This is a shared workshop workspace: admitted users may access its sessions. There is no per-user run ACL or cross-browser investigation directory yet. Platform admission is not Jira application accounts, SAML, directory sync or Jira API parity.

Reflections are suggestions until reviewed. Moving a reflection into repository context or changing factory instructions is a separate human-steered change; the agent cannot activate its own rules.

## Local calibration

Pull the cockpit's development environment from Vercel with the explicit `demo-software-factory` scope. Keep the ignored `.env.local` in `apps/factory`; never commit tokens. Start the cockpit with `pnpm --filter @jira-clone/factory dev`. After changing Nuxt configuration or installing dependencies, restart the full dev command: this Eve/Nuxt version can otherwise retain a proxy to its stopped child process. The existing calibration command still runs the shared miner and writes held-out artifacts under `factory/mining/runs/`.

Use a fresh question and judge the proposals against the current goal, code and issues. Check evidence and ranking separately from transport success. Record verification in `docs/verification.md`; do not treat a green build as proof of a useful investigation.
