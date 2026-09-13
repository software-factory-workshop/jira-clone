---
title: 'Outer delivery observer times out on long Eve streams'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#64'
---

title: 'Outer delivery observer times out on long Eve streams'
severity: 'major'
---

## Expected Behavior
A progressing worker or reviewer session should be observed to a complete trusted result, or remain explicitly retryable without being misclassified as a blocked delivery.

## Current Behavior
The delivery observer reads the complete Eve stream from index 0 with a fixed 10 second timeout. Published reviewer sessions #47 and #48 were still progressing, but `POST /factory/delivery/:id/advance` aborted and marked them `blocked` with no review result.

## Possible Solution
Use a bounded observation strategy that can read long streams without accepting partial data, preserves exact delivery-id filtering and child/result lookup, and returns an actionable retry state when the complete stream cannot be observed.

## Minimal Reproducible Example
Start a browser-facing worker delivery, wait for the reviewer session to accumulate a long stream, then call `POST /factory/delivery/:id/advance` while the reviewer is still active. The call times out and stores `blocked` despite the reviewer continuing.

## Context
Observed on the hosted ADEO factory delivery for Jira comments (delivery `1ccd15924382b5c8d56e74f182e80037d3edc6dfc30fc791180f88b2695727c6`, PR #47) and cockpit cards (delivery `f1339909fe21ed1f01d3843f4dcb38635b31d78a2214212614c5902610e50b45`, PR #48). A factory-only worker delivery was started to address this behavior; no Jira or cockpit product code is part of that repair.
