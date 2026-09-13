---
title: 'Factory parser duplication across delivery and cockpit'
severity: 'major'
issue: 'software-factory-workshop/jira-clone#60'
---

## Expected Behavior

One typed protocol should be shared.

## Current Behavior

The same result is decoded in multiple modules.

## Possible Solution

Create one shared protocol module.

## Minimal Reproducible Example

Compare the delivery and cockpit parsers.

## Context

This can cause protocol drift.
