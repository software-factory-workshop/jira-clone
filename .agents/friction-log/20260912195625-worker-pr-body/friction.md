---
title: 'Worker PR body repeats prompts and exposes execution boilerplate'
severity: 'minor'
---

## Expected Behavior
PR bodies explain the final change and verification in readable prose.
## Current Behavior
The host repeats the original task and active revision, prints raw shell wrappers and exposes execution metadata. The included make-pr-easy-to-review skill was not explicitly required by worker instructions.
## Possible Solution
Use a concise host validation section, retain substantive limitations and the hidden ownership marker, and require the worker to apply the skill before publication.
## Minimal Reproducible Example
PR #17 repeats the same task under Original task and Requested revision.
## Context
Native Eve worker publication in apps/factory/agent/subagents/worker/tools/publish_work.ts.
