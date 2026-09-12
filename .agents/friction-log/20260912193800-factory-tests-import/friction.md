---
title: 'Factory tests import mining history excluded from worker snapshots'
severity: 'major'
---

## Expected Behavior
The worker snapshot executes the same factory tests as the full checkout.
## Current Behavior
The rehearsal worker was blocked by cockpit-run.test.ts importing two excluded factory/mining proof files. Its docs-only change passed typecheck/build but could not publish.
## Possible Solution
Keep only the required real event excerpts in apps/factory/tests/fixtures. Preserve the mining-history exclusion. Resume the existing unpublished owner after refreshing the corrected main baseline.
## Minimal Reproducible Example
Run the factory tests after applying the includeSource snapshot policy: the old import failed ENOENT. The replacement fixture is included by that policy and the test no longer reads mining history.
## Context
Worker wrun_41M2BDYMMV0GG14MM1TZP3N48J retained docs/jira-teaching-rehearsal.md and did not bypass publication checks. Delivery checkpoint 412bd6c940e237dc83693b6c41500e9118b441ea2695c3abee3c4ab31bcd3de6 is preserved.
