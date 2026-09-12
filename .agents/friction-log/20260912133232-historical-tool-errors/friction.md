---
title: 'Historical tool errors label an active mining investigation incomplete'
severity: 'minor'
---

## Expected Behavior
An active investigation can recover from tool errors without being labelled incomplete.
## Current Behavior
Hosted native Eve showed Running / Checking behavior alongside Investigation incomplete because every historical output-error was treated as terminal.
## Possible Solution
Use terminal events for failure; show connection recovery separately and suppress failure after findings.
## Minimal Reproducible Example
Start a mining session where one tool errors and another tool continues. Inspect the active cockpit.
## Context
Hosted verification on 12 September 2026. Regression tests cover recovery, terminal failure and successful findings. Fix isolated to jira-machine-delivery.
