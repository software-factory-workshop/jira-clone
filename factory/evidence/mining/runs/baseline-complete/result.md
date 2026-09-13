Mining for factory-first stage-zero work. Inspected repo docs, both Nuxt shells, shared context package, and current GitHub state. No implementation made.

GitHub state: issues empty, pulls empty via github_read for software-factory-workshop/jira-clone, both complete:true, captured 2026-09-12. No duplication risk. All proposals below are new.

Stage gate respected:
AGENTS.md lines 4-5: primary product is Eve factory, Jira is test subject; stage zero is shells, drafts, source-backed context; do not add agent execution until stage one is requested.
factory/README.md lines 5-7: before stage one, agree on concrete example, expected outcome, and how to distinguish useful from plausible-but-unsupported; keep config/skills/tools/evals in repo; do not prebuild later stages.

Ranked proposals, most useful now first:

1. Define the stage-01 admission contract without building runtime.

Outcome: versioned agreement for the first Eve admission case: exact example request, the four probe inputs, expected work-order vs clarification vs unsupported/denied results, and what counts as evidence.

Why now: This is the explicit blocker before stage one. The experiment already names the first request and probes, but the repo has only starter text and no acceptance contract.

Evidence references:
- docs/factory-growth-experiment.md lines 21-27: read-only Eve agent, first request Create the ADEO issue list, four inputs clear/ambiguous/unsupported/out-of-access, no protected access after denial, local fixtures.
- factory/README.md lines 5-7: agreement required before implementation.
- packages/project-context/src/index.ts lines 84-100: current starterRequests, no expected outcomes.
- packages/project-context/src/index.ts lines 50-83: references brief/adeo/jira/research, basis for grounding.
- packages/project-context/src/jira-reference.json lines 28-32: explicit limitations, must carry into contract.
- docs/cockpit.md lines 39-40: stage one is request to work-order or focused question.

Relationship to existing issues: none open, none closed shown; new preparation task, not duplicate.

Bounded scope: edit only factory/README or new factory/stage-01 admission note plus fixtures/tests under packages/project-context; no Eve agent, no server route, no webhook, no Connect tool activation, no Jira mutations.

Acceptance criteria:
- Exact input strings for the four probes are recorded.
- For each: expected result type, required fields outcome/scope/evidence/missing/verification, and denial behavior.
- States fixtures are not persistence and drafts are not work orders.
- pnpm typecheck, pnpm test, pnpm build pass; no runtime code added.

Uncertainties:
- Which wording to freeze as the canonical first request.
- Where eval lives: factory/ vs packages/project-context/.
- How strict denial/clarification language should be.

2. Extend Jira reference with read-only transition evidence.

Outcome: updated jira-reference.json plus reference text that separates observed statuses/types from still-unknown transition graph and appearance.

Why now: Stage-one work orders must not invent transitions. Current context explicitly leaves this gap, and the board UI renders statuses without transition knowledge.

Evidence references:
- packages/project-context/src/jira-reference.json lines 5-27 observed KAN id 10000, board id 1 simple, six issue types, four statuses; lines 28-32 limitations transition graph not inspected, no changes, appearance/permissions/MCP not inspected.
- packages/project-context/src/index.ts lines 67-74 Jira sandbox observation content.
- apps/jira/app/app.vue lines 6-7 statuses array To Do/In Progress/In Review/Done, lines 137-169 board columns by status with no transition checks.
- packages/project-context/src/index.ts lines 90-94 starter A board worth using warns do not assume transitions.
- docs/verification.md line 13: stage zero does not verify transitions/API/accounts/SAML/sync/MCP.
- .mining-snapshot.json: revision 9f22e3085969531b8198f831e0c460309ed15e81, no Git credentials in sandbox.

Relationship to existing issues: none open; new context-hardening task.

Bounded scope: read-only REST for transitions for listed KAN issue types; record paths/status codes/snapshot date; update JSON and reference copy; no issue/config changes, no compatibility claims, no MCP schema work.

Acceptance criteria:
- JSON lists requests made, observed graph or explicit still-unknown per type.
- Limitations section updated; cockpit knowledge shows observation vs assumption split.
- Typecheck/test/build pass.

Uncertainties:
- Whether simplified next-gen project exposes a meaningful graph via REST.
- Sandbox credential availability for a fresh read; if blocked, record blocked without changing claims.
- Whether to include minimal browser appearance notes or defer.

3. Make draft to GitHub handoff evidence-bearing, client-side only.

Outcome: Review in GitHub prefill carries source context and honesty labels, still human-submitted, still browser-local.

Why now: Stage-zero promise is reviewable drafts plus source-backed context. Current handoff is title plus body only, easy to submit context-free requests.

Evidence references:
- apps/factory/app/app.vue lines 56-78 save plus issueUrl title/body encoding; line 24 storageKey adeo-factory-drafts-v1; lines 25-35 onMounted localStorage parse with fallback notice.
- docs/cockpit.md lines 7-15: work requests/GitHub connection/knowledge/growth/product link table; line 15 browser-local draft is not shared work order, issue existence is not agent evidence.
- README.md lines 13-14: drafts local, Review in GitHub opens prefilled issue user decides.
- packages/project-context/src/index.ts lines 1-5 repository name/url/stage 00.
- apps/factory/server/api/github.get.ts lines 12-20: fixed repo only, never caller-supplied; read-only Connect token server-side.
- docs/verification.md lines 8-9: save survives reload, reopen works; must keep working.

Relationship to existing issues: none open; improves existing stage-zero behavior, not a new backend.

Bounded scope: client composition only; add evidence footer e.g. stage, context ids, draft caveat, no agent run; UI keeps browser-local label; no server storage, no auto-submit, no agent execution.

Acceptance criteria:
- Compose/edit/save/reload/reopen unchanged.
- Prefilled body includes evidence footer and explicit not-a-work-order/no-run caveat.
- Manual browser check per docs/verification.md plus typecheck/test/build pass.

Uncertainties:
- Exact footer fields: stage label vs full revision SHA vs selected reference ids.
- Length/noise tradeoff in issue body.
- Whether to include Connect state connected/unavailable at compose time.

Reflection:

What helped: AGENTS.md plus factory/README plus growth experiment gave a clear no-runtime gate; project-context source and jira-reference limitations pinpointed evidence gaps; cockpit doc honesty rule plus app.vue save/issueUrl code showed handoff risk; verification doc gave a passing baseline rev 8308ea9; github_read proved empty backlog.

What was missing or contradictory: README.md line 63 references .agents/friction-log/20260912094635-adeo-private-package/friction.md and repo map references .agents/skills, but workspace glob returned 31 files with no .agents entries, so friction/skill contents could not be verified here; growth experiment cites absolute research paths under /Users/remiconnesson which are not in this sandbox; git history/branch/dirty state not inspected under read-only mining mandate; live Connect status relies on code plus verification doc, not a fresh check.

What would improve next investigation: list .agents directory including friction log and skill version explicitly; confirm current HEAD vs .mining-snapshot revision 9f22e3; decide canonical stage-01 example request; check whether sandbox has read-only Jira credential access before promising transition capture.
