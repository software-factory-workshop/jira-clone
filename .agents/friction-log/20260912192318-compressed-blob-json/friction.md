---
title: 'Compressed Blob JSON reads yield weak ETags that cannot satisfy conditional writes'
severity: 'major'
---

## Expected Behavior
Conditional writes preserve concurrent edits for small and compressed JSON records.
## Current Behavior
Private compressed JSON reads return weak ETags, so both stores retried five times without any competing writer. The initial small fixture did not expose compression.
## Possible Solution
Request accept-encoding: identity and reject weak ETags. Both stores now do this.
## Minimal Reproducible Example
A live 9011-byte JSON fixture returned a weak ETag and rejected the conditional update. Reading with identity encoding returned a strong ETag and allowed the update. Reusing that stale strong ETag correctly failed. The fixture was deleted.
## Context
Observed during production delivery-loop create. The task record was preserved and no worker started. The same checkpoint can resume after deployment.
