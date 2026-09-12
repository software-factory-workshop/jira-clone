# Verify the station through its deployed runtime

Status: historical delivery observation by Codex on 12 September 2026, from the fx-backed Eve wrapper. The native Eve migration removes that wrapper and its ACP asset-copy workaround. The runtime-boundary lesson below remains relevant; the described packaging mechanism is no longer the deployed architecture. This note does not approve the miner's task proposals.

The first Eve station passed typechecks, tests and builds. A real local investigation completed, survived reconnection and populated a draft. Its first hosted investigation still failed: the bundled ACP module loaded bootstrap files relative to `import.meta.url`, but those files were absent from the deployed function.

Copying the assets beside the visible server bundle was insufficient. Eve also materializes a server copy inside the hidden `.well-known/workflow` function directory. An ordinary glob missed that copy. A subsequent fix incorrectly assumed a separate host output directory existed; CI caught that assumption before it could replace the working deployment.

The fx-backed build was changed to walk every directory in the actual Eve service output, including hidden directories. It copied the four bootstrap files from the installed ACP package, checked their bytes and required both server and Workflow bundles in a Vercel build. CI exercised this production layout. That check was specific to the fx wrapper; native Eve CI instead checks that fx and ACP runtime bundles are absent.

Reusable lesson: a station's verification must cross the same runtime boundaries as its user action. For this station that means authenticated cockpit submission, a durable Eve tool, Sandbox startup, repository and GitHub evidence, report replay and draft handoff. A successful build establishes packaging checks passed; a completed model call establishes transport completion; reviewing the proposals establishes usefulness. None of these establishes owner acceptance of the work.

See `docs/verification.md` for the original run and deployment evidence, and `packages/fx-sandbox-experiment/` for the preserved experiment. Keep this note as historical evidence when upgrading the runtime, not as a permanent claim that later Eve releases need the same workaround.
