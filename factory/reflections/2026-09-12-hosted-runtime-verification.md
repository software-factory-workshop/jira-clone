# Verify the station through its deployed runtime

Status: delivery observation by Codex on 12 September 2026. This records a packaging failure and its verification rule; it does not approve the miner's task proposals.

The first Eve station passed typechecks, tests and builds. A real local investigation completed, survived reconnection and populated a draft. Its first hosted investigation still failed: the bundled ACP module loaded bootstrap files relative to `import.meta.url`, but those files were absent from the deployed function.

Copying the assets beside the visible server bundle was insufficient. Eve also materializes a server copy inside the hidden `.well-known/workflow` function directory. An ordinary glob missed that copy. A subsequent fix incorrectly assumed a separate host output directory existed; CI caught that assumption before it could replace the working deployment.

The build now walks every directory in the actual Eve service output, including hidden directories. It copies the four bootstrap files from the installed ACP package, checks their bytes and requires both server and Workflow bundles in a Vercel build. CI exercises this production layout. The check deliberately fails if an upgrade changes that contract: review whether the workaround can be removed rather than silently changing the expected count.

Reusable lesson: a station's verification must cross the same runtime boundaries as its user action. For this station that means authenticated cockpit submission, a durable Eve tool, Sandbox startup, repository and GitHub evidence, report replay and draft handoff. A successful build establishes packaging checks passed; a completed model call establishes transport completion; reviewing the proposals establishes usefulness. None of these establishes owner acceptance of the work.

See `docs/verification.md` for run and deployment evidence, and `apps/factory/scripts/build-eve.mjs` for the structural check. Keep this note as historical evidence when upgrading the runtime, not as a permanent claim that later Eve releases need the same workaround.
