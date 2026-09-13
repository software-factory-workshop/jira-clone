# Factory verification

## First worker PR — 12 September 2026

Native Eve worker `wrun_41M2AVC0FK0GPK3KVJFW3B1QA3`, dispatched by cockpit session `wrun_41M2AVBS640GXB6E761Y5HCQTT`, published [draft PR #2](https://github.com/software-factory-workshop/jira-clone/pull/2). The host created branch `factory/work-014995639614c448c6e56d11`, head `a6d6e591207918a81bc4f8f2c9e4bc7d345d3b70`, from source `65ff1fb74af68344d8042a1b655e0c0c00e99d39`. This proves the app-scoped GitHub publication path on actual useful work. No merge occurred.

The worker wrote the feedback component, browser-storage utility, MiningRun integration and focused tests. Its `verify_work` ran typecheck, 44 factory tests and both app builds successfully before publication. GitHub Actions run `34695846890` passed, and both PR previews reached Ready. The original PR explicitly says it has no live-browser evidence; independent review and browser verification are recorded separately when completed.

This was an assisted run. A person approved two budget continuations and explicitly steered the worker to implement. The dashboard also showed a second token-limit card on the root at roughly 849,000 input tokens; the retained local evidence does not capture that card. The same sandbox state resumed and the same worker published. No feature code was written by the supervising development session. The resulting context changes make the existing control choices explicit, bound preliminary exploration and shorten dependency-install output shown to the model. Their impact on a fresh worker is not yet measured.

[Original publication, command and usage evidence](../factory/mining/native/2026-09-12/worker-proposal-feedback.json) records 1,050,658 input / 32,825 output tokens for the child. Root plus child model cost was about 2.4 cents; Sandbox compute is separate. The original dispatch failure cost an additional $0.0004135. A stopped sandbox with a saved snapshot was confirmed after publication.

The run also exposed a cockpit projection bug: the dispatcher completed before the background `subagent.called` event, so the chat composable stopped before discovering its child. The UI now follows the durable station stream beyond that boundary, exposes explicit budget choices, and judges cancellation from the latest turn rather than an earlier interrupted turn. Live replay verification follows deployment.

### PR #2 browser verification

The authenticated Chrome check used the actual PR preview at `https://adeo-factory-cockpit-j3aku1zxp-demo-software-factory.vercel.app`, head `a6d6e591`. A fresh preview investigation, `wrun_41M2AW710Q0GTFT56P7E0TXN1Z`, returned two structured proposals. Production session links did not restore in the preview environment, so no production findings were fabricated or imported.

On the two actual proposal cards, Useful and Not useful stayed independent. A reason saved and restored with both selections after reload; editing the reason worked; clearing the first proposal left the second unchanged. Space activated the focused radio control. “Use this proposal” still opened the correct editable draft with its evidence and provenance, and the existing worker/reviewer controls remained available; no additional work was started or draft saved. Both temporary feedback entries were cleared afterward; these test judgments do not represent Remi's opinion. Malformed/unavailable storage and legacy IDs are covered by the worker's tests, not by this hosted browser exercise.

The preview miner's result was Incomplete for missing issue inventory and Jira deployment evidence. Its first proposal overlapped the independent review already underway; this is an observed context-quality limitation. The run is useful browser verification, not evidence of new-task originality. [Its compact evidence](../factory/mining/native/2026-09-12/preview-feedback-mining.json) records a clean completed turn, 202,283 input / 9,040 output tokens and $0.008552186 model cost, excluding Sandbox compute.

### Independent review of PR #2

On runtime `a4dda9b`, cockpit root `wrun_41M2AWE0HZ0GWQQZ5PXHSK3VD9` dispatched reviewer `wrun_41M2AWE9GG0GY9AH1YT9M7XY8C` with only PR number 2. It independently prepared source, inspected all four changed files and ran typecheck, tests and build successfully. The tool recorded an **approve** verdict, with one nonblocking finding at `apps/factory/app/components/ProposalFeedback.vue:29`: the storage warning may linger after storage recovers. As documented below, that approval is invalid. No steering or budget continuation was needed.

The reviewed head was `a6d6e591207918a81bc4f8f2c9e4bc7d345d3b70`; the GitHub PR API reported base `65ff1fb74af68344d8042a1b655e0c0c00e99d39`, even though `main` had advanced to `a4dda9b`. Both PR-reported revisions were rechecked when recording. This is a review of those snapshots, not verification of a hypothetical merge into newer main. [Reconciled 12 September 2026: PR #2 has since merged as `c375659`; the "remains a draft and unmerged" wording above is the original dated review evidence and is superseded.]

The first approval attempt included missing browser/assistive checks as limitations and was rejected by the host. The reviewer then classified those checks as optional under the task's allowance to list checks not run, disclosed them in its summary, and retried with an empty limitations array. It obtained no new browser evidence. The recorded approval is therefore invalid evidence and must not be used as an accepted-review claim. The host policy now derives required browser interaction and keyboard-accessibility evidence from the changed-file inventory; model wording cannot remove those requirements. Until a trusted browser verifier supplies that evidence to the reviewer gate, browser-facing changes fail closed as incomplete. The separate browser verification above was not supplied to this reviewer.

[Original review evidence](../factory/mining/native/2026-09-12/reviewer-proposal-feedback.json) retains both attempts, command evidence and the exact result. Root plus child model cost was about 1 cent; the child used 268,228 input / 9,161 output tokens. The reviewer sandbox was confirmed stopped afterward. The cockpit displayed its running verification step and then the recorded verdict, exact head, finding and command evidence.

Combined model cost for the failed dispatch, successful assisted worker, preview miner and independent reviewer was **$0.042898064**, excluding Sandbox compute and development-session costs. All used Muse Spark under `demo-software-factory`. This demonstrates the two stations on real work; it does not establish general autonomous delivery or review accuracy.

The final cockpit follow-up makes a recorded child result supersede stale parent budget prompts and Stop controls. Its typecheck, 43 factory tests and production build passed locally; deployed replay is the final delivery check.

## Worker and reviewer bootstrap — 12 September 2026

The implementation follows [the station design and source decisions](../factory/work-stations.md). Root typecheck, tests and both app builds passed, including 38 factory tests. A Vercel-mode Nuxt build confirmed both `/eve/v1/*` and `/factory/stations/*` route to the existing Eve service with their original paths. The native Eve Vercel build also passed. A local HTTP probe of the custom worker route returned 400 for invalid input without starting a model run.

These checks establish the compiled boundary and request validation, not a successful worker or reviewer run. The first real assignment is [proposal usefulness feedback](../factory/tasks/proposal-usefulness.md); production evidence follows once the stations execute it.

The first hosted worker launch, `wrun_41M2AV3MBZ0GKQ7CVGE2RTP7S7`, exposed an Eve runtime constraint: dynamic subagent configuration cannot return `defaultTools`. Eve omitted the worker while the dispatcher incorrectly claimed to delegate. No child, source edit or PR was created. [The original trace](../factory/mining/native/2026-09-12/worker-dispatch-failed.json) records $0.0004135 model cost. Fixed specialist configurations now disable defaults statically and check the immutable station identity before selecting any child model. This preserves the capability boundary without unsupported dynamic configuration.

CI run `34695040014` also exposed different Nitro preset selection on GitHub Actions: `VERCEL=1` alone produced Node output. Packaging verification now explicitly selects `NITRO_PRESET=vercel`, so it actually tests the deployment configuration.

## Machine access and individual proposal drafts — 12 September 2026

Revision `3b6b8fa` passed GitHub Actions run `34693717672` and deployed Ready as `dpl_2PuzWWXcCHrePBy9R3ovrdXFgoWB`. An isolated frozen install, typechecks, tests and both app builds passed. Proposal parsing preserves structured records; each cockpit action creates an editable draft containing only that proposal, its evidence and provenance. It does not start implementation.

Native Eve evaluation `wrun_01M2ASCWZAT1J2P6G5JGCT287E` inspected source `3b6b8fa`, passed all six operational and proposal-identity gates, and recorded two proposals with distinct host-assigned IDs. Both explicitly acknowledge that Remi's review is pending. The run read project metadata and deployments for both apps through app-scoped Connect without viewer authorization. Its report was Complete for the evidence requested; runtime logs were not exercised by this evaluation. [Stored findings](../factory/mining/native/2026-09-12/structured-proposals.json) record 200,504 input / 5,861 output tokens and $0.010145464 model cost; Sandbox compute is separate. This validates the structured handoff and access path, not owner acceptance or broad task-mining quality.

[Machine access evidence and rotation](vercel-machine-access.md) records successful independent build-log reads and unsuccessful runtime-stream probes. The dedicated team token expires on 12 October 2026. The historical per-user authorization limitation below is superseded by this machine credential.

Proposal-quality limitation: the first finding incorrectly describes earlier runs as Incomplete because owner usefulness judgment was missing. Their operational gap was unavailable Vercel evidence; owner acceptance is a separate review dimension. The original output is retained, and this wording should not be treated as an accurate status explanation.

Hosted native investigation `wrun_41M2ASGX7J0GQQ5XJY7ETJ54F7` recorded findings at 12:31:11 UTC against that same source revision. It produced one independently selectable proposal with ID `wrun_41M2ASGX7J0GQQ5XJY7ETJ54F7:proposal:1`. The authenticated Chrome check opened its “Use this proposal” action, verified a proposal-only editable draft with source provenance and explicit context gaps, saved it locally, and reloaded. The report and one saved draft both survived. No implementation or GitHub publication was started. Two-proposal selection isolation is covered by utility tests and the separate native evaluation; this hosted run returned one proposal.

The hosted report is Incomplete: the agent requested build logs without a deployment ID and did not retry with an ID already available from deployment evidence. It also treated unsampled runtime logs as necessary for sizing a browser-local feedback feature without demonstrating that dependency. These are investigation-quality limitations, not failed machine authentication. [Hosted evidence](../factory/mining/native/2026-09-12/hosted-structured-proposals.json) confirms a cleanly completed turn at 12:31:20 UTC with no step, turn or session failure events. Usage was 292,730 input / 6,401 output tokens and $0.011206628 model cost.

The browser initially retained a Running state alongside a generic failure alert; reload restored the durable report. The status-display correction separates connection errors from terminal failures and prevents historical tool errors from labeling an active or recovered investigation failed. Ten mining-output tests, Nuxt typecheck and a production build pass. This correction does not claim to eliminate live-stream disconnections.

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

Focused transfer `wrun_01M2AQ5JE63FYDDPFVJA17AA7Q` completed cleanly with all four gates passing in 116 seconds on runtime/source `b81899e5d9ecd49b04840c649af0d63e0bbc8188`. [Transfer evidence](../factory/mining/native/2026-09-12/focused-transfer.json) records 203,434 input / 7,536 output tokens, $0.007364436 and 13 file reads. The narrow classification improvement transferred: intentional exclusions stayed in reflection; blocking gaps only named Vercel access.

Proposal quality remains mixed. The single context-quality experiment substantially repeats the baseline/transfer exercise underway in this delivery, which was not yet recorded in its snapshot. Its proposed two differently worded prompts would not isolate a context change's effect. It also guessed a missing Vitest command, then recovered with the repository's actual test script and observed 17 passing tests. The original failed command stdout remains in evidence even though its shell pipeline returned zero. These are candidates for further context work, not reasons to claim the factory has solved task mining.

The two final native probes cost $0.014316592 in reported model usage combined; Sandbox compute is separate. No owner acceptance, authenticated Vercel evidence, or broad proposal-quality improvement is inferred from the operational gates.

Paid validation uses `env -u AI_GATEWAY_API_KEY pnpm exec eve eval task-mining --verbose` from `apps/factory`, with the linked project's OIDC environment. Evaluation prompts and stored findings are excluded from future mining snapshots. Tool-completion gates are operational checks; Remi must still judge proposal usefulness.

### Historical hosted native boundary before machine access

Revision `b81899e` passed GitHub Actions run `34691922199` and deployed Ready as `dpl_A3iiXVyKQRh9Td8CcYynvbrGNcVj`. The authenticated cockpit started native session `wrun_41M2AQ5JY10GN0TN3HNBGDRNR6`. It passed source preparation and reached the Vercel evidence step, but no report or authorization card was observed. A stop was requested through the cockpit; terminal cancellation still needs confirmation. An earlier native session restored its active state after reload but ended without findings. This does not establish a successful hosted native investigation or report-to-draft handoff.

The `vercel/jira-clone` MCP connection is attached to the cockpit, but it supports user authorization rather than an app installation. The choice between per-user authorization and a shared team credential remains pending. The agent exposes only reads for the two fixed projects; parser and scope checks use fixtures. Actual Connect token acquisition, provider response shapes, build logs and runtime logs remain unverified. Independent connector probes did not provide successful provider responses. Do not infer that authorization alone will resolve the observed hosted stall.

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

This section is a dated stage-zero snapshot. It predates the bounded Jira REST,
MCP, identity, OAuth and write work now described in
[the current Jira state](jira-current-state.md); keep the historical claims
below as evidence of what stage zero did not verify at that time.

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
