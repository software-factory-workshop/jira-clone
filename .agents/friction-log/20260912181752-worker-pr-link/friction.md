---
title: 'Worker PR link text is invisible on its primary button'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#78'
---

## Expected Behavior
The Open draft PR action is readable in the ADEO result card.
## Current Behavior
On the combined preview, the action has an accessible name but its text is teal on a teal background. WorkRun scoped a styles override the Nuxt UButton anchor text color.
## Possible Solution
Style only ordinary review and run links, leaving Nuxt UI button link colors to the design system.
## Minimal Reproducible Example
Open worker root wrun_41M2B9P85E0GRBGJCR8Z257Z3A on the immutable combined preview and inspect the PR10 result action.
## Context
Observed in a real browser screenshot on 9bdb5b4 during UI child PR8 verification. No API or ownership behavior change is needed.
