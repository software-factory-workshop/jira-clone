# Factory verification

## Native Eve task mining — 12 September 2026

The cockpit now invokes native Eve tools directly. The historical fx-backed runs below remain useful evidence about that experiment, but do not verify this replacement.

- Model-free Vercel Sandbox preflight exercised the shared source preparation with 86 working-tree files, including the lockfile and vendored ADEO package. Node 24.21.0 and pnpm 10.33.4 installed successfully; frozen dependency installation, typechecks, tests and both app builds returned exit 0. [Preflight evidence](../factory/mining/native/2026-09-12/preflight.json) identifies the working-tree origin and exclusions. This was a plain SDK adapter, so actual Eve backend validation followed separately.
- Native Eve validation exposed two authentication boundaries before useful findings: an inherited AI Gateway key could override project OIDC, and passing only team/project to the Sandbox SDK selected incomplete explicit credentials. The agent now rejects an ambient Gateway key and the SDK derives all Sandbox credentials from the verified OIDC context. No credential values are recorded.
- The first correctly scoped native investigation hit the original 100,000 cumulative input-token limit after 129,288 input and 4,242 output tokens; reported model cost was $0.007252066. Raising that guard to 500,000 allowed the miner to finish its findings while preserving the $0.20 model-cost ceiling.
- Native baseline `wrun_01M2APMGZHZ1623JT8GZCST4R1` inspected immutable source `a7f5e271321a5f2e6a60495ecbc6ab78b64c923c`, prepared runnable dependencies, verified runtime versions in a fresh native shell and read complete GitHub inventories. It recorded three proposals in 171 seconds: usefulness judgment capture, a bounded Jira demo slice, and stale fx documentation correction. [Original findings and usage](../factory/mining/native/2026-09-12/baseline.json) preserve the report and command evidence.
- The baseline correctly recognized that the exported snapshot has no Git history, despite a compound shell command masking the Git failures with a final exit 0. Its test-success claim is supported by actual test stdout (16 factory tests passed), not just the shell status.
- The report is explicitly **Incomplete**: local development authentication supplies no authenticated Vercel user for the user-scoped connection. The agent named that limitation, excluded evaluation artifacts and inaccessible external research. A successful proposal recording does not validate Vercel deployment access or owner acceptance.
- Baseline reported model usage was 307,415 input / 10,658 output tokens and $0.011476662. Its report was durable before a subsequent invitation hit the 8,000-output-token limit. The supported correction raises output allowance to 16,000; input and dollar ceilings remain unchanged. Subsequent validation is recorded below.

Transfer probe `wrun_01M2APSZB0G0QZXRV8G9XE1BW1` read the updated task-understanding context at `1bbd2ae4721592ed98fac5dedcb62e89a040d4ec`, but exhausted the original 8,000-output-token limit before recording findings (354,145 input / 8,476 output tokens, $0.01166302). It made roughly 35 file reads. This is **not** evidence that the context change improved proposals; [the incomplete probe artifact](../factory/mining/native/2026-09-12/transfer-incomplete.json) preserves that limitation.

The next experiment changes instructions, not tooling: read the required goal/map/active-work context, inspect six relevant additional files and run one probe before drafting a candidate; expand only to resolve a specific necessary question. A second correction distinguishes necessary missing evidence from intentional exclusions: withheld evaluation artifacts and nonexistent comments belong in reflection, not blocking gaps merely because they are absent.

Focused baseline `wrun_01M2AQ0E5CN1HVCD71RC6TPGD5` completed cleanly with all four operational gates passing in 113 seconds. Runtime instructions match `b81899e`; inspected source was `42d335cbb0827b1d17d6be3d84c946b105533161`. [Its evidence](../factory/mining/native/2026-09-12/focused-baseline.json) records 135,587 input / 7,112 output tokens, $0.006952156, and 14 file reads. The report proposes usefulness-feedback capture and a bounded ADEO Jira demo scope, with no connector rebuild or stale-fx correction. Owner usefulness judgment remains pending.

The exclusion-gap hypothesis is supported in this baseline: only unavailable Vercel evidence remains in blocking context gaps; intentional history/CI limitations are recorded in reflection and explicitly not needed for these candidates. The report remains correctly Incomplete for unavailable Vercel access. Source and instructions both changed between runs, so the reduced token usage and absence of stale-document proposals are observations, not an isolated causal estimate. One factual error remains: its first proposal calls the old fx-backed hosted session `wrun_41M2AMEC0K0GKSGJ90PB36X1RY` native. The inspected source had not yet labeled that verification section historical. The original report is preserved; this document now makes the distinction explicit.

Paid validation uses `env -u AI_GATEWAY_API_KEY pnpm exec eve eval task-mining --verbose` from `apps/factory`, with the linked project's OIDC environment. Evaluation prompts and stored findings are excluded from future mining snapshots. Tool-completion gates are operational checks; Remi must still judge proposal usefulness.

## Historical fx-backed task-mining station — 12 September 2026

This section describes the superseded nested Eve/fx implementation, not the current native station. Local verification during that delivery:

- Nuxt and authored-agent typechecks pass; all eight tests pass (draft storage, GitHub input/scope/snapshot boundaries and safe report rendering).
- Both Nuxt production builds and `eve build` pass. CI now compiles the Eve agent as well as the apps.
- A real local Eve session, `wrun_01M2AJWVK77NMP6T3QCMZT0J80`, completed the shared fx miner in 130 seconds. It read revision `b555eb05312e577e289c7046eb28f69bb91317a1`, supplied 45 source files and completed both GitHub inventories (zero issues, zero PRs).
- Browser replay restored the completed report after restarting the local server. A second browser-started session, `wrun_01M2AKBJPQ2PSQ2CBDC5VDHMNH`, resumed the same active sandbox investigation after reload. “Use findings in a draft” populated and focused the existing request editor with findings and provenance.
- The model proposed a concrete demo-scope document, stage-copy alignment and fx provenance. Stage-copy alignment is part of this current delivery; that run inspected the preceding commit. These are proposals, not owner-approved work.
- Explicit H3 1 imports fix Nuxt/Eve helper type collisions. Prebundling `eve/vue` fixes the dev-only CommonJS OIDC import that prevented hydration. Both friction entries were resolved after verification.

- The second browser run was stopped during its sandbox phase. Eve emitted `turn.cancelled`, the cockpit settled to Stopped, and no report was presented as complete.

Initial hosted verification: revision `14dae90` passed CI and deployed Ready, and the signed-in browser created session `wrun_41M2AKG76A0GH9FWYTZ7XZ476Z`. The run failed safely during sandbox startup because the bundle omitted ACP bridge assets. The historical `build:agent` workaround copied and byte-checked those four assets in both the server and hidden Workflow function bundles. CI then also built that Vercel layout. The native replacement removes the fx/ACP dependency and this workaround. The intermediate visible-bundle-only fix was insufficient; an incorrect separate-host-directory assumption then failed CI. The final layout check passed at `e33c729`.

Hosted investigation `wrun_41M2AMEC0K0GKSGJ90PB36X1RY` completed on deployment `dpl_94BpV2bsagEWfBFM3MF8Uey6Qonb` from revision `e33c7299096312cf8322be00ed0cfe7be8ec11bf`. GitHub Actions run `34689821897` passed. An authenticated Chrome session started it at 11:01 UTC; the report was captured at 11:03:48 UTC. The source evidence displayed 62 files at that same revision and complete issue/PR inventories (zero items each, captured at 11:01:51 and 11:01:52 UTC).

The browser reloaded during execution and resumed the same investigation. One live stream ended before completion and the old UI misleadingly showed Stopped; another reload restored Running and then the completed report. The follow-up UI change distinguishes disconnection from an explicit cancellation event and offers Reconnect. This is a transport-state correction, not a second mining run.

Reloading again restored Ready to review with the original 62-file report. “Use findings in a draft” opened Work, populated the request body with the report and provenance, and focused the title. The verification draft was not saved or published; the user's existing tab was left untouched.

Codex reviewed the hosted report: it proposed capturing human usefulness feedback, defining a bounded demo scope, and reconciling stale cockpit planning docs. The stale-doc contradiction was reproduced and corrected as part of this delivery. The other proposals remain for Remi's review. The report also incorrectly treated its truncated manifest read as unavailable revision evidence; the UI's recorded manifest and revision were present. This remains a model investigation-quality limitation, not a missing snapshot.

## Historical stage-zero checks

Checked 12 September 2026.

- `pnpm check`: typechecks, draft-boundary test and both production builds pass.
- Initial GitHub Actions workflow passes installation, typechecks, test and builds.
- Browser: starter request populates title and brief; save survives reload; saved request reopens.
- Browser: project knowledge and factory growth navigation render the expected context and current/planned stages.
- Browser: Jira issue details open/close; search handles an empty result and clearing; board renders all four statuses; status filtering selects the single In Progress fixture.
- Browser: fresh cockpit navigation has no hydration warnings after deferring the connection check until mounted. Jira navigation has no captured browser warnings/errors.
- GitHub: `github/jira-clone` is installed and attached to the cockpit. SDK token exchange followed by a read of the fixed repository returned HTTP 200. No token is returned to the browser.
- Deployment: both projects are linked to the private GitHub repository. Team policy requires Git-origin production deployments; CLI-origin attempts are blocked before build.

This does not verify stage-one agent behavior, issue mutations, Jira API compatibility, application accounts, SAML, directory sync, Jira MCP or demo integrations. They are not implemented in stage zero. The team's platform Passport protection is separate from Jira application accounts.

## Hosted result

Application revision `8308ea9` passed GitHub Actions and both Git-origin production deployments reached Ready.

- https://adeo-factory-cockpit.vercel.app — authenticated HTTP 200; rendered cockpit heading and Nuxt assets present.
- https://adeo-jira-clone.vercel.app — authenticated HTTP 200; rendered issue-list heading and Nuxt assets present.
- Cockpit `/api/github` — HTTP 200, `state: connected`, private repository `software-factory-workshop/jira-clone`, branch `main`.

The unauthenticated browser entry redirects to Vercel authentication. Hosted requests were checked using the Vercel CLI authenticated protection bypass; this does not verify an end-user Passport sign-in flow. Interactive controls and console warnings were checked in the local browser against the same application source.
