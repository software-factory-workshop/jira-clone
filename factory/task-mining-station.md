# Task mining: the first agent station

The input is a question or an open request to find useful work. The output is up to three ranked proposals with evidence, acceptance criteria, uncertainties and a reflection. No proposal is automatically approved, implemented or published.

The station uses native Eve. The earlier fx experiment remains separately packaged for calibration; it is not part of the deployed agent's execution path. See [dated verification](../docs/verification.md) for what has actually run. Source configuration alone does not establish hosted access or proposal usefulness.

## Context and execution

The Nuxt cockpit and Eve 0.52.5 deploy together through `eve/nuxt`. Eve runs `meta/muse-spark-1.3-contributor` directly, owns the durable session and streams its native tool activity. It has repository search and file tools, a shell for local reproduction, fixed-repository GitHub reads, scoped Vercel reads and `record_findings`.

`prepare_context` obtains the current `main` revision and immutable source through the app's `github/jira-clone` Connect connection. It supplies a working tree with the lockfile and vendored ADEO package, and installs Node 24.21.0, pnpm 10.33.4 and frozen dependencies. The manifest records the original revision, paths, sizes, hashes and exclusions. Credentials, local Git history, fx experiment files and held-out evaluations/runs are excluded. A run must report missing context rather than claim to have read those files.

The agent first reads the goal, project map, active work and applicable repository guidance. It then inspects actual code and live work before choosing focused checks. GitHub inventories include closed items and follow pagination. Failed or truncated reads are unavailable evidence, not an empty backlog. Vercel tools cover only the Jira and cockpit projects in `demo-software-factory`; receipt metadata and access gaps accompany findings. The user-scoped Vercel connection may pause a session for authorization. The cockpit renders Eve's connection prompt and keeps the same session while the callback resumes it. Verify actual connection access in the preflight and run evidence.

The native Sandbox has four CPUs and a ten-minute expiry. Local commands may create disposable probe files and build outputs. Integration credentials remain host-side, outside the sandbox. There are no remote publication or configuration tools. This is not a claim of network isolation: shell permissions, provider scopes and prompt constraints are separate controls.

## Findings and evidence

`record_findings` accepts structured proposals and a reflection. The host renders their report and attaches the recorded repository manifest, GitHub/Vercel receipts and command results. The model cannot supply replacement source identities or exit codes through that tool. Command output retains the last 12,000 characters of stdout and stderr, with a truncation flag when applicable.

A record is incomplete if context preparation failed, either issue or PR inventory is missing, either project lacks Vercel project/deployment evidence, no post-setup command was recorded, or context gaps remain. Those checks establish the presence of evidence, not its relevance or the quality of a proposal. A passing command may test the wrong behavior; a reviewer must inspect what actually ran.

The cockpit displays incomplete findings with their gaps and displays recorded failures alongside the report. It can also replay historical fx-backed sessions. "Use findings in a draft" carries the report, investigation identity, source revision and completion status into the existing editable form. Saving remains browser-local. Publishing requires the person to submit the prefilled GitHub issue.

## Persistence, limits and access

The recent-investigation index stores session links in this browser. Opening a link replays the Eve stream and follows an active turn. Navigating away disconnects the browser without cancelling the run. "Stop investigation" requests cancellation; a disconnected stream is not evidence of cancellation. The station records findings once per session, and another investigation starts a fresh session.

Eve enforces the configured session model limits: 100,000 input tokens, 8,000 output tokens and USD 0.20 model cost. Sandbox infrastructure is a separate charge. There is no nested fx model budget. The run uses the cockpit's explicit Vercel team/project scope. Do not automatically approve additional budget or treat an interrupted step as an exactly-once billing guarantee.

Turn-completion and cancellation hooks stop Sandbox compute, with its ten-minute expiry as a backstop. See dated cancellation verification for the paths actually exercised.

All deployments remain protected with Vercel Passport. The Eve channel accepts the platform-injected visitor identity or verified project OIDC; local development accepts Eve's local-dev context. This is a shared workshop workspace: admitted users may access its sessions. There is no per-user run ACL or cross-browser investigation directory. Platform admission is separate from Jira application accounts, SAML, directory sync and Jira API parity.

## Growing context

Before paying for reasoning, the model-free preflight should verify the same source preparation and integration access used by the station, then run the repository checks. Preserve actual commands, exit codes, revision and timestamps. A green local build alone does not establish that the hosted agent has those capabilities.

Use cheap Muse investigations to test a specific context hypothesis. Compare the baseline request and a differently worded probe. Review whether the findings fit the factory-first goal, account for active work, cite observed evidence and propose an outcome Remi would seriously consider. When a run misunderstands the project, change the relevant context and test whether the improvement transfers.

Reflections are reviewable suggestions until accepted. Updating project context or factory instructions is a separate human-steered change. The miner cannot activate its own rules or rewrite its evaluation criteria.

## Research basis

The inspected [Foreman analyst](https://github.com/vercel-labs/eve-software-factory-template/tree/0d630a284b84e5be38fe7eceec7b231a7e79bfd0/agent/subagents/analyst) requires reading code before naming implementation targets. Its shared repository setup separates preparation from station reasoning. The [Academy investigator](https://github.com/vercel-labs/academy-software-factory/tree/e863458a441e36bb926ddcecca3368f57f3f33f0/agent/subagents) distinguishes a reported premise from reproduced behavior and carries evidence into review. These inform this station's context and evidence contract; we have not imported their multi-agent pipelines or inferred runtime guarantees from their instructions.

Start local development with `pnpm --filter @jira-clone/factory dev`. Keep pulled Vercel credentials in the ignored cockpit environment file and select `demo-software-factory` explicitly. Restart the full dev command after changing Nuxt configuration or installing dependencies, because this Eve/Nuxt version can otherwise retain a proxy to its stopped child process.
