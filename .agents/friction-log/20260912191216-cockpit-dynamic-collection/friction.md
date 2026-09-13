---
title: 'Cockpit dynamic collection routes overlap Eve action routes'
severity: 'minor'
issue: 'software-factory-workshop/jira-clone#79'
---

### Expected Behavior
The cockpit collection API and action API compile into the same Eve service.

### Current Behavior
The deployed Eve build rejected POST /factory/cockpit/:collection because its pattern overlaps static /import and /activate. Nuxt build and typecheck did not detect this.

### Possible Solution
Place collection CRUD under /factory/cockpit/records/:collection and verify the actual Eve service build. This fix is committed.

### Minimal Reproducible Example
Declare POST /factory/cockpit/:collection and POST /factory/cockpit/import in one Eve channel, then run eve build.

### Context
Observed in cockpit preview dpl_5WN2QhUtGW7vzCkNLqt5RKZ9AAEF while exposing shared metadata controls.
